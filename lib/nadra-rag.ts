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
    /\bfresh\b|\bnew\b|\bregistration\b|\bfirst[- ]?time\b/.test(q) ||
    q.includes("new registration") ||
    q.includes("نیا") ||
    q.includes("نئے") ||
    q.includes("اندراج");

  const adult =
    /\b18\b|18\+|\badult\b|above 18|18 years or above|18 years and above/.test(q) ||
    q.includes("اٹھارہ") ||
    q.includes("بالغ");

  const docs =
    /\bdocument(s)?\b|\brequirement(s)?\b|\brequired\b/.test(q) ||
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


function nadraQ(question: string, patterns: RegExp[]): boolean { return patterns.some((p) => p.test(normalize(question))); }
function nadraField(question: string): string | null {
  const q=normalize(question);
  if(/date of birth|dob|birth date|age|تاریخ پیدائش|عمر/.test(q)) return "Date of Birth";
  if(/address|residential address|پتہ|رہائشی پتہ/.test(q)) return "Address";
  if(/father.?s? name|father name|والد/.test(q)) return "Father's Name";
  if(/mother.?s? name|mother name|والدہ/.test(q)) return "Mother's Name";
  if(/name|نام/.test(q)) return "Name";
  if(/marital|marriage|divorce|widow|marital status|ازدواجی|شادی|طلاق|بیوہ/.test(q)) return "Marital Status";
  if(/religion|مذہب/.test(q)) return "Religion";
  if(/gender|جنس/.test(q)) return "Gender";
  if(/place of birth|birthplace|مقام پیدائش/.test(q)) return "Place of Birth";
  return null;
}
export async function getDirectNadraAnswer(question: string, language: "English"|"Urdu"): Promise<string|null> {
  const q = normalize(question);

  const hasCnic = /cnic|smart cnic|smart nic|snic|شناختی کارڈ|شناختی/.test(q) ||
    (/\bcard\b|identity card/.test(q) && /place of birth|birthplace|مقام پیدائش/.test(q));
  const hasCrc = /\bcrc\b|b-form|b form|child registration|juvenile|چائلڈ رجسٹریشن|ب فارم|جووینائل/.test(q);
  const hasNicop = /\bnicop\b|smart nicop/.test(q);
  const hasPoc = /\bpoc\b|pakistan origin card|pakistani origin card|پاکستان اوریجن کارڈ/.test(q);

  const isModify = /modify|modification|change|correct|correction|update|revise|alter|تبدیل|ترمیم|درست|تصحیح/.test(q);
  const isDocs = /document|documents|requirement|requirements|required|کاغذات|دستاویز|تقاضے/.test(q);
  const isApply = /apply|application|how to|obtain|get|register|registration|درخواست|حاصل|بنوانے|رجسٹریشن|اندراج/.test(q);
  const isDuplicate = /duplicate|reprint|replacement|lost|stolen|damaged|ڈپلیکیٹ|دوبارہ|گم|چوری|خراب/.test(q);
  const isCancel = /cancel|cancellation|surrender|renounce|renunciation|death|وفات|منسوخ|منسوخی|سرنڈر|دستبردار|شہریت ترک|قومیت/.test(q);
  const isConversion = /convert|conversion|from crc|crc to|juvenile card|conversion.*juvenile|تبدیل.*جووینائل|تبدیلی.*جووینائل/.test(q);

  // Internal policy metadata is evidence for the agent, not a public citation.
  // Citizen-facing answers should not expose internal policy identifiers, dates,
  // pages, chunks, or sections. The public NADRA website is the displayed source.
  const out = (title: string, body: string) =>
    language === "Urdu"
      ? "## " + title + "\n\n" + body
      : "## " + title + "\n\n" + body;

  try {
    const chunks = await getEnglishChunks();
    const byId = (id: string) => chunks.find(x => x.chunk_id === id)?.text || "";

    // ------------------------------------------------------------
    // 1. CANCELLATION MUST BE CHECKED BEFORE "HOW TO / APPLY".
    // This prevents "How to cancel NICOP?" from falling into the
    // generic NICOP fresh-registration/document branch.
    // ------------------------------------------------------------
    if (hasNicop && isCancel) {
      const death = /death|deceased|وفات|انتقال/.test(q);
      const surrender = /surrender|renoun|nationality|foreign passport|citizenship|شہریت|قومیت|سرنڈر|دستبردار/.test(q);

      if (death) {
        const body = language === "Urdu"
          ? "### وفات کی وجہ سے NICOP cancellation\n\n1. Blood relative یا spouse کی طرف سے application۔\n2. متوفی کا اصل CNIC / NICOP / POC / CRC / Juvenile Card، اگر دستیاب ہو۔\n3. UC / Municipal Committee / Cantonment کا verified computerized Death Certificate یا foreign Death Certificate۔\n4. **Attestation required نہیں ہے۔**\n\nاگر CRMS دستیاب نہ ہو تو manual Death Certificate بھی قبول کیا جا سکتا ہے۔"
          : "### NICOP cancellation due to death\n\n1. Application by a blood relative or spouse.\n2. Original CNIC / NICOP / POC / CRC / Juvenile Card of the deceased, if available.\n3. Verified computerized Death Certificate from the UC / Municipal Committee / Cantonment, or a foreign Death Certificate.\n4. **No attestation is required.**\n\nWhere CRMS is not available, a manual Death Certificate is accepted.";
        return out("NICOP — Cancellation due to Death", body);
      }

      if (surrender) {
        const body = language === "Urdu"
          ? "### پاکستانی شہریت ترک کرنے کی وجہ سے NICOP cancellation\n\n1. Applicant کی application۔\n2. Original CNIC / NICOP / CRC، اگر دستیاب ہو؛ اگر original available نہ ہو تو surrender/lost proof فراہم کیا جا سکتا ہے۔\n3. اگر applicant نے کسی **single-nationality country** کی nationality حاصل کی ہے تو متعلقہ foreign passport اور applicable **Undertaking D** یا verified Renunciation Certificate policy کے مطابق درکار ہے۔\n4. **Dual-national country** کی صورت میں foreign passport کے ساتھ verified Renunciation Certificate یا applicable Undertaking D policy کے مطابق استعمال ہو سکتا ہے۔\n5. **Attestation required نہیں ہے۔**\n\nRP-6.0.2 میں Undertaking D خاص طور پر اس صورت کے لیے موجود ہے جب foreign passport رکھنے والا applicant CNIC/NICOP cancel کرکے POC رکھنا/حاصل کرنا چاہتا ہے۔"
          : "### NICOP cancellation due to surrender of Pakistani nationality\n\n1. Application by the applicant.\n2. Original CNIC / NICOP / CRC, if available; if the original is unavailable, the policy provides for proof of surrendering or a lost performa.\n3. If the applicant acquired nationality of a **single-nationality country**, the applicable foreign passport and **Undertaking D** or a verified Renunciation Certificate are used according to the policy.\n4. For a **dual-nationality country**, the foreign passport with a verified Renunciation Certificate or applicable Undertaking D is used according to the policy.\n5. **No attestation is required.**\n\nRP-6.0.2 also contains Undertaking D for a foreign-passport holder who wants to cancel CNIC/NICOP in connection with keeping or obtaining a POC.";
        return out("NICOP — Cancellation due to Nationality Surrender", body);
      }

      return out(
        language === "Urdu" ? "NICOP — Cancellation" : "NICOP — Cancellation",
        language === "Urdu"
          ? "NICOP cancellation کی وجہ بتانا ضروری ہے کیونکہ RP-6.0.2 میں مختلف cancellation cases موجود ہیں، خاص طور پر **وفات** اور **پاکستانی شہریت ترک کرنے** کی صورت میں۔\n\nبراہِ کرم بتائیں: cancellation **وفات کی وجہ سے** ہے یا **شہریت ترک کرنے کی وجہ سے**؟"
          : "The cancellation process depends on the reason. RP-6.0.2 covers different cancellation cases, including **death** and **surrender of Pakistani nationality**.\n\nPlease specify whether the NICOP cancellation is **due to death** or **due to surrender of Pakistani nationality**."
      );
    }

    // ------------------------------------------------------------
        // Exact family-registration-information intent must not be routed to FRC.
    if (/family registration information|family information|family record|خاندانی معلومات|خاندانی ریکارڈ/.test(q) &&
        /correct|correction|change|wrong|incorrect|update|درست|تصحیح|تبدیل|غلط|ترمیم/.test(q)) {
      return out(
        language === "Urdu" ? "NADRA — Family Registration Information Correction" : "NADRA — Family Registration Information Correction",
        language === "Urdu"
          ? "آپ نے NADRA کے **family registration information / family record** میں correction کے بارے میں پوچھا ہے۔ یہ FRC حاصل کرنے سے مختلف ہے۔ براہِ کرم بتائیں کہ family information میں کون سی چیز غلط ہے، مثلاً **والد/والدہ کی معلومات، spouse، بچے یا کسی family member کی linkage**۔ مخصوص field کے مطابق NADRA کی متعلقہ correction policy لاگو ہوگی۔"
          : "You are asking about correcting **family registration information / the NADRA family record**, which is different from obtaining an FRC. Please specify what is incorrect — for example **parent information, spouse, child, or another family-member linkage**. The applicable NADRA correction standard depends on the specific field."
      );
    }

// SHAJRAH / FAMILY COMPOSITION VS FRC.
    // "Shajrah" may mean PakID Family Composition or Shajra-e-Nasab.
    // Keep this comparison ahead of the broad FRC branch.
    if(/shajrah|shajra|shajra.?e.?nasab|family composition|family tree|شجرہ|خاندانی فہرست/.test(q) &&
       /frc|family registration certificate|family composition|difference|فرق|مختلف/.test(q)) {
      const body = language === "Urdu"
        ? "### Shajrah / Family Composition اور FRC میں فرق\\n\\n**اگر Shajrah سے PakID کی Family Composition مراد ہے:** NADRA کے موجودہ PakID guide میں **FRC** اور **Family Composition** کو Family section میں الگ options کے طور پر دکھایا گیا ہے۔ FRC ایک باقاعدہ **Family Registration Certificate** ہے جو NADRA کے مطابق registered person کی family composition data کو reflect, verify اور record کرتا ہے۔ NADRA FRC کی categories میں By Birth، By Marriage، By Adoption اور By All شامل ہیں۔\\n\\n**اگر Shajra-e-Nasab (شجرہ نسب) مراد ہے:** یہ FRC نہیں ہے۔ سرکاری Revenue records میں Shajra-e-Nasab pedigree/family-tree record کے طور پر استعمال ہوتا ہے اور Revenue Department سے جاری/verified ہو سکتا ہے۔\\n\\nاس لیے دونوں کو ایک ہی document نہیں سمجھنا چاہیے۔"
        : "### Shajrah / Family Composition vs FRC\\n\\n**If by Shajrah you mean the Family Composition option in PakID:** NADRA's current PakID guide shows **FRC** and **Family Composition** as separate options in the Family section. FRC is a formal **Family Registration Certificate** which NADRA says reflects, verifies and records a registered person's family-composition data. NADRA lists FRC categories including By Birth, By Marriage, By Adoption and By All.\\n\\n**If by Shajrah you mean Shajra-e-Nasab (pedigree):** that is not the same document as an NADRA FRC. Government Revenue records use Shajra-e-Nasab as a pedigree/family-tree record, which may be issued and verified by the Revenue Department.\\n\\nSo the two terms should not be treated as the same document.";
      return out(
        language === "Urdu" ? "NADRA — Shajrah / Family Composition اور FRC" : "NADRA — Shajrah / Family Composition vs FRC",
        body
      );
    }

    // ------------------------------------------------------------
    // POC (Pakistan Origin Card) must never be expanded as
    // "Passport of Pakistan". POC is Pakistan Origin Card.
    // The current NADRA policy RAG is not the authoritative source
    // for the complete POC workflow, so the API route can use NADRA's
    // current official POC page as the online evidence fallback.
    // ------------------------------------------------------------
    if (hasPoc && (isApply || isDocs) && !isModify && !isDuplicate && !isCancel) {
      const body = language === "Urdu"
        ? "### Pakistan Origin Card (POC) — نئی درخواست\n\nPOC **Pakistan Origin Card** ہے، Passport of Pakistan نہیں۔ یہ NADRA غیر ملکی پاکستانی نژاد افراد کے لیے جاری کرتا ہے۔\n\nموجودہ NADRA معلومات کے مطابق POC کے لیے اہلیت میں سابق پاکستانی شہری، پاکستانی/سابق پاکستانی والدین یا grandparents سے تعلق رکھنے والے بعض foreign nationals، اور پاکستانی شہری/پاکستانی origin فرد کے بعض foreign spouses شامل ہیں، subject to NADRA کی eligibility conditions۔\n\n**PakID کے ذریعے بنیادی عمل:**\n1. NADRA PakID app میں account بنائیں یا sign in کریں۔\n2. **New POC** منتخب کریں۔\n3. اپنی معلومات مکمل کریں۔\n4. مطلوبہ documents upload کریں۔\n5. اگر required ہو تو NADRA Registration Centre جائیں۔\n6. PakID میں application status track کریں۔\n\nBiometric verification اور photograph کے لیے Registration Centre visit درکار ہو سکتا ہے۔\n\n**سرکاری ماخذ:** NADRA — Pakistan Origin Card (POC)\nhttps://www.nadra.gov.pk/identityDocument/poc"
        : "### Pakistan Origin Card (POC) — New Application\n\nPOC means **Pakistan Origin Card**, not Passport of Pakistan. NADRA issues POC to eligible foreign nationals of Pakistani origin.\n\nCurrent NADRA information includes eligibility categories such as a former Pakistani citizen, certain foreign nationals with a Pakistani/ex-Pakistani parent or grandparent, and certain foreign spouses of Pakistani citizens/origin individuals, subject to NADRA's eligibility conditions.\n\n**Basic PakID process:**\n1. Create an account or sign in to the NADRA PakID app.\n2. Select **New POC**.\n3. Complete the personal details.\n4. Upload the required documents.\n5. Visit a NADRA Registration Centre if required.\n6. Track the application status in the app.\n\nBiometric verification and a photograph may require a visit to a Registration Centre.\n\n**Official source:** NADRA — Pakistan Origin Card (POC)\nhttps://www.nadra.gov.pk/identityDocument/poc";
      return out(language === "Urdu" ? "NADRA — Pakistan Origin Card (POC)" : "NADRA — Pakistan Origin Card (POC)", body);
    }

    // ------------------------------------------------------------
    // FRC BY BIRTH / BY MARRIAGE / BY ADOPTION / BY ALL.
    // These are distinct FRC certificate types, not a generic
    // "family registration" question. Keep this direct so the request
    // does not fall into the slow generic web-search path.
    // ------------------------------------------------------------
    if (/\bfrc\b|family registration certificate|family registration/.test(q) &&
        /difference|different|by birth|by marriage|by adoption|by all|فرق|مختلف|پیدائش|شادی|گود/.test(q)) {
      const body = language === "Urdu"
        ? `### FRC کی اقسام

**FRC by Birth:** والدین اور بہن بھائیوں کی تفصیلات شامل کرتا ہے۔

**FRC by Marriage:** spouse اور بچوں کی تفصیلات شامل کرتا ہے۔

**FRC by Adoption:** guardian اور adopted family members کی تفصیلات شامل کرتا ہے۔

**FRC by All:** دونوں family groups کی تفصیلات شامل کرتا ہے۔

NADRA کے مطابق FRC family-composition data کا سرکاری record ہے۔ FRC کی یہ categories NADRA کے official FRC page پر درج ہیں۔

**اہم:** FRC کی category اس family relationship کے مطابق منتخب کی جاتی ہے جس کی معلومات certificate میں درکار ہوں۔`
        : `### FRC Types

**FRC by Birth:** includes details of parents and siblings.

**FRC by Marriage:** includes details of spouse and children.

**FRC by Adoption:** includes details of the guardian and adopted family members.

**FRC by All:** includes both family groups.

NADRA describes the FRC as a certificate that reflects, verifies and records a registered person's family-composition data. These FRC categories are listed on NADRA's official FRC page.

**Important:** Select the FRC category that matches the family relationship you need represented on the certificate.`;

      return out(language === "Urdu" ? "NADRA — FRC کی اقسام" : "NADRA — FRC Types", body);
    }

    // 2. FRC / FAMILY REGISTRATION.
    // "Family registration information" is NOT automatically treated
    // as an FRC application or parent-information correction.
    // ------------------------------------------------------------
    if (/\bfrc\b|family registration certificate|family registration|family information|family record|خاندانی رجسٹریشن|خاندانی معلومات|فیملی رجسٹریشن/.test(q)) {
      if (/correct|correction|change|wrong|incorrect|update|درست|تصحیح|تبدیل|غلط|ترمیم/.test(q) && !/\bfrc\b|family registration certificate/.test(q)) {
        return out(
          language === "Urdu" ? "NADRA — Family Information Correction" : "NADRA — Family Information Correction",
          language === "Urdu"
            ? "اگر آپ کا مطلب NADRA کے **family record / family information** میں غلطی درست کرنا ہے تو یہ FRC بنوانے سے مختلف سروس ہے۔\n\nبراہِ کرم بتائیں کہ کون سی معلومات غلط ہے — مثلاً **والد/والدہ، spouse، child/relative linkage یا کسی فرد کا نام/شناختی ریکارڈ**۔ اس field کے مطابق متعلقہ NADRA correction standard لاگو ہوگا۔\n\nاگر آپ صرف **FRC حاصل کرنا** چاہتے ہیں تو سوال یوں پوچھیں: “How to get FRC?”"
            : "If you mean correcting an error in the NADRA **family record / family information**, that is different from applying for an FRC.\n\nPlease specify what is wrong — for example **parent information, spouse, child/relative linkage, or a person's name/identity record**. The relevant NADRA correction standard depends on the specific field.\n\nIf you only want to **obtain an FRC**, ask: “How to get FRC?”"
        );
      }

      if (isApply || isDocs || /\bfrc\b|family registration certificate/.test(q)) {
        const evidence = byId("CHUNK-0035");
        const body = language === "Urdu"
          ? "### FRC کے لیے RP-6.0.2 کے تقاضے\n\n1. **Blood relative، spouse یا guardian** application دے سکتا ہے۔\n2. اگر minor کا CRC بغیر photo کے جاری ہوا ہے تو **photo capture کے لیے minor کی موجودگی لازمی** ہے۔\n3. اگر CRC بغیر biometrics کے جاری ہوا تھا تو **FRC کے بعد CRC بھی اسی دن process** کیا جائے گا۔\n4. اگر family member NADRA میں registered نہیں ہے تو Pak-ID (DAU/Mobile App) میں **unregistered family member کے لیے متعلقہ option** استعمال کیا جاتا ہے۔\n5. CRC / Juvenile Card / NICOP (below 18) holder صرف اس صورت میں FRC کے لیے apply کر سکتا ہے جب اس کے **photo اور fingerprints NADRA کے پاس available** ہوں۔"
          : "### FRC requirements under RP-6.0.2\n\n1. An application may be made by a **blood relative, spouse or guardian**.\n2. If a minor was issued a CRC without a photo, the **minor must be present for photo capture**.\n3. If a CRC was issued without biometrics, the **CRC is also processed on the same day after the FRC**.\n4. For an unregistered family member, the relevant **Pak-ID (DAU/Mobile App) option** is used to collect the required information.\n5. A CRC / Juvenile Card / NICOP holder below 18 can apply for an FRC only if the person's **photo and fingerprints are available with NADRA**.";
        if (evidence) {
          return out(language === "Urdu" ? "Family Registration Certificate (FRC)" : "Family Registration Certificate (FRC)", body);
        }
      }
    }

    // ------------------------------------------------------------
    // 3. CRC -> JUVENILE CARD / OTHER ID CONVERSION.
    // Must precede the generic CRC application branch.
    // ------------------------------------------------------------
    // Eligibility questions must be answered directly, before the
    // conversion workflow. Example: "Can a child under 18 get a
    // Smart/Juvenile Card?" is not asking how to convert a CRC.
    if (/under 18|below 18|minor|child|بچہ|نابالغ|18 سال سے کم|اٹھارہ سال سے کم/.test(q) &&
        /can|eligible|eligibility|allowed|get|have|obtain|smart|juvenile|جووینائل|اسمارٹ|مل سکتا|حقدار/.test(q) &&
        !/convert|conversion|from crc|crc to|تبدیل.*جووینائل|تبدیلی.*جووینائل/.test(q)) {
      const body = language === "Urdu"
        ? "### ہاں — 18 سال سے کم عمر بچہ Juvenile Card حاصل کر سکتا ہے\n\n**ہاں۔** NADRA Registration Policy RP-6.0.2 کے مطابق 18 سال سے کم عمر پاکستانی شہری کے لیے **Juvenile Card** ایک شناختی دستاویز ہے۔ بچے کو بالغ CNIC حاصل کرنے کی ضرورت نہیں ہے۔\n\nاگر بچے کے پاس پہلے سے **CRC/B-Form** ہے تو اسے Juvenile Card میں convert کیا جا سکتا ہے۔ Juvenile Card کے عمل میں بچے کی اپنی application/identity record کے ساتھ parent(s)، 18 سال سے زائد sibling یا guardian کی **biometric verification** یا applicable attestation درکار ہو سکتی ہے۔"
        : "### Yes — a child under 18 can get a Juvenile Card\n\n**Yes.** Under NADRA Registration Policy RP-6.0.2, a Pakistani citizen under 18 can obtain a **Juvenile Card**, which is an identity document for a minor. The child does **not** need to obtain an adult CNIC first.\n\nIf the child already has a **CRC/B-Form**, it can be converted to a Juvenile Card. For the Juvenile Card process, the child's own application/identity record is used, while a parent, sibling above 18, or guardian may be required for **biometric verification** or the applicable attestation.";
      return out(language === "Urdu" ? "Juvenile Card — Under 18 Eligibility" : "Juvenile Card — Under 18 Eligibility", body);
    }

    // Conversion questions are handled separately.
    if (hasCrc && isConversion && /juvenile|snic|snico? p?|smart|جووینائل/.test(q)) {
      const body = language === "Urdu"
        ? "### CRC سے Juvenile Card میں Conversion\n\n1. **Juvenile Card کے لیے minor خود primary applicant ہوتا ہے۔** RP-6.0.2 میں CRC سے Juvenile Card کے لیے application **CRC / Juvenile Card holder کی طرف سے یا اس کی جانب سے** درج ہے۔\n2. موجودہ **CRC number** درکار ہے۔\n3. Non-resident citizen کی صورت میں applicable Pakistani/foreign passport، residence permit، travel document یا Pakistan Embassy/Mission سے duly attested Undertaking “A” درکار ہو سکتا ہے۔\n4. **Parent(s)، 18 سال سے زائد sibling(s) یا guardian کی biometric verification**، یا Regulation 9(a-h) کے مطابق CNICF attestation، applicable ہے۔ Non-resident citizen جو abroad سے apply کرے، اس کے لیے ID holder سے application-form verification کا option بھی policy میں دیا گیا ہے؛ یہ exception Juvenile Card کے لیے apply نہیں ہوتی۔\n5. Conversion کے دوران **photograph, fingerprints اور iris** capture/update کیے جاتے ہیں۔\n6. اگر particulars میں کوئی تبدیلی بھی مطلوب ہو تو وہ متعلقہ change/correction standard کے مطابق process ہوگی۔"
        : "### Conversion from CRC to Juvenile Card\n\n1. **The minor is the primary applicant for the Juvenile Card.** RP-6.0.2 specifies the application as being made by/on behalf of the **CRC / Juvenile Card holder**.\n2. The existing **CRC number** is required.\n3. For a non-resident citizen, the applicable Pakistani/foreign passport, residence permit, travel document or Embassy/Mission-attested Undertaking “A” is required where applicable.\n4. **Biometric verification by a parent, sibling above 18, or guardian** is required, or the applicable CNICF attestation under Regulation 9(a-h). For a non-resident citizen applying from abroad, the policy also provides verification of the application form by an ID holder; this exception is specifically stated not to apply to Juvenile Card.\n5. During conversion, **photograph, fingerprints and iris** are captured/updated.\n6. If particulars also need to be changed, the relevant change/correction standard applies.";
      return out(language === "Urdu" ? "CRC → Juvenile Card Conversion" : "CRC → Juvenile Card Conversion", body);
    }

    // ------------------------------------------------------------
    // 4. CHILD UNDER 18 / JUVENILE CARD.
    // ------------------------------------------------------------
    if (/under 18|below 18|minor|child|بچہ|نابالغ|18 سال سے کم|اٹھارہ سال سے کم/.test(q) &&
        /smart|juvenile|جووینائل|اسمارٹ/.test(q)) {
      const body = language === "Urdu"
        ? "### 18 سال سے کم عمر بچے کے لیے Juvenile Card\n\n**ہاں۔** NADRA کے مطابق 18 سال سے کم عمر پاکستانی شہری CRC یا Juvenile Card کے لیے eligible ہے۔ Juvenile Card، CRC کی طرح minor کی identity document ہے۔\n\nنئی Juvenile Card registration کے لیے: والدین/guardian کی identity-card information، verified computerized Birth Certificate (یا بیرونِ ملک پیدائش کی صورت میں applicable foreign detailed Birth Certificate / S-1 Form / Citizenship/Naturalization proof) اور parent/guardian کی biometric verification یا applicable attestation درکار ہو سکتی ہے۔ Juvenile Card کے لیے بچے کی موجودگی لازمی ہے۔"
        : "### Juvenile Card for a child under 18\n\n**Yes.** NADRA states that a Pakistani citizen under 18 is eligible for a CRC or Juvenile Card. The Juvenile Card is an identity document for a minor, with the same identity value as the CRC.\n\nFor a new Juvenile Card, the policy requires the parent/guardian identity information, a verified computerized Birth Certificate (or the applicable foreign detailed Birth Certificate / S-1 Form / Citizenship/Naturalization proof for an overseas birth), and parent/guardian biometric verification or the applicable attestation. The child's presence is mandatory for a Juvenile Card.";
      return out(language === "Urdu" ? "Juvenile Card — عمر 18 سال سے کم" : "Juvenile Card — Under 18", body);
    }

    // ------------------------------------------------------------
    // 5. SMART CNIC DUPLICATE / REPRINT.
    // ------------------------------------------------------------
    if (hasCnic && /smart cnic|smart nic|snic/.test(q) && isDuplicate) {
      const body = language === "Urdu"
        ? "### Resident applicant\n1. Applicant کی application۔\n2. CNIC / NICOP / CRC / Juvenile Card number۔\n3. **کوئی دوسرا document required نہیں۔**\n4. **Attestation required نہیں ہے۔**\n\n### Non-resident applicant\n1. Applicant کی application۔\n2. NICOP number۔\n3. Pakistani/Foreign passport، residence permit، travel document یا Embassy/Mission سے duly attested Undertaking “A” میں سے applicable document۔\n4. Attestation required نہیں ہے۔\n\nیہ re-print/duplicate service ہے؛ demographic data change اس service میں نہیں کیا جاتا۔"
        : "### Resident applicant\n1. Application by the applicant.\n2. CNIC / NICOP / CRC / Juvenile Card number.\n3. **No other document is required.**\n4. **Attestation is not required.**\n\n### Non-resident applicant\n1. Application by the applicant.\n2. NICOP number.\n3. Applicable Pakistani/foreign passport, residence permit, travel document or Embassy/Mission-attested Undertaking “A”.\n4. Attestation is not required.\n\nThis is a re-print/duplicate service; demographic data is not changed through re-print.";
      return out(language === "Urdu" ? "Smart CNIC — Duplicate / Re-print" : "Smart CNIC — Duplicate / Re-print", body);
    }

    // ------------------------------------------------------------
    // 6. NICOP FRESH APPLICATION / DOCUMENTS — use exact RP-6.0.2
    // evidence instead of manually reconstructed requirements.
    // ------------------------------------------------------------
    if (hasNicop && (isApply || isDocs) && !isModify && !isDuplicate && !isCancel) {
      const evidence = byId("CHUNK-0016");
      if (evidence) {
        const body = language === "Urdu"
          ? "### 18+ NICOP / SMART NICOP — Fresh Registration\n\n**Non-resident citizen:**\n1. Applicant کی application۔\n2. Parent(s) یا blood relative(s) کا identity-card number؛ اگر blood relative نہیں ہے تو SI case میں دو ID holders کی biometric witness اور Undertaking “B”۔\n3. Foreign detailed Birth Certificate، manual Birth Certificate، Embassy/Mission کا S-1 Form، یا Citizenship/Naturalization Certificate۔\n4. Pakistani/Foreign passport، residence permit، travel document یا Pakistan Embassy/Mission سے duly attested Undertaking “A”۔\n5. Parent(s)/18+ sibling(s) کی biometric verification، یا DAU کے لیے Regulation 9(a-h) کے مطابق CNICF attestation، یا abroad applicant کے لیے ID holder سے application-form verification۔\n\n**Intending to be non-resident citizen:**\n1. Applicant کی application۔\n2. Parent(s)/blood relative(s) کا identity-card number، یا SI case میں دو ID holders + Undertaking “B”۔\n3. Verified computerized Birth Certificate (UC / Municipal Committee / Cantonment) یا Citizenship/Naturalization Certificate۔\n4. Parent(s)/18+ sibling(s) کی biometric verification، یا applicable CNICF attestation / abroad ID-holder verification۔"
          : "### 18+ NICOP / SMART NICOP — Fresh Registration\n\n**Non-resident citizen:**\n1. Application by the applicant.\n2. Identity-card number of parent(s) or blood relative(s); if there is no blood relative, an SI case uses two ID-holder biometric witnesses with Undertaking “B”.\n3. Foreign detailed Birth Certificate, manual Birth Certificate, Embassy/Mission S-1 Form, or Citizenship/Naturalization Certificate.\n4. Pakistani/Foreign passport, residence permit, travel document, or Embassy/Mission-attested Undertaking “A”.\n5. Biometric verification by parent(s)/18+ sibling(s), applicable CNICF attestation for DAUs, or ID-holder application-form verification for applicants applying from abroad.\n\n**Intending to be non-resident citizen:**\n1. Application by the applicant.\n2. Parent(s)/blood-relative ID number, or two ID-holder witnesses + Undertaking “B” for SI cases.\n3. Verified computerized Birth Certificate from the UC / Municipal Committee / Cantonment or Citizenship/Naturalization Certificate.\n4. Biometric verification by parent(s)/18+ sibling(s), applicable CNICF attestation, or abroad ID-holder verification.";
        return out(language === "Urdu" ? "NICOP / SMART NICOP — Fresh Registration" : "NICOP / SMART NICOP — Fresh Registration", body);
      }
    }

    // ------------------------------------------------------------
    // 7. NICOP modification — clarify field instead of returning
    // unrelated fresh-registration requirements.
    // ------------------------------------------------------------
    if (hasNicop && isModify && !isDuplicate && !isCancel) {
      const field = nadraField(question);
      if (!field) {
        return out(
          language === "Urdu" ? "NICOP — Modification" : "NICOP — Modification",
          language === "Urdu"
            ? "آپ NICOP میں کس معلومات کو تبدیل کرنا چاہتے ہیں؟ مثلاً نام، تاریخِ پیدائش، والد/والدہ کا نام، پتہ یا marital status بتائیں۔"
            : "What information do you want to modify on the NICOP? For example: name, date of birth, parent information, address or marital status. Please specify the field."
        );
      }
      if (field === "Date of Birth" || field === "Address") {
        return getDirectNadraAnswer(question.replace(/NICOP/ig, "CNIC"), language);
      }
      return out(
        language === "Urdu" ? "NICOP — مخصوص Modification" : "NICOP — Specific Modification",
        language === "Urdu"
          ? "آپ نے " + field + " کی تبدیلی پوچھی ہے۔ NADRA Registration Policy میں identity-document change/correction کے متعلقہ standard کے مطابق یہ field process کی جاتی ہے۔"
          : "You asked to change " + field + ". The relevant NADRA identity-document change/correction standard applies to that field."
      );
    }

    // ------------------------------------------------------------
    // GENERIC NEW/FRESH CNIC CARD PROCESS.
    // "What is the process for a new card?" does not necessarily
    // mention age/documents, so the older resolver missed it and the
    // request fell through to the generic AI path. Keep this direct
    // and policy-grounded.
    // ------------------------------------------------------------
    if (hasCnic &&
        isApply &&
        /\b(new|fresh)\b|new card|fresh card|new cnic|fresh cnic|نیا کارڈ|نیا شناختی|نئے شناختی/.test(q) &&
        !isDuplicate && !isModify && !isCancel) {
      const body = language === "Urdu"
        ? `### نیا CNIC / Smart CNIC — Fresh Registration

**اگر عمر 18 سال یا اس سے زیادہ ہے:**
- درخواست گزار کی درخواست۔
- خون کے رشتہ دار موجود ہوں تو والدین/خون کے رشتہ دار کا شناختی کارڈ نمبر، verified Birth Certificate یا قابلِ اطلاق citizenship document، اور parent/sibling کی biometric verification یا CNICF attestation۔
- اگر خون کا رشتہ دار موجود نہ ہو تو verified Birth Certificate/Citizenship document، دو 18+ ID holders کی biometric گواہی کے ساتھ Affidavit “B”، اور CNICF attestation درکار ہے۔ ایسے cases میں اضافی verification/scrutiny ہو سکتی ہے۔

**اگر عمر 18 سال سے کم ہے:**
- NADRA policy میں minor کے لیے CRC یا Juvenile Card کا الگ process ہے؛ adult CNIC پہلے بنوانا ضروری نہیں۔
- Juvenile Card کے لیے minor primary applicant ہوتا ہے اور parent/guardian کی identity information اور applicable biometric verification درکار ہوتی ہے۔

**اہم:** 18+ fresh registration میں blood-relative اور no-blood-relative cases کے تقاضے مختلف ہیں۔ درست case کے مطابق documents اور verification requirements لاگو ہوں گی۔

**پالیسی:** NADRA Registration Policy RP-6.0.2 — مؤثر 21 ستمبر 2026۔`
        : `### New CNIC / Smart CNIC — Fresh Registration

**If the applicant is 18 or above:**
- Application by the applicant.
- Where a blood relative is available: parent/blood-relative identity-card number, a verified Birth Certificate or applicable citizenship document, and biometric verification by a parent/sibling above 18 or CNICF attestation.
- Where no blood relative is available: verified Birth Certificate/citizenship document, biometric witness by two ID holders above 18 with Affidavit “B”, and CNICF attestation. Such cases may require additional verification/scrutiny.

**If the applicant is under 18:**
- NADRA policy provides a separate CRC/Juvenile Card process for minors; an adult CNIC does not have to be obtained first.
- For a Juvenile Card, the minor is the primary applicant and parent/guardian identity information and applicable biometric verification are required.

**Important:** The requirements differ between 18+ fresh registration with a blood relative and a no-blood-relative case. The applicable documents and verification requirements depend on the applicant's circumstances.

**Policy:** NADRA Registration Policy RP-6.0.2 — effective 21 September 2026.`;

      return out(language === "Urdu" ? "NADRA — نیا شناختی کارڈ" : "NADRA — New CNIC / Smart CNIC", body);
    }

    // ------------------------------------------------------------
    // PARENT INFORMATION CORRECTION.
    // Keep this ahead of the generic identity-document fallback so
    // father/mother-name questions use the exact RP-6.0.2 standard.
    // ------------------------------------------------------------
    if (hasCnic &&
        /father.?s? name|mother.?s? name|parent.?s? info|والد|والدہ/.test(q) &&
        isModify) {
      const body = language === "Urdu"
        ? `### CNIC — والد/والدہ کی معلومات کی درستگی

**اگر والدین زندہ ہیں:**
1. درخواست گزار کی درخواست۔
2. متعلقہ والد/والدہ کا شناختی کارڈ نمبر۔
3. جس والد/والدہ کی معلومات درست کی جا رہی ہیں ان کی **بایومیٹرک گواہی**۔
4. اسی parent information والے کسی ایک sibling کی **بایومیٹرک گواہی**۔
5. Non-resident citizen کی صورت میں applicable passport/residence/work permit/travel document یا attested Undertaking “A”۔

**اگر biometric witness دستیاب نہ ہو:** پالیسی کے مطابق parent/sibling کی attested/notarized undertaking درکار ہو سکتی ہے؛ اور اگر ایک یا کوئی sibling موجود نہ ہو تو verified Birth Certificate، old B-Form، RG-I/RG-III، old passport، CNICF یا verified Matric/equivalent certificate جیسی irrefutable documentary evidence استعمال کی جا سکتی ہے۔

**اہم:** Parent information کی correction **صرف ایک مرتبہ** کی جا سکتی ہے۔

اگر Birth Certificate NADRA/CRMS میں موجود ہے تو parent information کی correction سے پہلے Birth Certificate میں correction ضروری ہے۔`
        : `### CNIC — Parent Information Correction

**If the parents are alive:**
1. Application by the applicant.
2. Identity-card number of the relevant parent.
3. **Biometric witness:** the father or mother whose information is being corrected.
4. **Biometric witness:** one sibling whose identity document contains the same parent information.
5. For a non-resident citizen, the applicable passport/residence/work permit/travel document or attested Undertaking “A”.

**If a biometric witness cannot be captured:** the policy provides for an attested/notarized undertaking from the parent(s)/sibling(s); where one or no sibling is available, irrefutable documentary evidence such as a verified Birth Certificate, old B-Form, RG-I/RG-III, old passport, CNICF or verified Matric/equivalent certificate may be required.

**Important:** Parent information can be corrected **only once**.

If a Birth Certificate exists in NADRA/CRMS, the Birth Certificate must first be corrected before parent information is corrected in the identity record.`;

      return out(language === "Urdu" ? "CNIC — والد/والدہ کی معلومات کی درستگی" : "CNIC — Parent Information Correction", body);
    }

    // ------------------------------------------------------------
    // 8. GENERIC CRC application/documents only after conversion and
    // under-18 intent have been handled.
    // ------------------------------------------------------------
    if (hasCrc) {
      if (isModify && !/name|نام/.test(q) &&
          !nadraQ(question,[/date of birth|dob|age|address|place of birth|birthplace|father|mother|والد|والدہ|پتہ|مقام پیدائش|تاریخ پیدائش/])) {
        return out(
          language === "Urdu" ? "CRC میں ترمیم" : "CRC Modification",
          language === "Urdu"
            ? "آپ CRC میں کس معلومات کو تبدیل کرنا چاہتے ہیں؟ مثلاً بچے کا نام، تاریخِ پیدائش، والد/والدہ کا نام یا پتہ۔ مخصوص field بتائیں۔"
            : "What information do you want to modify on the CRC? For example: the child's name, date of birth, father's/mother's name or address. Please specify the field."
        );
      }

      // CRC / B-Form place-of-birth correction.
      // Keep this ahead of the generic CRC application branch so
      // "How to change ..." cannot fall back to fresh registration.
      if (nadraQ(question,[/place of birth|birthplace|مقام پیدائش/])) {
        const body = language === "Urdu"
          ? `### CRC / B-Form — جائے پیدائش کی تبدیلی / درستگی

CRC/B-Form میں جائے پیدائش کی تبدیلی **Change / Correction in Card / Certificate** کے تحت آتی ہے۔

1. **Birth Certificate یا کوئی دوسرا متعلقہ documentary evidence** درکار ہوگا۔
2. اگر Birth Certificate پہلے سے NADRA یا CRMS میں موجود ہے تو پہلے **اسی UC سے جاری Birth Certificate** میں تبدیلی/درستگی کرانی ہوگی، پھر NADRA record میں correction کیا جائے گا۔
3. Change case میں **attestation required نہیں ہے**۔
4. اصل document دیکھا اور scan کیا جائے گا۔

**Policy:** NADRA Registration Policy RP-6.0.2، Rule 13(1)، Change / Correction in Card / Certificate — Place of Birth requirements (Page 16).`
          : `### CRC / B-Form — Change / Correction of Place of Birth

Changing the place of birth on a CRC/B-Form is handled under **Change / Correction in Card / Certificate**.

1. A **Birth Certificate or other relevant documentary evidence** is required.
2. If the Birth Certificate already exists in NADRA or CRMS records, the Birth Certificate must first be corrected/changed by the **same Union Council (UC)** before the NADRA record is changed.
3. **No attestation is required** in a change case.
4. The original document must be seen and scanned.

**Policy:** NADRA Registration Policy RP-6.0.2, Rule 13(1), Change / Correction in Card / Certificate — Place of Birth requirements (Page 16).`;
        return out(language === "Urdu" ? "CRC / B-Form — جائے پیدائش کی تبدیلی / درستگی" : "CRC / B-Form — Change / Correction of Place of Birth", body);
      }

      // CRC / B-Form address correction.
      if (nadraQ(question,[/address|residential address|پتہ|رہائشی پتہ/])) {
        const body = language === "Urdu"
          ? `### CRC / B-Form — پتہ تبدیل کرنے کا طریقہ

CRC/B-Form میں پتے کی تبدیلی **Change / Correction in Card / Certificate** کے تحت آتی ہے۔

**عارضی پتہ:** درج ذیل میں سے متعلقہ ثبوت استعمال ہو سکتا ہے: خود، والدین، خون کے رشتہ دار یا spouse کے ID پر متعلقہ پتہ؛ computerized utility bill (بجلی، گیس یا پانی)؛ applicant/parent/spouse کی residential property document؛ verified Local/Domicile/PRC؛ notarized affidavit/rent deed؛ Society/Government allotment letter؛ یا Sindh میں UC کا Resident Certificate۔

**مستقل پتہ:** spouse کا identity document with same address؛ computerized utility bill؛ applicant/parent/spouse کی residential property document؛ verified Local/Domicile/PRC؛ Society/Government allotment letter (کم از کم 3 سال پہلے allotted)؛ یا house owner کا ID card اور original property document کے ساتھ affidavit۔

Non-resident applicants کے لیے متعلقہ passport/residence/work/travel document یا Undertaking A کی شرط policy میں دی گئی ہے۔ **Foreign address change کے لیے کوئی document required نہیں ہے۔**

**Policy:** NADRA Registration Policy RP-6.0.2، Change / Correction in Card / Certificate — Address requirements (Pages 15–16).`
          : `### CRC / B-Form — Change / Correction of Address

Changing the address on a CRC/B-Form is handled under **Change / Correction in Card / Certificate**.

**Temporary address:** Depending on the case, the policy accepts evidence such as the applicant's, parent/relative's or spouse's ID address; a computerized electricity, gas or water bill; residential property documentation of the applicant/parent/spouse; verified Local/Domicile/PRC; a notarized affidavit/rent deed; a Society/Government allotment letter; or, in Sindh, a UC Resident Certificate.

**Permanent address:** The policy lists a spouse's identity document with the same address; computerized utility bill; residential property document of applicant/parent/spouse; verified Local/Domicile/PRC; Society/Government allotment letter (allotted at least 3 years earlier); or an affidavit with the house owner's ID card and original property document.

For non-resident citizens, the policy lists the applicable passport/residence/work/travel document or Undertaking A. **No document is required for a change of foreign address.**

**Policy:** NADRA Registration Policy RP-6.0.2, Change / Correction in Card / Certificate — Address requirements (Pages 15–16).`;
        return out(language === "Urdu" ? "CRC / B-Form — پتے کی تبدیلی" : "CRC / B-Form — Change / Correction of Address", body);
      }

      if (nadraQ(question,[/correct.*name|change.*name|name.*crc|child.?s name|نام.*ب فارم|ب فارم.*نام|نام.*crc/])) {
        const body = language === "Urdu"
          ? "بچے کے نام کی تبدیلی کے لیے RP-6.0.2 میں **C1 Undertaking for Name Change — Form-B / Juvenile Card / NICOP (citizens less than 18 years)** موجود ہے۔ اگر Birth Certificate NADRA/CRMS میں موجود ہے تو پہلے Birth Certificate میں نام درست کرنا ہوگا۔"
          : "For a child's name change, RP-6.0.2 provides **C1 Undertaking for Name Change — Form-B / Juvenile Card / NICOP (citizens under 18)**. If the Birth Certificate exists in NADRA/CRMS, the name must first be corrected in the Birth Certificate.";
        return out(language === "Urdu" ? "CRC / B-Form — Child Name Change" : "CRC / B-Form — Child Name Change", body);
      }

      if (isDocs || isApply) {
        const body = language === "Urdu"
          ? "### CRC / B-Form — Fresh Registration\n\n1. والدین میں سے کسی ایک یا guardian کی application، identity-card number کے ساتھ۔\n2. UC / Municipal Committee / Cantonment کا verified computerized Birth Certificate، یا بیرونِ ملک پیدائش کی صورت میں foreign detailed Birth Certificate / S-1 Form / Citizenship/Naturalization Certificate۔\n3. Parent/guardian کی biometric verification یا applicable attestation۔\n4. **3 سال سے زیادہ عمر کے minor کی موجودگی لازمی ہے۔**"
          : "### CRC / B-Form — Fresh Registration\n\n1. Application by one parent or guardian with the parent/guardian identity-card number.\n2. Verified computerized Birth Certificate from the UC / Municipal Committee / Cantonment, or the applicable foreign detailed Birth Certificate / S-1 Form / Citizenship/Naturalization Certificate.\n3. Parent/guardian biometric verification or applicable attestation.\n4. **Presence of a minor above 3 years is mandatory.**";
        return out(language === "Urdu" ? "CRC / B-Form — Fresh Registration" : "CRC / B-Form — Fresh Registration", body);
      }
    }

    // ------------------------------------------------------------
    // CNIC PLACE-OF-BIRTH CORRECTION.
    // "place of birth" + "card" is a NADRA identity-document correction
    // question, not a Union Council birth-certificate request.
    if (hasCnic && isModify && nadraQ(question, [/place of birth|birthplace|مقام پیدائش/])) {
      const body = language === "Urdu"
        ? `### CNIC — جائے پیدائش کی تبدیلی / درستگی\n\n1. **درخواست:** CNIC میں جائے پیدائش کی تبدیلی/درستگی کے لیے NADRA identity-document modification process استعمال ہوتا ہے۔\n2. **دستاویز:** Birth Certificate یا کوئی دوسرا متعلقہ documentary evidence درکار ہے۔\n3. اگر Birth Certificate پہلے سے NADRA یا CRMS record میں موجود ہے تو CNIC record میں change/correction صرف اسی صورت میں کیا جائے گا جب پہلے اسی UC سے جاری Birth Certificate میں correction/change کیا گیا ہو۔\n4. Change cases میں **attestation required نہیں ہے**۔\n5. اصل document دیکھا اور scan کیا جائے گا؛ NADRA کے اپنے جاری کردہ identity/vital-event documents کو scan کرنا لازم نہیں۔\n6. Original identity document جمع کرایا جائے گا؛ اگر اصل ID card دستیاب نہ ہو تو system-generated undertaking دستخط کے ساتھ جمع کرانی ہوگی۔\n7. بعض exceptional cases کو Zonal/Regional board یا متعلقہ approval کے لیے refer کیا جا سکتا ہے۔\n\n**Policy:** NADRA Registration Policy RP-6.0.2 — Change / Correction of Identity Documents, Various Fields Requirements, page 16.`
        : `### CNIC — Change / Correction of Place of Birth\n\n1. **Application:** Use the NADRA identity-document modification/correction process for changing or correcting the place of birth on the CNIC.\n2. **Evidence required:** A Birth Certificate or other relevant documentary evidence is required.\n3. If a Birth Certificate already exists in NADRA or CRMS records, the CNIC change/correction can only be made after the Birth Certificate is corrected/changed by the same Union Council (UC).\n4. **No attestation is required** in change cases.\n5. The original document must be seen and scanned; NADRA-issued identity/vital-event documents do not need to be scanned.\n6. The previously issued original identity document is to be submitted; if the original ID card is unavailable, a system-generated undertaking with signature is required.\n7. Exceptions may be referred for Zonal/Regional board or relevant approval according to the policy.\n\n**Policy:** NADRA Registration Policy RP-6.0.2 — Change / Correction of Identity Documents, Various Fields Requirements, page 16.`;
      return out(language === "Urdu" ? "CNIC — جائے پیدائش کی تبدیلی / درستگی" : "CNIC — Change / Correction of Place of Birth", body);
    }

    // CNIC DATE-OF-BIRTH / AGE CORRECTION.
    // IMPORTANT: never call getDirectNadraAnswer() recursively here.
    // The previous implementation did exactly that, causing age/DOB
    // questions to hang until the API timed out.
    // ------------------------------------------------------------
    if (hasCnic && isModify && nadraQ(question, [/date of birth|dob|birth date|age|تاریخ پیدائش|عمر/])) {
      const evidence = byId("CHUNK-0022");
      const body = language === "Urdu"
        ? `### CNIC — تاریخِ پیدائش / عمر کی درستگی

1. **درخواست:** درخواست گزار کی جانب سے درخواست۔
2. **اگر عمر میں تبدیلی 5 سال تک ہے:** تصدیق شدہ کمپیوٹرائزڈ Birth Certificate (Union Council / Municipal Committee / Cantonment) یا پالیسی میں درج قابلِ قبول دستاویزات میں سے ایک، مثلاً Matric/Equivalent certificate، 9th/10th marks sheet، valid passport، verified government/semi-government service record، یا دیگر سرکاری DOB document۔
3. **اگر تبدیلی 5 سال سے زیادہ ہے:** اوپر والی documentary evidence میں سے ایک کے ساتھ DG Ops / HOD IOOD یا Regional DG کی approval درکار ہے۔
4. اگر Birth Certificate NADRA/CRMS میں موجود ہے تو DOB change سے پہلے اسی Birth Certificate میں correction ضروری ہے۔
5. **10 سال یا اس سے زیادہ کی age change** unrealistic-age-change case کے طور پر DG approval اور reasoning/justification/documents کے ساتھ process ہوتی ہے۔
6. اگر پہلے سے استعمال شدہ age-proof document میں مختلف DOB ہے تو اسے policy کے مطابق correct/cancel کرنا ہوگا، سوائے Manual Pakistani Passport / MNIC کے۔
7. اگر applicant matriculate ہے اور Birth Certificate کے علاوہ کسی دوسرے document میں مختلف DOB ہے تو policy کے مطابق Matric certificate کو preference دی جاتی ہے۔

**اہم:** DOB change کی exact category اور approval اس بات پر depend کرتی ہے کہ تبدیلی کتنے سال کی ہے اور موجودہ NADRA/CRMS record میں کون سا birth evidence موجود ہے۔`
        : `### CNIC — Date of Birth / Age Correction

1. **Application:** Apply as the applicant.
2. **For a change up to 5 years:** a verified computerized Birth Certificate from the Union Council / Municipal Committee / Cantonment, or one of the policy's accepted documents such as a Matric/equivalent certificate, 9th/10th mark sheet, valid passport, verified government/semi-government service record, or another government-issued DOB document.
3. **For a change of more than 5 years:** one of the documentary proofs above plus approval from DG Ops / HOD IOOD or the Regional DG.
4. If a Birth Certificate already exists in NADRA/CRMS, the Birth Certificate must first be corrected before the DOB is changed in the identity record.
5. An **age change of 10 years or more** is treated as an unrealistic age-change case requiring DG approval with reasoning/justification/documents.
6. If a previously used age-proof document contains a different DOB, it must be corrected or cancelled according to the policy, except for a Manual Pakistani Passport / MNIC.
7. If the applicant is matriculate and another non-birth-certificate document has a different DOB, the policy gives preference to the Matric certificate.

**Important:** The exact approval path depends on the size of the DOB change and the birth evidence already held in NADRA/CRMS.`;

      return out(language === "Urdu" ? "CNIC — تاریخِ پیدائش / عمر کی درستگی" : "CNIC — Date of Birth / Age Correction", body);
    }

    if(hasCnic && isModify && nadraQ(question,[/address|residential address|پتہ|رہائشی پتہ/])) {
      const body = language === "Urdu"
        ? "**پتے کی تبدیلی:**\n\n1. درخواست گزار کی درخواست۔\n2. عارضی یا مستقل پتے کے لیے policy میں درج متعلقہ رہائشی ثبوت۔\n3. Non-resident cases میں applicable passport/residence/work permit/travel document یا attested Undertaking A۔\n4. Foreign address change کے لیے document required نہیں۔"
        : "**Address change:**\n\n1. Submit an application.\n2. Use the applicable residential evidence listed by the policy for temporary or permanent address.\n3. Non-resident cases use the applicable passport/residence/work permit/travel document or attested Undertaking A.\n4. No document is required for changing a foreign address.";
      return out("CNIC — Change of Address", body);
    }

    if((hasCnic || hasNicop || hasPoc) && isCancel) {
      return out(
        language === "Urdu" ? "NADRA — Identity Document Cancellation" : "NADRA — Identity Document Cancellation",
        language === "Urdu"
          ? "Cancellation کی وجہ بتانا ضروری ہے۔ RP-6.0.2 میں death اور surrender of Pakistani nationality کے الگ standards ہیں۔ براہِ کرم وجہ بتائیں۔"
          : "The cancellation reason is required because RP-6.0.2 has separate standards for death and surrender of Pakistani nationality. Please specify the reason."
      );
    }

    if(nadraQ(question,[/birth[- ]related.*nadra|nadra.*birth.*record|birth record.*nadra|پیدائش.*نادرا|نادرا.*پیدائش/])) {
      const body = language === "Urdu"
        ? "NADRA policy میں Birth Certificate کو fresh/new registration کا primary document قرار دیا گیا ہے۔ اگر existing identity record میں DOB، parent information یا دوسرے particulars بدلنے ہیں اور Birth Certificate NADRA/CRMS میں موجود ہے تو پہلے Birth Certificate درست کرنا ہوگا۔ نیا Birth Certificate خود Union Council / Municipal Committee / Cantonment کی civil-registration service ہے۔"
        : "NADRA policy treats the Birth Certificate as the primary document for fresh/new registration. If DOB, parent information or another identity particular is being changed and the Birth Certificate exists in NADRA/CRMS, it must be corrected first. A new Birth Certificate itself is a Union Council / Municipal Committee / Cantonment civil-registration service.";
      return out(language === "Urdu" ? "NADRA — Birth Record / Birth Certificate" : "NADRA — Birth Record / Birth Certificate", body);
    }
  } catch (error) {
    console.error("Direct NADRA resolver failed:", error);
  }

  return null;
}

