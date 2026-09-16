import { NextResponse } from "next/server";

type ServiceRecord = {
  id?: number;
  service_name?: string;
  category?: string;
  title?: string;
  content_en?: string;
  content_ur?: string;
  province?: string;
  official_department?: string;
  official_source_title?: string;
  official_source_url?: string;
  last_verified?: string;
  active?: boolean;
};

type RankedRecord = {
  record: ServiceRecord;
  score: number;
};

// ============================================================
// TEXT NORMALIZATION
// ============================================================

function normalize(value: string = ""): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ASCII-safe normalization used only for fallback comparisons.
// This avoids relying on Unicode regex in older build targets.
function normalizeAscii(value: string = ""): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// COMMON SERVICE GROUPS
// ============================================================

const SERVICE_GROUPS: Record<string, string[]> = {
  cnic: [
    "cnic",
    "smart cnic",
    "nadra",
    "identity card",
    "national identity card",
    "nic",
    "pakid",
    "family registration certificate",
    "frc",
    "crc",
    "b form",
    "juvenile card",
    "nicop",
    "poc",
  ],

  union_council: [
    "union council",
    "local government",
    "birth certificate",
    "death certificate",
    "marriage certificate",
    "divorce certificate",
    "civil registration",
  ],

  excise: [
    "excise",
    "excise and taxation",
    "vehicle registration",
    "vehicle transfer",
    "vehicle token tax",
    "token tax",
    "vehicle",
    "motor vehicle",
  ],

  police: [
    "police",
    "police verification",
    "character certificate",
    "police clearance",
    "fir",
    "first information report",
  ],

  passport: [
    "passport",
    "passport office",
    "immigration",
    "pakistani passport",
  ],

  protector: [
    "protector",
    "protector of emigrants",
    "overseas employment",
    "emigration",
    "emigrant",
    "bureau of emigration",
  ],

  education: [
    "scholarship",
    "scholarships",
    "education",
    "student",
    "university",
    "college",
    "education scholarship",
  ],

  land: [
    "land",
    "land record",
    "revenue",
    "property",
    "mutation",
    "intiqal",
    "fard",
    "registry",
    "ownership",
  ],

  fbr: [
    "fbr",
    "tax",
    "taxation",
    "income tax",
    "sales tax",
    "ntn",
    "filer",
    "taxpayer",
    "iris",
  ],

  domicile: [
    "domicile",
    "domicile certificate",
  ],

  jobs: [
    "government job",
    "government jobs",
    "govt job",
    "government vacancy",
    "vacancy",
    "vacancies",
    "recruitment",
    "public service",
    "job",
  ],
};

// ============================================================
// TOPIC / INTENT GROUPS
// ============================================================

const TOPIC_GROUPS: Record<string, string[]> = {
  new: [
    "new",
    "first",
    "first time",
    "apply",
    "application",
    "obtain",
    "get",
    "make",
  ],

  renewal: [
    "renew",
    "renewal",
    "renew my",
    "expired",
    "expiry",
    "extension",
  ],

  modification: [
    "modify",
    "modification",
    "change",
    "changed",
    "update",
    "correction",
    "correct",
    "incorrect",
    "wrong",
    "amend",
    "amendment",
  ],

  name: [
    "name",
    "full name",
    "given name",
    "surname",
  ],

  father_name: [
    "father",
    "father name",
    "father's name",
    "fathers name",
    "paternal",
  ],

  mother_name: [
    "mother",
    "mother name",
    "mother's name",
    "mothers name",
    "maternal",
  ],

  dob: [
    "date of birth",
    "dob",
    "birth date",
    "birthdate",
    "age",
  ],

  address: [
    "address",
    "residential address",
    "permanent address",
    "present address",
    "home address",
  ],

  lost: [
    "lost",
    "loss",
    "missing",
    "stolen",
    "damaged",
    "duplicate",
    "reprint",
    "replacement",
  ],

  fee: [
    "fee",
    "fees",
    "cost",
    "price",
    "charges",
    "how much",
    "payment",
  ],

  processing_time: [
    "processing time",
    "how long",
    "how many days",
    "days",
    "delivery time",
    "delivery",
    "urgent",
    "normal",
    "executive",
    "fast",
  ],

  documents: [
    "document",
    "documents",
    "required document",
    "requirements",
    "required",
    "proof",
    "evidence",
    "papers",
  ],

  eligibility: [
    "eligible",
    "eligibility",
    "who can",
    "who is eligible",
    "qualification",
    "criteria",
  ],

  procedure: [
    "how",
    "procedure",
    "process",
    "steps",
    "apply",
    "application",
    "method",
  ],

  online: [
    "online",
    "website",
    "portal",
    "pakid",
    "digital",
    "app",
    "internet",
  ],

  office: [
    "office",
    "where",
    "location",
    "center",
    "centre",
    "branch",
  ],

  status: [
    "status",
    "track",
    "tracking",
    "check application",
    "application status",
  ],
};

