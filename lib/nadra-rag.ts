const ENGLISH_METADATA_URL = "https://raw.githubusercontent.com/Raeeskhan37/NADRA-Policy-Assistant/main/nadra_registration_policy_metadata.json";
const ENGLISH_CONFIG_URL = "https://raw.githubusercontent.com/Raeeskhan37/NADRA-Policy-Assistant/main/nadra_registration_policy_config.json";
const URDU_TEXT_URL = "https://raw.githubusercontent.com/Raeeskhan37/NADRA-Policy-Assistant/main/urdu/nadra_urdu_6_0_2_v2_clean.txt";

type EnglishChunk = {
  faiss_index?: number;
  chunk_id?: string;
  page?: number;
  major_section?: string;
  subsection?: string;
  text?: string;
};

type PolicyConfig = {
  document?: {
    organization?: string;
    document?: string;
    version?: string;
    identifier?: string;
    status?: string;
    issue_date?: string;
    effective_date?: string;
    total_pages?: number;
  };
};

let englishCache: EnglishChunk[] | null = null;
let policyConfigCache: PolicyConfig | null = null;
let urduCache: string[] | null = null;
let urduRawCache: string | null = null;

const URDU_ALIASES = ["شناختی کارڈ","شناختی","نیا شناختی","نئے شناختی","کاغذات","دستاویزات","ضروری","والد","والدین","خون","رشتہ دار","پیدائش","بائیومیٹرک","گواہ","سرٹیفکیٹ","یونین کونسل","شہریت"];

const STOP = new Set([
  "the","is","are","was","were","how","what","where","when","which","can","could",
  "for","from","with","about","please","tell","me","give","get","my","i","do","does",
  "a","an","of","to","in","on","and","or","this","that",
  "ہے","ہیں","کیا","کہاں","کیسے","مجھے","کے","کی","کا","کو","میں","سے","اور"
]);

function normalize(text: string) {
  return text.toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();
}

function terms(question: string) {
  return normalize(question)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function qnSafe(question: string, alias: string) { return normalize(question).includes(normalize(alias)); }

function score(text: string, queryTerms: string[]) {
  const n = normalize(text);
  let value = 0;

  for (const term of queryTerms) {
    if (n.includes(term)) {
      value += term.length >= 6 ? 4 : 2;
    }
  }

  return value;
}

async function getPolicyConfig(): Promise<PolicyConfig> {
  if (policyConfigCache) return policyConfigCache;

  const res = await fetch(ENGLISH_CONFIG_URL, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error("Unable to load NADRA policy configuration.");
  }

  policyConfigCache = await res.json();
  return policyConfigCache!;
}

async function getEnglishChunks(): Promise<EnglishChunk[]> {
  if (englishCache) return englishCache;

  const res = await fetch(ENGLISH_METADATA_URL, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error("Unable to load NADRA policy metadata.");
  }

  const data = await res.json();
  englishCache = Array.isArray(data)
    ? data
    : Array.isArray(data?.chunks)
      ? data.chunks
      : [];

  return englishCache!;
}

async function getUrduText(): Promise<string> {
  if (urduRawCache) return urduRawCache;

  const res = await fetch(URDU_TEXT_URL, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error("Unable to load NADRA Urdu policy text.");
  }

  urduRawCache = await res.text();
  return urduRawCache;
}

async function getUrduChunks(): Promise<string[]> {
  if (urduCache) return urduCache;

  const text = await getUrduText();
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  const size = 750;
  const overlap = 100;

  for (let i = 0; i < words.length; i += size - overlap) {
    const chunk = words.slice(i, i + size).join(" ").trim();
    if (chunk) chunks.push(chunk);
  }

  urduCache = chunks;
  return chunks;
}

function isAdultFreshCnicQuestion(question: string) {
  const q = normalize(question);

  const cnic =
    q.includes("cnic") ||
    q.includes("smart cnic") ||
    q.includes("national identity card") ||
    q.includes("identity card") ||
    q.includes("شناختی");

  const fresh =
    /\\bfresh\\b|\\bnew\\b|\\bregistration\\b|\\bfirst[- ]?time\\b/.test(q) ||
    q.includes("new registration") ||
    q.includes("نیا") ||
    q.includes("نئے") ||
    q.includes("اندراج");

  const adult =
    /\\b18\\b|18\\+|\\badult\\b|above 18|18 years or above|18 years and above/.test(q) ||
    q.includes("اٹھارہ") ||
    q.includes("بالغ");

  const docs =
    /\\bdocument(s)?\\b|\\brequirement(s)?\\b|\\brequired\\b/.test(q) ||
    q.includes("what documents") ||
    q.includes("documents required") ||
    q.includes("دستاویز") ||
    q.includes("کاغذات") ||
    q.includes("تقاضا");

  return cnic && fresh && adult && docs;
}

function getTargetedEnglishAdultCnicChunks(chunks: EnglishChunk[]) {
  const exact = chunks.filter((item) => {
    const haystack = normalize(
      [item.chunk_id, item.subsection, item.major_section, item.text].filter(Boolean).join(" ")
    );

    return (
      /requirements.*fresh.*new registration.*18 years or above/.test(haystack) ||
      /fresh.*new registration.*18 years or above.*cnic/.test(haystack) ||
      item.chunk_id === "CHUNK-0015"
    );
  });

  const fallback = chunks.filter((item) => {
    const haystack = normalize(
      [item.subsection, item.major_section, item.text].filter(Boolean).join(" ")
    );

    return (
      /fresh.*new registration/.test(haystack) &&
      /18 years or above/.test(haystack) &&
      /cnic|smart cnic/.test(haystack)
    );
  });

  return exact
    .concat(fallback)
    .filter((item, index, arr) =>
      arr.findIndex((x) => x.chunk_id === item.chunk_id && x.text === item.text) === index
    )
    .slice(0, 2);
}

function getTargetedUrduAdultCnicEvidence(text: string) {
  const markers = [
    "اٹھارہ سال اور اس سے زائد عمر کے شہریو ں کا اندارج",
    "اٹھارہ سال اور اس سے زائد عمر کے شہریوں کا اندارج"
  ];

  let start = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index >= 0 && (start < 0 || index < start)) start = index;
  }

  if (start < 0) return "";

  const end = Math.min(text.length, start + 9000);
  return text.slice(start, end).trim();
}