export async function getDirectAdultFreshCnicAnswer(
  question: string,
  language: "English" | "Urdu"
): Promise<string | null> {
  if (!isAdultFreshCnicQuestion(question)) return null;

  try {
    // Retrieve the targeted internal RAG chunks to ensure this specialized
    // answer is only used when the current NADRA evidence supports the topic.
    // The internal policy itself is never exposed in the citizen-facing text.
    if (language === "English") {
      const chunks = await getEnglishChunks();
      const targeted = getTargetedEnglishAdultCnicChunks(chunks);
      if (!targeted[0]?.text) return null;

      return [
        "## New CNIC / Smart CNIC — Fresh Registration (Age 18+)",
        "",
        "For a first-time CNIC or Smart CNIC, the requirements depend mainly on whether you have a blood relative whose identity can be verified.",
        "",
        "### If you have a blood relative",
        "1. Your application.",
        "2. CNIC/identity-card number of a parent or blood relative.",
        "3. A verified computerized Birth Certificate, or the applicable citizenship/naturalization document.",
        "4. Biometric verification by a parent or sibling aged 18+, **or** the applicable CNICF attestation.",
        "",
        "### If you do not have a blood relative",
        "1. Your application.",
        "2. A verified computerized Birth Certificate or applicable citizenship/naturalization document.",
        "3. Biometric witnesses from two ID holders aged 18+, with the required Affidavit “B”.",
        "4. The applicable CNICF attestation.",
        "5. NADRA may ask for additional documents or verification.",
        "",
        "**Simple summary:** If a blood relative is available, their identity/biometric verification can support the application. If no blood relative is available, the case requires two adult ID-holder witnesses and additional verification.",
        "",
        "**Official source:** NADRA — https://www.nadra.gov.pk/identityDocument/cnic"
      ].join("\n");
    }

    const targeted = getTargetedUrduAdultCnicEvidence(await getUrduText());
    if (!targeted) return null;

    return [
      "## نیا CNIC / Smart CNIC — پہلی مرتبہ رجسٹریشن (عمر 18 سال یا اس سے زیادہ)",
      "",
      "پہلی مرتبہ CNIC یا Smart CNIC بنوانے کے تقاضے اس بات پر منحصر ہیں کہ آپ کا کوئی خون کا رشتہ دار موجود ہے یا نہیں جس کی شناخت کی تصدیق کی جا سکے۔",
      "",
      "### اگر خون کا رشتہ دار موجود ہو",
      "1. درخواست گزار کی درخواست۔",
      "2. والدین یا کسی خون کے رشتہ دار کا شناختی کارڈ نمبر۔",
      "3. تصدیق شدہ کمپیوٹرائزڈ Birth Certificate، یا قابلِ اطلاق شہریت / Naturalization Certificate۔",
      "4. 18 سال یا اس سے زیادہ عمر کے والدین یا بہن/بھائی کی بائیومیٹرک تصدیق، یا قابلِ اطلاق CNICF تصدیق۔",
      "",
      "### اگر خون کا رشتہ دار موجود نہ ہو",
      "1. درخواست گزار کی درخواست۔",
      "2. تصدیق شدہ کمپیوٹرائزڈ Birth Certificate یا قابلِ اطلاق شہریت / Naturalization Certificate۔",
      "3. 18 سال یا اس سے زیادہ عمر کے دو شناختی کارڈ رکھنے والے افراد بطور گواہ، مطلوبہ Affidavit “B” کے ساتھ۔",
      "4. قابلِ اطلاق CNICF تصدیق۔",
      "5. NADRA مزید دستاویزات یا اضافی تصدیق طلب کر سکتا ہے۔",
      "",
      "**آسان خلاصہ:** اگر خون کا رشتہ دار موجود ہو تو اس کی شناخت اور بائیومیٹرک تصدیق درخواست میں مدد دیتی ہے۔ اگر خون کا رشتہ دار موجود نہ ہو تو دو بالغ شناختی کارڈ رکھنے والے گواہوں اور اضافی تصدیق کی ضرورت پڑ سکتی ہے۔",
      "",
      "**سرکاری ماخذ:** NADRA — https://www.nadra.gov.pk/identityDocument/cnic"
    ].join("\n");
  } catch (error) {
    console.error("Direct adult fresh CNIC resolver failed:", error);
  }

  return null;
}