// ============================================================
// PROVINCES / JURISDICTIONS
// ============================================================

const JURISDICTIONS: Record<string, string[]> = {
  Punjab: ["punjab"],
  Sindh: ["sindh"],
  Balochistan: ["balochistan"],
  "Khyber Pakhtunkhwa": [
    "khyber pakhtunkhwa",
    "khyber-pakhtunkhwa",
    "kpk",
    "kp",
  ],
  Islamabad: [
    "islamabad",
    "ict",
    "islamabad capital territory",
  ],
  "Gilgit-Baltistan": [
    "gilgit",
    "gilgit baltistan",
    "gilgit-baltistan",
    "gb",
  ],
  "Azad Jammu and Kashmir": [
    "azad kashmir",
    "ajk",
    "azad jammu",
  ],
};

// ============================================================
// STOP WORDS
// ============================================================

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "am",
  "was",
  "were",
  "be",
  "been",
  "being",
  "to",
  "of",
  "for",
  "in",
  "on",
  "at",
  "with",
  "and",
  "or",
  "my",
  "me",
  "i",
  "you",
  "your",
  "can",
  "could",
  "would",
  "should",
  "please",
  "how",
  "what",
  "where",
  "when",
  "why",
  "do",
  "does",
  "did",
  "this",
  "that",
  "it",
  "about",
]);

// ============================================================
// TOKENIZATION
// ============================================================

function getTokens(value: string): string[] {
  return normalizeAscii(value)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(
      (word) =>
        word.length >= 3 &&
        !STOP_WORDS.has(word)
    );
}

// ============================================================
// SERVICE DETECTION
// ============================================================

function detectServiceFromQuestion(
  question: string
): string | null {
  const text = normalize(question);

  let bestService: string | null = null;
  let bestScore = 0;

  for (const [service, aliases] of Object.entries(
    SERVICE_GROUPS
  )) {
    let score = 0;

    for (const alias of aliases) {
      const normalizedAlias =
        normalize(alias);

      if (!normalizedAlias) continue;

      if (text.includes(normalizedAlias)) {
        score += normalizedAlias.split(" ").length * 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestService = service;
    }
  }

  return bestService;
}

// ============================================================
// SELECTED SERVICE FROM FRONTEND
// ============================================================

function detectSelectedService(body: any): string | null {
  const possibleValues = [
    body?.service,
    body?.selectedService,
    body?.serviceName,
    body?.department,
    body?.selectedDepartment,
  ];

  for (const value of possibleValues) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      const detected =
        normalizeServiceFromRecordName(value);

      if (detected) return detected;
    }
  }

  return null;
}