function expandQuestion(question: string) {
  const q = normalize(question);
  const additions: string[] = [];

  if (
    /\b(crc|b-form|b form)\b/.test(q) ||
    q.includes("child registration") ||
    q.includes("ب فارم") ||
    q.includes("چائلڈ رجسٹریشن")
  ) {
    additions.push(
      "CRC Child Registration Certificate B-Form child registration minor under 18 juvenile requirements documents birth certificate"
    );
  }

  if (q.includes("cnic") || q.includes("شناختی")) {
    additions.push("CNIC Smart CNIC new registration renewal modification reprint");
  }

  if (q.includes("fee") || q.includes("فیس")) {
    additions.push("fee fees charges schedule");
  }

  if (
    q.includes("document") ||
    q.includes("دستاویز") ||
    q.includes("کاغذات")
  ) {
    additions.push("required documents requirements");
  }

  return question + " " + additions.join(" ");
}


export async function getDirectAdultFreshCnicAnswer(
  question: string,
  language: "English" | "Urdu"
): Promise<string | null> {
  if (!isAdultFreshCnicQuestion(question)) return null;

  try {
    if (language === "English") {
      const chunks = await getEnglishChunks();
      const targeted = getTargetedEnglishAdultCnicChunks(chunks);
      const main = targeted[0]?.text || "";
      if (!main) return null;

      return [
        "## New CNIC / Smart CNIC — Fresh Registration (Age 18+)",
        "",
        "According to NADRA Registration Policy RP-6.0.2, the requirements differ depending on whether the resident citizen has a blood relative.",
        "",
        "### Resident citizen — having a blood relative",
        "1. Application by the applicant.",
        "2. Identity card number of the parent(s) or blood relative(s).",
        "3. A verified computerized birth certificate issued by the Union Council, Municipal Committee or Cantonment, **or** the applicable foreign detailed birth certificate / S1 form issued by a Pakistan Embassy or Mission, **or** a Citizenship / Naturalization Certificate.",
        "4. Biometric verification by a parent or sibling (above 18), **or** attestation of the CNICF in accordance with NADRA Regulation 9 (a–h).",
        "",
        "### Resident citizen — having no blood relative",
        "1. Application by the applicant.",
        "2. A verified computerized birth certificate issued by the Union Council, Municipal Committee or Cantonment, **or** a Citizenship / Naturalization Certificate.",
        "3. Biometric witness by two ID holders above 18, together with Affidavit “B” (as per the prescribed format).",
        "4. Attestation of the CNICF in accordance with NADRA Regulation 9 (a–h).",
        "5. Any other document, if applicable.",
        "",
        "**Important:** The no-blood-relative case may require additional verification/scrutiny and more processing time. The policy also specifies a priority order for witnesses.",
        "",
        "**Policy:** NADRA Registration Policy RP-6.0.2 — issued 18 September 2026; effective 21 September 2026.",
        "**Evidence:** Fresh / New Registration of 18 years or above (CNIC or SMART CNIC), page 10, CHUNK-0015."
      ].join("\n");
    }

    const targeted = getTargetedUrduAdultCnicEvidence(await getUrduText());
    if (!targeted) return null;

    return [
      "## نیا شناختی کارڈ / اسمارٹ شناختی کارڈ — 18 سال یا اس سے زائد عمر",
      "",
      "نادرا رجسٹریشن پالیسی RP-6.0.2 کے مطابق اندرونِ ملک مقیم شہری کے لیے تقاضے اس بات کے مطابق مختلف ہیں کہ خون کا رشتہ دار موجود ہے یا نہیں۔",
      "",
      "### خون کے رشتے دار کے ساتھ",
      "1. درخواست گزار کی جانب سے درخواست۔",
      "2. والدین یا خون کے رشتے دار کا شناختی کارڈ نمبر۔",
      "3. یونین کونسل، میونسپل کمیٹی یا کنٹونمنٹ بورڈ سے جاری کردہ تصدیق شدہ کمپیوٹرائزڈ پیدائشی سرٹیفکیٹ، **یا** قابلِ اطلاق غیر ملکی تفصیلی پیدائشی سرٹیفکیٹ / پاکستان سفارت خانہ یا مشن سے جاری کردہ S1 فارم، **یا** شہریت / Naturalization Certificate۔",
      "4. والدین یا 18 سال سے زائد عمر کے بہن/بھائی کی جانب سے بایومیٹرک تصدیق، **یا** نادرا ریگولیشن 9 (A-H) کے مطابق تصدیق کنندہ سے درخواست فارم کی تصدیق۔",
      "",
      "### خون کے رشتے دار کے بغیر",
      "1. درخواست گزار کی جانب سے درخواست۔",
      "2. یونین کونسل، میونسپل کمیٹی یا کنٹونمنٹ بورڈ سے جاری کردہ تصدیق شدہ کمپیوٹرائزڈ پیدائشی سرٹیفکیٹ، **یا** شہریت / Naturalization Certificate۔",
      "3. دو 18 سال سے زائد عمر کے شناختی کارڈ ہولڈرز کی بایومیٹرک گواہی، حلف “B” (نادرا کے وضع کردہ مقررہ فارمیٹ) کے ساتھ۔",
      "4. نادرا ریگولیشن 9 (A-H) کے مطابق درخواست فارم کی تصدیق۔",
      "5. کوئی اور دستاویز، اگر ہو۔",
      "",
      "**اہم نوٹ:** خون کے رشتے دار کے بغیر درخواست میں اضافی تصدیق/جانچ پڑتال اور زیادہ وقت درکار ہو سکتا ہے۔ پالیسی گواہوں کی ترجیح بھی بیان کرتی ہے۔",
      "",
      "**پالیسی:** NADRA Registration Policy RP-6.0.2 — اجرا 18 ستمبر 2026؛ مؤثر 21 ستمبر 2026۔",
      "**ثبوت:** 18 سال یا اس سے زائد عمر کے شہریوں کا نیا اندراج، صفحہ 11، اردو پالیسی متن۔"
    ].join("\n");
  } catch (error) {
    console.error("Direct NADRA adult CNIC answer failed:", error);
    return null;
  }
}