export async function getDirectNadraVerificationEvidence(question: string): Promise<string> {
  try {
    const chunks = await getEnglishChunks();
    const q = normalize(question);
    const ids = new Set<string>();

    // Common policy foundations.
    ids.add("CHUNK-0001"); // breeder-document / prior birth-record correction rule
    ids.add("CHUNK-0019"); // Rule 13(1), change/correction framework

    // Intent-specific evidence. This is deliberately broader than the old
    // seven-condition map so the verifier receives the actual policy section
    // for the service being answered, rather than unrelated nearby chunks.
    if (/fresh|new|registration|first[- ]?time|نیا|اندراج/.test(q)) {
      ids.add("CHUNK-0011");
      ids.add("CHUNK-0012");
      ids.add("CHUNK-0014");
      ids.add("CHUNK-0015");
      ids.add("CHUNK-0017");
    }

    if (/crc|b-form|b form|child registration|juvenile|under 18|below 18|minor|ب فارم|جووینائل/.test(q)) {
      ids.add("CHUNK-0011");
      ids.add("CHUNK-0012");
      ids.add("CHUNK-0031");
    }

    if (/date of birth|dob|birth date|age|تاریخ پیدائش|عمر/.test(q)) ids.add("CHUNK-0022");

    if (/place of birth|birthplace|مقام پیدائش/.test(q)) ids.add("CHUNK-0029");

    if (/address|residential address|temporary address|permanent address|foreign address|پتہ|رہائشی پتہ/.test(q)) {
      ids.add("CHUNK-0023");
      ids.add("CHUNK-0024");
    }

    if (/name|نام/.test(q)) {
      ids.add("CHUNK-0020");
      ids.add("CHUNK-0055");
      ids.add("CHUNK-0056");
    }

    if (/father.?s? name|mother.?s? name|parent.?s? info|parent information|والد|والدہ/.test(q)) {
      ids.add("CHUNK-0021");
    }

    if (/marital|marriage|divorce|widow|marital status|ازدواجی|شادی|طلاق|بیوہ/.test(q)) {
      ids.add("CHUNK-0025");
    }

    if (/religion|مذہب/.test(q)) ids.add("CHUNK-0026");
    if (/gender|جنس/.test(q)) ids.add("CHUNK-0027");
    if (/relative|family member|add.*sibling|linkage|رشتہ دار|خاندان/.test(q)) ids.add("CHUNK-0028");

    if (/renew|renewal|reprint|duplicate|lost|stolen|damaged|تجدید|ڈپلیکیٹ|گم|چوری|خراب/.test(q)) {
      ids.add("CHUNK-0030");
      ids.add("CHUNK-0032");
    }

    if (/frc|family registration certificate|family registration|family information|family record/.test(q)) {
      ids.add("CHUNK-0035");
    }

    if (/poc|pakistan origin card|pakistani origin card|پاکستان اوریجن کارڈ/.test(q)) {
      ids.add("CHUNK-0038");
      ids.add("CHUNK-0041");
      ids.add("CHUNK-0042");
      ids.add("CHUNK-0043");
      if (/renew|renewal|reprint|change|modify|correction|address|name|dob/.test(q)) ids.add("CHUNK-0046");
      ids.add("CHUNK-0048");
    }

    if (/nicop|smart nicop/.test(q)) {
      ids.add("CHUNK-0013");
      ids.add("CHUNK-0016");
      if (/cancel|cancellation|surrender|renoun|death|وفات|منسوخ/.test(q)) {
        ids.add("CHUNK-0050");
        ids.add("CHUNK-0051");
        ids.add("CHUNK-0058");
      }
    }

    if (/cancel|cancellation|surrender|renoun|death|deceased|وفات|منسوخ|شہریت ترک/.test(q)) {
      ids.add("CHUNK-0050");
      ids.add("CHUNK-0051");
    }

    if (/shajrah|shajra|shajra.?e.?nasab|family composition|family tree|شجرہ|خاندانی فہرست/.test(q)) {
      // The NADRA FRC side is still supported by policy; the Revenue-side
      // Shajra-e-Nasab evidence is supplied by the API route when needed.
      ids.add("CHUNK-0035");
    }

    if (/effective date|effective_date|مؤثر ہونے کی تاریخ|نافذ العمل تاریخ/.test(q)) {
      ids.add("CHUNK-0001");
    }

    const selected = chunks.filter((x) => x.chunk_id && ids.has(x.chunk_id));

    if (!selected.length) return "";

    return selected
      .map(
        (x) =>
          `SOURCE: NADRA Registration Policy RP-6.0.2
PAGE: ${x.page || ""}
SECTION: ${x.subsection || x.major_section || ""}
CHUNK: ${x.chunk_id}
EVIDENCE:
${x.text || ""}`
      )
      .join("\n\n");
  } catch (error) {
    console.error("NADRA verification evidence selection failed:", error);
    return "";
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
            `ISSUE DATE: ${issueDate}`,
            `EFFECTIVE DATE: ${effectiveDate}`,
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
        `ISSUE DATE: ${issueDate}`,
        `EFFECTIVE DATE: ${effectiveDate}`,
        "",
        ...ranked.map(
          (x, i) =>
            `[NADRA URDU EVIDENCE ${i + 1}]\nChunk: ${x.index + 1}\nRetrieval score: ${x.score}\n\n${x.text.slice(0, 2400)}`
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
          `ISSUE DATE: ${issueDate}`,
          `EFFECTIVE DATE: ${effectiveDate}`,
          "",
          ...targeted.map(
            (item, i) =>
              `[NADRA POLICY TARGETED EVIDENCE ${i + 1}]\nPage: ${item.page ?? "N/A"}\nSection: ${item.major_section || item.subsection || ""}\n\n${(item.text || "").slice(0, 4000)}`
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