function normalizeServiceFromRecordName(
  value: string
): string | null {
  const text = normalize(value);

  let best: string | null = null;
  let bestScore = 0;

  for (const [group, aliases] of Object.entries(
    SERVICE_GROUPS
  )) {
    let score = 0;

    for (const alias of aliases) {
      if (
        text.includes(normalize(alias))
      ) {
        score += normalize(alias).split(" ").length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = group;
    }
  }

  return best;
}

// ============================================================
// TOPIC / INTENT DETECTION
// ============================================================

function detectTopics(question: string): string[] {
  const text = normalize(question);

  const found: Array<{
    topic: string;
    score: number;
  }> = [];

  for (const [topic, aliases] of Object.entries(
    TOPIC_GROUPS
  )) {
    let score = 0;

    for (const alias of aliases) {
      const normalizedAlias =
        normalize(alias);

      if (
        normalizedAlias &&
        text.includes(normalizedAlias)
      ) {
        score +=
          normalizedAlias.split(" ").length * 3;
      }
    }

    if (score > 0) {
      found.push({
        topic,
        score,
      });
    }
  }

  return found
    .sort((a, b) => b.score - a.score)
    .map((item) => item.topic);
}

// ============================================================
// JURISDICTION DETECTION
// ============================================================

function detectJurisdiction(
  question: string,
  body: any
): string | null {
  const bodyProvince =
    typeof body?.province === "string"
      ? body.province.trim()
      : "";

  if (bodyProvince) {
    for (const [province, aliases] of Object.entries(
      JURISDICTIONS
    )) {
      if (
        aliases.some(
          (alias) =>
            normalize(alias) ===
            normalize(bodyProvince)
        )
      ) {
        return province;
      }
    }

    return bodyProvince;
  }

  const text = normalize(question);

  for (const [province, aliases] of Object.entries(
    JURISDICTIONS
  )) {
    if (
      aliases.some((alias) =>
        text.includes(normalize(alias))
      )
    ) {
      return province;
    }
  }

  return null;
}

// ============================================================
// QUESTION INTENT TERMS
// ============================================================

function getQuestionIntentTerms(
  question: string
): string[] {
  const topics = detectTopics(question);

  const terms = new Set<string>();

  for (const topic of topics) {
    const aliases =
      TOPIC_GROUPS[topic] || [];

    for (const alias of aliases) {
      for (const token of getTokens(alias)) {
        terms.add(token);
      }
    }
  }

  for (const token of getTokens(question)) {
    terms.add(token);
  }

  return Array.from(terms);
}

// ============================================================
// SERVICE MATCHING
// ============================================================

function recordServiceMatches(
  record: ServiceRecord,
  service: string | null
): boolean {
  if (!service) return true;

  const recordService =
    normalizeServiceFromRecordName(
      record.service_name || ""
    );

  return recordService === service;
}

// ============================================================
// TOPIC MATCHING
// ============================================================

function scoreTopicMatch(
  record: ServiceRecord,
  question: string
): number {
  const text = normalize(
    [
      record.service_name,
      record.category,
      record.title,
      record.content_en,
      record.content_ur,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const topics =
    detectTopics(question);

  let score = 0;

  for (const topic of topics) {
    const aliases =
      TOPIC_GROUPS[topic] || [];

    for (const alias of aliases) {
      const normalizedAlias =
        normalize(alias);

      if (
        normalizedAlias &&
        text.includes(normalizedAlias)
      ) {
        score +=
          normalizedAlias.split(" ").length * 10;
      }
    }
  }

  return score;
}

// ============================================================
// DATE / FRESHNESS
// ============================================================

function freshnessScore(
  lastVerified?: string
): number {
  if (!lastVerified) return 0;

  const date =
    new Date(lastVerified).getTime();

  if (Number.isNaN(date)) return 0;

  const ageDays =
    (Date.now() - date) /
    (1000 * 60 * 60 * 24);

  if (ageDays < 0) return 20;
  if (ageDays <= 30) return 20;
  if (ageDays <= 90) return 15;
  if (ageDays <= 180) return 10;
  if (ageDays <= 365) return 5;

  return 0;
}

// ============================================================
// RECORD SCORING
// ============================================================

function scoreRecord(
  record: ServiceRecord,
  question: string,
  service: string | null,
  jurisdiction: string | null
): number {
  const q = normalize(question);
  const qAscii = normalizeAscii(question);

  const serviceName =
    normalize(record.service_name || "");

  const category =
    normalize(record.category || "");

  const title =
    normalize(record.title || "");

  const contentEn =
    normalize(record.content_en || "");

  const contentUr =
    normalize(record.content_ur || "");

  const allText = [
    serviceName,
    category,
    title,
    contentEn,
    contentUr,
  ].join(" ");

  const allTextAscii =
    normalizeAscii(allText);

  let score = 0;

  // ----------------------------------------------------------
  // Service
  // ----------------------------------------------------------

  if (
    service &&
    recordServiceMatches(record, service)
  ) {
    score += 100;
  }

  // ----------------------------------------------------------
  // Exact question phrase
  // ----------------------------------------------------------

  if (
    q.length >= 8 &&
    title.includes(q)
  ) {
    score += 100;
  }

  if (
    q.length >= 8 &&
    category.includes(q)
  ) {
    score += 80;
  }

  // ----------------------------------------------------------
  // Topic / intent
  // ----------------------------------------------------------

  score += scoreTopicMatch(
    record,
    question
  );

  // ----------------------------------------------------------
  // Word overlap
  // ----------------------------------------------------------

  const words =
    getQuestionIntentTerms(question);

  for (const word of words) {
    if (category.includes(word)) {
      score += 15;
    }

    if (title.includes(word)) {
      score += 12;
    }

    if (serviceName.includes(word)) {
      score += 10;
    }

    if (allTextAscii.includes(word)) {
      score += 2;
    }
  }

  // ----------------------------------------------------------
  // Important specific intents
  // ----------------------------------------------------------

  const topics =
    detectTopics(question);

  if (
    topics.includes("father_name") &&
    /father/.test(allText)
  ) {
    score += 70;
  }

  if (
    topics.includes("mother_name") &&
    /mother/.test(allText)
  ) {
    score += 70;
  }

  if (
    topics.includes("dob") &&
    (
      allText.includes("date of birth") ||
      allTextAscii.includes("dob")
    )
  ) {
    score += 70;
  }

  if (
    topics.includes("address") &&
    allText.includes("address")
  ) {
    score += 70;
  }

  if (
    topics.includes("name") &&
    allText.includes("name")
  ) {
    score += 50;
  }

  if (
    topics.includes("fee") &&
    (
      allText.includes("fee") ||
      allText.includes("fees") ||
      allText.includes("cost")
    )
  ) {
    score += 60;
  }

  if (
    topics.includes("processing_time") &&
    (
      allText.includes("processing") ||
      allText.includes("time") ||
      allText.includes("days")
    )
  ) {
    score += 60;
  }

  if (
    topics.includes("documents") &&
    (
      allText.includes("document") ||
      allText.includes("requirement")
    )
  ) {
    score += 60;
  }

  // ----------------------------------------------------------
  // Jurisdiction
  // ----------------------------------------------------------

  if (jurisdiction) {
    const province =
      normalize(record.province || "");

    const wanted =
      normalize(jurisdiction);

    if (province === wanted) {
      score += 60;
    } else if (
      province === "pakistan" ||
      province === "federal"
    ) {
      score += 25;
    }
  }

  // ----------------------------------------------------------
  // Official source
  // ----------------------------------------------------------

  if (record.official_source_url) {
    score += 10;
  }

  if (record.official_department) {
    score += 5;
  }

  // ----------------------------------------------------------
  // Active record
  // ----------------------------------------------------------

  if (record.active !== false) {
    score += 10;
  }

  // ----------------------------------------------------------
  // Freshness
  // ----------------------------------------------------------

  score += freshnessScore(
    record.last_verified
  );

  return score;
}

// ============================================================
// SELECT VERIFIED RECORDS
// ============================================================

function selectRecords(
  records: ServiceRecord[],
  question: string,
  body: any
): RankedRecord[] {
  const detectedService =
    detectServiceFromQuestion(question);

  const selectedService =
    detectSelectedService(body);

  const service =
    selectedService ||
    detectedService;

  const jurisdiction =
    detectJurisdiction(
      question,
      body
    );

  let candidates =
    records.filter(
      (record) =>
        record.active !== false
    );

  // ----------------------------------------------------------
  // If UI supplied a service, strongly prefer it.
  // ----------------------------------------------------------

  if (service) {
    const serviceCandidates =
      candidates.filter((record) =>
        recordServiceMatches(
          record,
          service
        )
      );

    if (serviceCandidates.length > 0) {
      candidates = serviceCandidates;
    }
  }

  // ----------------------------------------------------------
  // Score everything remaining.
  // Do NOT hard-filter by topic.
  //
  // This is important:
  // "modify my name" must still reach a broad
  // "personal information correction" record.
  // ----------------------------------------------------------

  const ranked =
    candidates
      .map((record) => ({
        record,
        score: scoreRecord(
          record,
          question,
          service,
          jurisdiction
        ),
      }))
      .sort(
        (a, b) => b.score - a.score
      );

  // ----------------------------------------------------------
  // Remove clearly irrelevant records.
  // ----------------------------------------------------------

  const meaningful =
    ranked.filter(
      (item) => item.score >= 15
    );

  // If nothing passes the threshold, retain the strongest
  // record only when a service was explicitly selected.
  if (
    meaningful.length === 0 &&
    service &&
    ranked.length > 0
  ) {
    return ranked.slice(0, 1);
  }

  // Return enough context for multi-part questions,
  // but avoid flooding Groq with unrelated records.
  return meaningful.slice(0, 8);
}

// ============================================================
// BUILD VERIFIED CONTEXT
// ============================================================

function buildVerifiedContext(
  rankedRecords: RankedRecord[]
): string {
  if (rankedRecords.length === 0) {
    return "NO VERIFIED RECORDS FOUND.";
  }

  return rankedRecords
    .map(
      ({ record }, index) => `
==============================
VERIFIED RECORD ${index + 1}
==============================

Record ID:
${record.id ?? ""}

Service:
${record.service_name || ""}

Category:
${record.category || ""}

Title:
${record.title || ""}

Verified English Information:
${record.content_en || ""}

Verified Urdu Information:
${record.content_ur || ""}

Province / Jurisdiction:
${record.province || ""}

Official Department:
${record.official_department || ""}

Official Source Title:
${record.official_source_title || ""}

Official Source URL:
${record.official_source_url || ""}

Last Verified:
${record.last_verified || ""}

Active:
${record.active !== false ? "Yes" : "No"}
`
    )
    .join("\n");
}

// ============================================================
// SOURCE SELECTION
// ============================================================

function choosePrimarySource(
  rankedRecords: RankedRecord[]
): ServiceRecord | null {
  if (rankedRecords.length === 0) {
    return null;
  }

  const withSources =
    rankedRecords.filter(
      ({ record }) =>
        Boolean(
          record.official_source_url
        )
    );

  if (withSources.length > 0) {
    return withSources[0].record;
  }

  return rankedRecords[0].record;
}

// ============================================================
// POST API
// ============================================================

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const question =
      typeof body.question === "string"
        ? body.question.trim()
        : "";

    const language =
      body.language === "ur"
        ? "ur"
        : "en";

    if (!question) {
      return NextResponse.json(
        {
          answer:
            language === "ur"
              ? "براہ کرم اپنا سوال لکھیں۔"
              : "Please enter your question.",
        },
        { status: 400 }
      );
    }

    // ========================================================
    // ENVIRONMENT VARIABLES
    // ========================================================

    const supabaseUrl =
      process.env.SUPABASE_URL;

    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY;

    const groqApiKey =
      process.env.GROQ_API_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !groqApiKey
    ) {
      console.error(
        "Missing required environment variables."
      );

      return NextResponse.json(
        {
          answer:
            language === "ur"
              ? "سرور کی ترتیب مکمل نہیں ہے۔ براہ کرم Vercel environment variables چیک کریں۔"
              : "Server configuration is incomplete. Please check the Vercel environment variables.",
        },
        { status: 500 }
      );
    }

    // ========================================================
    // GET ACTIVE VERIFIED INFORMATION FROM SUPABASE
    // ========================================================

    const supabaseResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/verified_information?active=eq.true&select=*`,
        {
          method: "GET",
          headers: {
            apikey: supabaseAnonKey,
            Authorization:
              `Bearer ${supabaseAnonKey}`,
            "Content-Type":
              "application/json",
          },
          cache: "no-store",
        }
      );

    if (!supabaseResponse.ok) {
      const errorText =
        await supabaseResponse.text();

      console.error(
        "Supabase error:",
        supabaseResponse.status,
        errorText
      );

      return NextResponse.json(
        {
          answer:
            language === "ur"
              ? "تصدیق شدہ معلومات حاصل کرنے میں مسئلہ پیش آیا۔"
              : "There was a problem retrieving verified information.",
        },
        { status: 500 }
      );
    }

    const records =
      (await supabaseResponse.json()) as ServiceRecord[];

    if (
      !Array.isArray(records) ||
      records.length === 0
    ) {
      return NextResponse.json({
        answer:
          language === "ur"
            ? "اس وقت کوئی فعال تصدیق شدہ سرکاری معلومات دستیاب نہیں ہے۔"
            : "No active verified government information is currently available.",
        source: null,
      });
    }

    // ========================================================
    // SELECT RELEVANT VERIFIED RECORDS
    // ========================================================

    const rankedRecords =
      selectRecords(
        records,
        question,
        body
      );

    if (
      rankedRecords.length === 0
    ) {
      return NextResponse.json({
        answer:
          language === "ur"
            ? "اس سوال کے لیے ہمارے تصدیق شدہ سرکاری ریکارڈ میں کافی معلومات موجود نہیں ہیں۔ براہ کرم متعلقہ سرکاری ذریعہ دیکھیں۔"
            : "Our verified government records do not currently contain enough information to answer this specific question. Please check the relevant official source.",
        source: null,
      });
    }

    const verifiedContext =
      buildVerifiedContext(
        rankedRecords
      );

    const primarySource =
      choosePrimarySource(
        rankedRecords
      );

    const selectedService =
      detectSelectedService(body);

    const detectedService =
      detectServiceFromQuestion(
        question
      );

    const detectedTopics =
      detectTopics(question);

    const jurisdiction =
      detectJurisdiction(
        question,
        body
      );

    // ========================================================
    // STRICT VERIFIED-INFORMATION PROMPT
    // ========================================================

    const systemPrompt = `
You are the Pakistan Citizen Helper,
a government-services information assistant.

Your job is to explain VERIFIED government-service
information supplied to you from the application's
verified Supabase database.

============================================================
MOST IMPORTANT RULE
============================================================

You MUST answer using ONLY the verified records provided
below.

Do NOT use your general knowledge to fill missing facts.

Do NOT invent or guess:

- fees
- documents
- requirements
- procedures
- processing times
- eligibility rules
- office locations
- online application methods
- government rules
- dates
- contact numbers
- URLs
- deadlines

If the supplied verified records do not contain the
information required to answer the user's exact question,
say clearly that the current verified records do not contain
enough information.

============================================================
ANSWER THE EXACT QUESTION
============================================================

Answer ONLY what the user is asking.

Examples:

If the user asks:
"How can I change my name on CNIC?"

Answer about name correction/modification only.

If the user asks:
"How can I change my father's name?"

Answer about father's-name correction only.

If the user asks:
"What documents are required?"

Give documents only if the verified records contain them.

If the user asks:
"What is the fee?"

Give the fee only if a verified record contains the fee.

If the user asks:
"How long does it take?"

Give processing time only if a verified record contains
processing-time information.

Do NOT add unrelated information just because it exists
in another record.

============================================================
MULTIPLE RECORDS
============================================================

Several records may be supplied.

Use multiple records ONLY when they clearly relate to the
same question.

Do not combine unrelated services or topics.

A broad record may be used when it genuinely covers the
specific question.

============================================================
AUTHENTICITY
============================================================

The records below are the application's verified records.

Treat their supplied information as the source of truth.

Prefer the record with the most relevant subject.

When records contain different verification dates for the
same subject, prefer the more recently verified record,
provided it is relevant to the question.

Never claim that information is "latest" merely because
you are an AI.

Use the supplied Last Verified date when useful.

============================================================
JURISDICTION
============================================================

The user's jurisdiction is relevant only where the
government service actually depends on province/local
authority.

Do not introduce provincial information unnecessarily.

============================================================
LANGUAGE
============================================================

Answer in ${
      language === "ur"
        ? "Urdu"
        : "English"
    }.

Keep the answer clear, practical and reasonably concise.

Use bullets or numbered steps when they improve clarity.

============================================================
CURRENT REQUEST CONTEXT
============================================================

Selected service from application:
${selectedService || "Not supplied"}

Service detected from question:
${detectedService || "Not detected"}

Question topics/intents:
${
  detectedTopics.length > 0
    ? detectedTopics.join(", ")
    : "Not specifically detected"
}

Relevant jurisdiction:
${jurisdiction || "Not specified"}

============================================================
VERIFIED RECORDS
============================================================

${verifiedContext}

============================================================
FINAL ANSWER RULE
============================================================

Answer the user's question directly.

If the exact requested information is present:
provide it clearly.

If only partial information is present:
provide only that verified portion and clearly identify
what is not available.

If the requested information is absent:
say that the current verified records do not contain it.

Never compensate for missing verified information by
guessing.
`;

    // ========================================================
    // GROQ
    // ========================================================

    const groqResponse =
      await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${groqApiKey}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            model:
              "openai/gpt-oss-120b",

            temperature: 0,

            max_completion_tokens: 1000,

            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: question,
              },
            ],
          }),
        }
      );

    if (!groqResponse.ok) {
      const errorText =
        await groqResponse.text();

      console.error(
        "Groq error:",
        groqResponse.status,
        errorText
      );

      return NextResponse.json(
        {
          answer:
            language === "ur"
              ? "جواب تیار کرنے میں مسئلہ پیش آیا۔ براہ کرم دوبارہ کوشش کریں۔"
              : "There was a problem generating the answer. Please try again.",
        },
        { status: 500 }
      );
    }

    const groqData =
      await groqResponse.json();

    const answer =
      groqData?.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return NextResponse.json(
        {
          answer:
            language === "ur"
              ? "اس سوال کا جواب تیار نہیں کیا جا سکا۔"
              : "An answer could not be generated for this question.",
        },
        { status: 500 }
      );
    }

    // ========================================================
    // RETURN OFFICIAL SOURCE
    // ========================================================

    return NextResponse.json({
      answer,

      source: primarySource
        ? {
            title:
              primarySource.official_source_title ||
              primarySource.title ||
              "Official Government Source",

            url:
              primarySource.official_source_url ||
              "",

            department:
              primarySource.official_department ||
              "",

            last_verified:
              primarySource.last_verified ||
              "",
          }
        : null,
    });
  } catch (error) {
    console.error(
      "API error:",
      error
    );

    return NextResponse.json(
      {
        answer:
          "An unexpected server error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}
