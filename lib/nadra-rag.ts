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
  const cnic = q.includes("cnic") || q.includes("smart cnic") || q.includes("شناختی");
  const fresh = /\bfresh\b|\bnew\b|\bregistration\b/.test(q) || q.includes("نیا") || q.includes("نئے") || q.includes("اندراج");
  const adult = /\b18\b|18\+|\badult\b/.test(q) || q.includes("اٹھارہ") || q.includes("بالغ");
  const docs = /\bdocument(s)?\b|\brequirement(s)?\b/.test(q) || q.includes("دستاویز") || q.includes("کاغذات") || q.includes("تقاضا");
  return cnic && fresh && adult && docs;
}

function getTargetedEnglishAdultCnicChunks(chunks: EnglishChunk[]) {
  return chunks
    .filter((item) =>
      /Requirements\s*[–-]\s*Fresh\s*\/\s*New Registration of 18 years or above \(CNIC or SMART CNIC\)/i.test(item.subsection || "")
    )
    .concat(
      chunks.filter((item) =>
        /Fresh\s*\/\s*New Registration/i.test(item.subsection || "") &&
        /18 years or above/i.test((item.subsection || "") + " " + (item.text || ""))
      )
    )
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
            \`ISSUE DATE: \${issueDate}\`,
            \`EFFECTIVE DATE: \${effectiveDate}\`,
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
        \`ISSUE DATE: \${issueDate}\`,
        \`EFFECTIVE DATE: \${effectiveDate}\`,
        "",
        ...ranked.map(
          (x, i) =>
            \`[NADRA URDU EVIDENCE \${i + 1}]\\nChunk: \${x.index + 1}\\nRetrieval score: \${x.score}\\n\\n\${x.text.slice(0, 2400)}\`
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
          \`ISSUE DATE: \${issueDate}\`,
          \`EFFECTIVE DATE: \${effectiveDate}\`,
          "",
          ...targeted.map(
            (item, i) =>
              \`[NADRA POLICY TARGETED EVIDENCE \${i + 1}]\\nPage: \${item.page ?? "N/A"}\\nSection: \${item.major_section || item.subsection || ""}\\n\\n\${(item.text || "").slice(0, 4000)}\`
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