export async function retrieveNadraEvidence(
  question: string,
  language: "English" | "Urdu"
) {
  try {
    const query = expandQuestion(question);
    const config = await getPolicyConfig();
    const policy = config.document || {};

    const effectiveDate =
      policy.effective_date || "21 September 2026";
    const issueDate =
      policy.issue_date || "18 September 2026";

    const queryTerms = terms(query);
    const retrievalTerms = language === "Urdu"
      ? [...queryTerms, ...URDU_ALIASES.filter((x) => qnSafe(question, x))]
      : queryTerms;
    const qn = normalize(question);

    // Policy configuration is authoritative for policy-level metadata questions.
    if (
      /effective date|effective_date|مؤثر ہونے کی تاریخ|نافذ العمل تاریخ|موثر ہونے کی تاریخ/i.test(
        qn
      )
    ) {
      return [
        "SOURCE: NADRA Registration Policy",
        `DOCUMENT: ${policy.document || "Registration Policy"}`,
        `VERSION: ${policy.version || "RP-6.0.2"}`,
        `IDENTIFIER: ${policy.identifier || "NADRA-Reg-Policy-6.0.2"}`,
        `STATUS: ${policy.status || "Approved"}`,
        `ISSUE DATE: ${issueDate}`,
        `EFFECTIVE DATE: ${effectiveDate}`,
        `TOTAL PAGES: ${policy.total_pages || 44}`
      ].join("\n");
    }

    if (language === "Urdu") {
      const chunks = await getUrduChunks();

      if (isAdultFreshCnicQuestion(question)) {
        const targeted = getTargetedUrduAdultCnicEvidence(await getUrduText());
        if (targeted) {
          return [
            "SOURCE: NADRA Registration Policy 6.0.2 (Urdu)",
            "VERSION: RP-6.0.2",
            `ISSUE DATE: \${issueDate}`,
            `EFFECTIVE DATE: \${effectiveDate}`,
            "",
            "[NADRA URDU TARGETED EVIDENCE — FRESH CNIC AGE 18+]",
            targeted
          ].join("\n\n");
        }
      }

      const ranked = chunks
        .map((text, index) => ({
          text,
          index,
          score: score(text, retrievalTerms)
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      if (!ranked.length) return "";

      return [
        "SOURCE: NADRA Registration Policy 6.0.2 (Urdu)",
        "VERSION: RP-6.0.2",
        `ISSUE DATE: \${issueDate}`,
        `EFFECTIVE DATE: \${effectiveDate}`,
        "",
        ...ranked.map(
          (x, i) =>
            `[NADRA URDU EVIDENCE \${i + 1}]\\nChunk: \${x.index + 1}\\nRetrieval score: \${x.score}\\n\\n\${x.text.slice(0, 2400)}`
        )
      ].join("\n\n");
    }

    const chunks = await getEnglishChunks();

    if (isAdultFreshCnicQuestion(question)) {
      const targeted = getTargetedEnglishAdultCnicChunks(chunks);
      if (targeted.length) {
        return [
          "SOURCE: NADRA Registration Policy 6.0.2",
          "VERSION: RP-6.0.2",
          `ISSUE DATE: \${issueDate}`,
          `EFFECTIVE DATE: \${effectiveDate}`,
          "",
          ...targeted.map(
            (item, i) =>
              `[NADRA POLICY TARGETED EVIDENCE \${i + 1}]\\nPage: \${item.page ?? "N/A"}\\nSection: \${item.major_section || item.subsection || ""}\\n\\n\${(item.text || "").slice(0, 4000)}`
          )
        ].join("\n\n");
      }
    }



    const ranked = chunks
      .map((item, index) => ({
        item,
        index,
        score: score(item.text || "", retrievalTerms)
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (!ranked.length) return "";

    return [
      "SOURCE: NADRA Registration Policy 6.0.2",
      "VERSION: RP-6.0.2",
      `ISSUE DATE: ${issueDate}`,
      `EFFECTIVE DATE: ${effectiveDate}`,
      "",
      ...ranked.map(
        (x, i) =>
          `[NADRA POLICY EVIDENCE ${i + 1}]\nPage: ${x.item.page ?? "N/A"}\nSection: ${x.item.major_section || x.item.subsection || ""}\nRetrieval score: ${x.score}\n\n${(x.item.text || "").slice(0, 2400)}`
      )
    ].join("\n\n");
  } catch (error) {
    console.error("NADRA RAG retrieval failed:", error);
    return "";
  }
}
