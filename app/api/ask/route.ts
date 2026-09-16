import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// ENVIRONMENT
// ============================================================

const GROQ_MODEL = "openai/gpt-oss-120b";

// ============================================================
// TYPES
// ============================================================

type VerifiedRecord = {
  id?: number;
  service_name?: string | null;
  category?: string | null;
  title?: string | null;
  content?: string | null;

  service_name_urdu?: string | null;
  title_urdu?: string | null;
  content_urdu?: string | null;

  province?: string | null;

  official_department?: string | null;
  official_source_title?: string | null;
  official_source_url?: string | null;

  last_verified?: string | null;
  active?: boolean | null;
};

type SourceInfo = {
  department?: string;
  title?: string;
  url?: string;
  lastVerified?: string;
  province?: string;
};

// ============================================================
// NORMALIZATION
// ============================================================

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\w\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUrdu(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}

// ============================================================
// STOP WORDS
// ============================================================

const STOP_WORDS = new Set([
  "the",
  "is",
  "are",
  "was",
  "were",
  "how",
  "what",
  "where",
  "when",
  "which",
  "can",
  "may",
  "for",
  "from",
  "with",
  "about",
  "please",
  "tell",
  "me",
  "give",
  "get",
  "my",
  "i",
  "do",
  "does",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "and",
  "or",
  "apply",
  "application",
  "need",
  "required",
  "requirements",
  "document",
  "documents",

  "کے",
  "کی",
  "کا",
  "کو",
  "میں",
  "سے",
  "اور",
  "ہے",
  "ہیں",
  "کیا",
  "کہاں",
  "کیسے",
  "مجھے",
  "لیے",
  "بارے",
  "میرا",
  "میری",
  "درکار",
  "ضروری",
]);

function questionTokens(question: string): string[] {
  return tokenize(question).filter((word) => !STOP_WORDS.has(word));
}

// ============================================================
// SERVICE GROUPS
// ============================================================
//
// IMPORTANT:
// Database names and UI names do not always match exactly.
//
// Example:
// UI       = CNIC / Smart CNIC
// Database = CNIC / NADRA
//
// These aliases allow both to map to the same service family.
// ============================================================

const SERVICE_GROUPS: Record<string, string[]> = {
  CNIC: [
    "cnic",
    "nic",
    "smart cnic",
    "cnic nadra",
    "cnic smart cnic",
    "cnic nadra services",
    "identity card",
    "national identity card",
    "شناختی کارڈ",
    "قومی شناختی کارڈ",
    "نادرا شناختی کارڈ",
  ],

  Passport: [
    "passport",
    "passport services",
    "پاسپورٹ",
  ],

  "Driving Licence": [
    "driving licence",
    "driving license",
    "driving",
    "licence",
    "license",
    "ڈرائیونگ لائسنس",
    "لائسنس",
  ],

  Domicile: [
    "domicile",
    "domicile certificate",
    "ڈومیسائل",
    "ڈومیسائل سرٹیفکیٹ",
  ],

  Scholarships: [
    "scholarship",
    "scholarships",
    "stipend",
    "financial aid",
    "student scholarship",
    "education scholarship",
    "وظیفہ",
    "وظائف",
    "اسکالرشپ",
  ],

  "Protector of Emigrants": [
    "protector",
    "protector of emigrants",
    "protector emigrants",
    "emigration",
    "emigrant",
    "overseas employment",
    "work visa",
    "employment visa",
    "پروٹیکٹر",
    "پروٹیکٹر آف ایمیگرنٹس",
    "ایمیگریشن",
    "بیرون ملک ملازمت",
  ],

  "Union Council / Local Government": [
    "union council",
    "local government",
    "birth certificate",
    "death certificate",
    "marriage certificate",
    "divorce certificate",
    "birth",
    "death",
    "marriage",
    "divorce",
    "یونین کونسل",
    "بلدیاتی",
    "پیدائش",
    "وفات",
    "شادی",
    "طلاق",
  ],

  "Police Services": [
    "police",
    "police verification",
    "character certificate",
    "police certificate",
    "police clearance",
    "پولیس",
    "پولیس ویریفکیشن",
    "کردار سرٹیفکیٹ",
  ],

  "Excise & Taxation": [
    "excise",
    "vehicle registration",
    "vehicle transfer",
    "token tax",
    "vehicle tax",
    "motor vehicle",
    "گاڑی رجسٹریشن",
    "گاڑی",
    "ٹوکن ٹیکس",
    "ایکسائز",
  ],

  "FBR / Taxation": [
    "fbr",
    "tax",
    "income tax",
    "taxpayer",
    "ntn",
    "iris",
    "فیڈرل بورڈ آف ریونیو",
    "ایف بی آر",
    "ٹیکس",
  ],

  "Land & Revenue": [
    "land",
    "land record",
    "revenue",
    "fard",
    "property",
    "mutation",
    "زمین",
    "اراضی",
    "فرد",
    "انتقال",
    "ریونیو",
  ],

  "Government Jobs": [
    "government job",
    "government jobs",
    "govt job",
    "public job",
    "government employment",
    "سرکاری ملازمت",
    "سرکاری نوکری",
  ],
};

// ============================================================
// SERVICE NORMALIZATION
// ============================================================

function normalizeServiceName(serviceName: string): string {
  const value = normalize(serviceName);

  if (
    value.includes("cnic") ||
    value.includes("smart cnic") ||
    value.includes("identity card") ||
    value.includes("national identity") ||
    value.includes("شناختی") ||
    value.includes("نادرا")
  ) {
    return "CNIC";
  }

  if (value.includes("passport") || value.includes("پاسپورٹ")) {
    return "Passport";
  }

  if (
    value.includes("driving") ||
    value.includes("licence") ||
    value.includes("license") ||
    value.includes("ڈرائیونگ")
  ) {
    return "Driving Licence";
  }

  if (value.includes("domicile") || value.includes("ڈومیسائل")) {
    return "Domicile";
  }

  if (
    value.includes("scholarship") ||
    value.includes("stipend") ||
    value.includes("وظیف") ||
    value.includes("اسکالر")
  ) {
    return "Scholarships";
  }

  if (
    value.includes("protector") ||
    value.includes("emigrant") ||
    value.includes("emigration") ||
    value.includes("پروٹیکٹر")
  ) {
    return "Protector of Emigrants";
  }

  if (
    value.includes("union council") ||
    value.includes("local government") ||
    value.includes("یونین کونسل")
  ) {
    return "Union Council / Local Government";
  }

  if (
    value.includes("police") ||
    value.includes("پولیس")
  ) {
    return "Police Services";
  }

  if (
    value.includes("excise") ||
    value.includes("vehicle") ||
    value.includes("token tax") ||
    value.includes("ایکسائز")
  ) {
    return "Excise & Taxation";
  }

  if (
    value.includes("fbr") ||
    value.includes("tax") ||
    value.includes("ntn") ||
    value.includes("iris") ||
    value.includes("ایف بی آر")
  ) {
    return "FBR / Taxation";
  }

  if (
    value.includes("land") ||
    value.includes("revenue") ||
    value.includes("fard") ||
    value.includes("property") ||
    value.includes("زمین") ||
    value.includes("ریونیو")
  ) {
    return "Land & Revenue";
  }

  if (
    value.includes("government job") ||
    value.includes("govt job") ||
    value.includes("سرکاری ملازمت") ||
    value.includes("سرکاری نوکری")
  ) {
    return "Government Jobs";
  }

  return serviceName;
}

// ============================================================
// DETECT SERVICE FROM QUESTION
// ============================================================

function detectServiceFromQuestion(
  question: string,
  records: VerifiedRecord[]
): string | null {
  const q = normalize(question);

  let bestService: string | null = null;
  let bestScore = 0;

  // ----------------------------------------------------------
  // First: explicit service groups
  // ----------------------------------------------------------

  for (const [serviceGroup, aliases] of Object.entries(SERVICE_GROUPS)) {
    let score = 0;

    for (const alias of aliases) {
      const a = normalize(alias);

      if (!a) continue;

      if (q.includes(a)) {
        score += a.length >= 8 ? 20 : 12;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestService = serviceGroup;
    }
  }

  // ----------------------------------------------------------
  // Second: inspect actual database service names
  // ----------------------------------------------------------

  const uniqueServices = Array.from(
    new Set(
      records
        .map((record) => record.service_name)
        .filter(Boolean)
    )
  ) as string[];

  for (const databaseService of uniqueServices) {
    const normalizedDatabaseService =
      normalizeServiceName(databaseService);

    const aliases =
      SERVICE_GROUPS[normalizedDatabaseService] || [];

    let score = 0;

    // Exact database service name
    if (q.includes(normalize(databaseService))) {
      score += 40;
    }

    // Normalized service family
    if (
      normalizedDatabaseService &&
      SERVICE_GROUPS[normalizedDatabaseService]
    ) {
      for (const alias of aliases) {
        if (q.includes(normalize(alias))) {
          score += 15;
        }
      }
    }

    // Individual words
    const serviceWords = tokenize(databaseService);

    for (const word of serviceWords) {
      if (word.length >= 3 && q.includes(word)) {
        score += 6;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestService = normalizedDatabaseService;
    }
  }

  return bestScore >= 10 ? bestService : null;
}

// ============================================================
// DETECT JURISDICTION
// ============================================================

function detectJurisdiction(question: string): string | null {
  const q = normalize(question);

  const jurisdictions = [
    {
      name: "Punjab",
      terms: ["punjab", "پنجاب"],
    },
    {
      name: "Sindh",
      terms: ["sindh", "sind", "سندھ"],
    },
    {
      name: "Khyber Pakhtunkhwa",
      terms: [
        "khyber pakhtunkhwa",
        "kpk",
        "kp",
        "خیبر پختونخوا",
        "خیبرپختونخوا",
      ],
    },
    {
      name: "Islamabad Capital Territory",
      terms: [
        "islamabad",
        "ict",
        "اسلام آباد",
        "اسلامباد",
      ],
    },
    {
      name: "Balochistan",
      terms: ["balochistan", "بلوچستان"],
    },
    {
      name: "Azad Jammu and Kashmir",
      terms: [
        "ajk",
        "azad kashmir",
        "آزاد کشمیر",
        "آزاد جموں و کشمیر",
      ],
    },
    {
      name: "Gilgit-Baltistan",
      terms: [
        "gilgit",
        "gilgit baltistan",
        "گلگت",
        "گلگت بلتستان",
      ],
    },
  ];

  for (const jurisdiction of jurisdictions) {
    for (const term of jurisdiction.terms) {
      if (q.includes(normalize(term))) {
        return jurisdiction.name;
      }
    }
  }

  return null;
}

// ============================================================
// RECORD SCORING
// ============================================================

function scoreRecord(
  question: string,
  record: VerifiedRecord
): number {
  const q = normalize(question);

  const recordText = normalize(
    [
      record.service_name,
      record.service_name_urdu,
      record.category,
      record.title,
      record.title_urdu,
      record.content,
      record.content_urdu,
      record.province,
    ].join(" ")
  );

  const tokens = questionTokens(q);

  let score = 0;

  // General content match
  for (const token of tokens) {
    if (recordText.includes(token)) {
      score += 3;
    }
  }

  // Title is more important
  const title = normalize(
    `${record.title ?? ""} ${record.title_urdu ?? ""}`
  );

  for (const token of tokens) {
    if (title.includes(token)) {
      score += 10;
    }
  }

  // Category
  const category = normalize(record.category);

  for (const token of tokens) {
    if (category.includes(token)) {
      score += 7;
    }
  }

  // Service
  const service = normalize(
    `${record.service_name ?? ""} ${record.service_name_urdu ?? ""}`
  );

  for (const token of tokens) {
    if (service.includes(token)) {
      score += 8;
    }
  }

  return score;
}

// ============================================================
// SELECT RELEVANT RECORDS
// ============================================================

function selectRecords(
  question: string,
  requestedService: string,
  records: VerifiedRecord[]
): {
  records: VerifiedRecord[];
  detectedService: string | null;
  jurisdiction: string | null;
} {
  const detectedService =
    detectServiceFromQuestion(question, records);

  const jurisdiction =
    detectJurisdiction(question);

  // ----------------------------------------------------------
  // Normalize UI service
  // ----------------------------------------------------------

  const normalizedRequestedService =
    requestedService
      ? normalizeServiceName(requestedService)
      : null;

  const normalizedDetectedService =
    detectedService
      ? normalizeServiceName(detectedService)
      : null;

  const serviceToUse =
    normalizedDetectedService ||
    normalizedRequestedService ||
    null;

  let working = [...records];

  // ----------------------------------------------------------
  // SERVICE FILTER
  // ----------------------------------------------------------

  if (serviceToUse) {
    const serviceRecords = working.filter((record) => {
      const databaseService =
        normalizeServiceName(
          record.service_name || ""
        );

      // Example:
      //
      // UI:
      // CNIC / Smart CNIC
      //
      // Database:
      // CNIC / NADRA
      //
      // Both become:
      // CNIC
      //

      if (databaseService === serviceToUse) {
        return true;
      }

      // Direct aliases
      const aliases =
        SERVICE_GROUPS[serviceToUse] || [];

      const databaseText = normalize(
        `${record.service_name ?? ""} ${
          record.service_name_urdu ?? ""
        }`
      );

      return aliases.some((alias) =>
        databaseText.includes(normalize(alias))
      );
    });

    if (serviceRecords.length > 0) {
      working = serviceRecords;
    }
  }

  // ----------------------------------------------------------
  // JURISDICTION FILTER
  // ----------------------------------------------------------

  if (jurisdiction) {
    const jurisdictionRecords = working.filter(
      (record) => {
        const province = normalize(record.province);

        const requested =
          normalize(jurisdiction);

        return (
          province.includes(requested) ||
          requested.includes(province) ||
          province === "pakistan"
        );
      }
    );

    if (jurisdictionRecords.length > 0) {
      working = jurisdictionRecords;
    }
  }

  // ----------------------------------------------------------
  // SCORE
  // ----------------------------------------------------------

  const scored = working
    .map((record) => ({
      record,
      score: scoreRecord(question, record),
    }))
    .sort((a, b) => b.score - a.score);

  // Keep the strongest records
  const useful = scored.filter(
    (item) => item.score > 0
  );

  const selectedRecords =
    useful.length > 0
      ? useful.slice(0, 30).map(
          (item) => item.record
        )
      : scored.slice(0, 30).map(
          (item) => item.record
        );

  return {
    records: selectedRecords,
    detectedService,
    jurisdiction,
  };
}

// ============================================================
// VERIFIED CONTEXT
// ============================================================

function buildVerifiedContext(
  records: VerifiedRecord[],
  language: "English" | "Urdu"
): string {
  return records
    .map((record, index) => {
      const title =
        language === "Urdu"
          ? record.title_urdu ||
            record.title ||
            ""
          : record.title ||
            record.title_urdu ||
            "";

      const content =
        language === "Urdu"
          ? record.content_urdu ||
            record.content ||
            ""
          : record.content ||
            record.content_urdu ||
            "";

      return `
==============================
VERIFIED RECORD ${index + 1}
==============================

ID:
${record.id ?? ""}

Service:
${record.service_name || ""}

Service Urdu:
${record.service_name_urdu || ""}

Category:
${record.category || ""}

Jurisdiction:
${record.province || ""}

Title:
${title}

Verified Information:
${content}

Official Department:
${record.official_department || ""}

Official Source:
${record.official_source_title || ""}

Official URL:
${record.official_source_url || ""}

Last Verified:
${record.last_verified || ""}
`;
    })
    .join("\n");
}

// ============================================================
// FALLBACK ANSWER
// ============================================================

function noVerifiedInformation(
  language: "English" | "Urdu"
): string {
  if (language === "Urdu") {
    return "معذرت، اس سوال کے بارے میں ہمارے تصدیق شدہ سرکاری ریکارڈ میں فی الحال کافی معلومات موجود نہیں ہیں۔ براہ کرم سروس یا متعلقہ صوبہ/علاقہ واضح کریں۔";
  }

  return "Sorry, sufficient verified government information is currently not available for this question. Please specify the service or relevant province/jurisdiction.";
}

// ============================================================
// URDU PROTECTION
// ============================================================

function protectUrdu(text: string): string {
  return text
    .replace(
      /شناختی کارڈ/gi,
      "شناختی کارڈ"
    )
    .replace(
      /ڈرائیونگ لائسنس/gi,
      "ڈرائیونگ لائسنس"
    )
    .replace(
      /پاسپورٹ/gi,
      "پاسپورٹ"
    )
    .replace(
      /ڈومیسائل/gi,
      "ڈومیسائل"
    )
    .replace(
      /اسکالرشپ/gi,
      "اسکالرشپ"
    )
    .replace(
      /پروٹیکٹر/gi,
      "پروٹیکٹر آف ایمیگرنٹس"
    );
}

// ============================================================
// POST /api/ask
// ============================================================

export async function POST(
  request: NextRequest
) {
  try {
    // --------------------------------------------------------
    // READ ENVIRONMENT INSIDE REQUEST
    // --------------------------------------------------------

    const SUPABASE_URL =
      process.env.SUPABASE_URL;

    const SUPABASE_ANON_KEY =
      process.env.SUPABASE_ANON_KEY;

    const GROQ_API_KEY =
      process.env.GROQ_API_KEY;

    // --------------------------------------------------------
    // ENVIRONMENT CHECK
    // --------------------------------------------------------

    if (
      !SUPABASE_URL ||
      !SUPABASE_ANON_KEY ||
      !GROQ_API_KEY
    ) {
      console.error(
        "Missing environment variables:",
        {
          SUPABASE_URL: !SUPABASE_URL,
          SUPABASE_ANON_KEY:
            !SUPABASE_ANON_KEY,
          GROQ_API_KEY:
            !GROQ_API_KEY,
        }
      );

      return NextResponse.json(
        {
          error:
            "Server configuration is incomplete. Check the Vercel environment variables.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------------

    const body =
      await request.json();

    const question =
      String(
        body.question ?? ""
      ).trim();

    const requestedService =
      String(
        body.service ?? ""
      ).trim();

    const requestedLanguage =
      String(
        body.language ?? ""
      ).trim();

    if (!question) {
      return NextResponse.json(
        {
          error:
            "Please enter a question.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // LANGUAGE
    // --------------------------------------------------------

    const language:
      | "English"
      | "Urdu" =
      requestedLanguage.toLowerCase() ===
        "urdu" ||
      isUrdu(question)
        ? "Urdu"
        : "English";

    // --------------------------------------------------------
    // SUPABASE
    // --------------------------------------------------------

    const supabaseUrl =
      `${SUPABASE_URL}/rest/v1/verified_information` +
      `?select=*&active=eq.true`;

    const supabaseResponse =
      await fetch(
        supabaseUrl,
        {
          method: "GET",
          headers: {
            apikey:
              SUPABASE_ANON_KEY,

            Authorization:
              `Bearer ${SUPABASE_ANON_KEY}`,

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
        errorText
      );

      return NextResponse.json(
        {
          error:
            "Unable to retrieve verified information from Supabase.",
        },
        { status: 500 }
      );
    }

    const allRecords =
      (await supabaseResponse.json()) as VerifiedRecord[];

    // --------------------------------------------------------
    // NO RECORDS
    // --------------------------------------------------------

    if (
      !Array.isArray(allRecords) ||
      allRecords.length === 0
    ) {
      return NextResponse.json({
        answer:
          noVerifiedInformation(language),

        source: null,
      });
    }

    // --------------------------------------------------------
    // SELECT RELEVANT RECORDS
    // --------------------------------------------------------

    const selected =
      selectRecords(
        question,
        requestedService,
        allRecords
      );

    const relevantRecords =
      selected.records;

    if (
      relevantRecords.length === 0
    ) {
      return NextResponse.json({
        answer:
          noVerifiedInformation(language),

        source: null,
      });
    }

    // --------------------------------------------------------
    // VERIFIED CONTEXT
    // --------------------------------------------------------

    const verifiedContext =
      buildVerifiedContext(
        relevantRecords,
        language
      );

    // --------------------------------------------------------
    // SOURCE
    // --------------------------------------------------------

    const sourceRecord =
      relevantRecords.find(
        (record) =>
          record.official_source_url
      ) ||
      relevantRecords[0];

    const source:
      | SourceInfo
      | null =
      sourceRecord
        ? {
            department:
              sourceRecord.official_department ||
              "",

            title:
              sourceRecord.official_source_title ||
              sourceRecord.title ||
              "",

            url:
              sourceRecord.official_source_url ||
              "",

            lastVerified:
              sourceRecord.last_verified ||
              "",

            province:
              sourceRecord.province ||
              "",
          }
        : null;

    // --------------------------------------------------------
    // SYSTEM PROMPT
    // --------------------------------------------------------

    const systemPrompt = `
You are Pakistan Citizen Helper.

You provide simple, practical and trustworthy
information about Pakistani government and public services.

============================================================
MOST IMPORTANT RULE
============================================================

ONLY use information contained in the VERIFIED RECORDS.

Never invent or guess:

- fees
- documents
- eligibility
- deadlines
- scholarship amounts
- processing times
- offices
- addresses
- procedures
- age limits
- government rules
- websites
- application requirements

If information is missing, explicitly say that the
verified information does not contain it.

============================================================
SERVICE RULE
============================================================

The application identifies the most likely service
from the user's question.

The UI-selected service and database service names
may be slightly different.

For example:

UI:
CNIC / Smart CNIC

Database:
CNIC / NADRA

These refer to the same CNIC service family.

Use the relevant verified records supplied below.

Do not answer using a different service simply because
the UI selected a different service.

============================================================
JURISDICTION RULE
============================================================

If a question mentions Punjab, Sindh, Khyber Pakhtunkhwa,
Islamabad, Balochistan, AJK or Gilgit-Baltistan, use only
the applicable jurisdiction information where possible.

Do not combine provincial rules.

If rules differ by jurisdiction and the user did not specify
a jurisdiction, clearly tell the user that requirements vary.

============================================================
SCHOLARSHIP RULE
============================================================

For scholarships, only state:

- scholarship name
- eligibility
- education level
- documents
- application method
- deadline
- amount
- participating institution

when those facts exist in the verified records.

Never invent a scholarship deadline or amount.

============================================================
PROTECTOR RULE
============================================================

Protector of Emigrants information concerns overseas
employment/emigration.

Do not claim that every tourist, visit or business visa
requires Protector registration unless the verified records
explicitly say so.

============================================================
ANSWER FORMAT
============================================================

Give a direct answer.

Use headings only when useful:

What it is
Eligibility
Required documents
How to apply
Fee
Processing time
Where to apply
Important information

Do not create empty sections.

============================================================
URDU
============================================================

If language is Urdu:

- use Urdu script
- do not use Hindi/Devanagari
- keep official names and URLs where appropriate
- use simple Pakistani Urdu

============================================================
TRUST
============================================================

If information is unavailable, say so.

Never make an unsupported statement sound official.

============================================================
VERIFIED RECORDS
============================================================

${verifiedContext}
`;

    // --------------------------------------------------------
    // USER PROMPT
    // --------------------------------------------------------

    const userPrompt = `
User question:

${question}

UI selected service:

${requestedService || "Not specified"}

Automatically detected service:

${selected.detectedService || "Not determined"}

Detected jurisdiction:

${selected.jurisdiction || "Not specified"}

Requested language:

${language}

Answer ONLY from the verified records.
`;

    // --------------------------------------------------------
    // GROQ
    // --------------------------------------------------------

    const groqResponse =
      await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${GROQ_API_KEY}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model: GROQ_MODEL,

            temperature: 0,

            max_tokens: 1600,

            messages: [
              {
                role: "system",
                content:
                  systemPrompt,
              },

              {
                role: "user",
                content:
                  userPrompt,
              },
            ],
          }),
        }
      );

    // --------------------------------------------------------
    // GROQ ERROR
    // --------------------------------------------------------

    if (!groqResponse.ok) {
      const errorText =
        await groqResponse.text();

      console.error(
        "Groq error:",
        errorText
      );

      return NextResponse.json(
        {
          error:
            "AI service is temporarily unavailable. Please try again.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // GROQ RESPONSE
    // --------------------------------------------------------

    const groqData =
      await groqResponse.json();

    let answer =
      groqData?.choices?.[0]?.message?.content?.trim() ||
      "";

    if (!answer) {
      answer =
        noVerifiedInformation(
          language
        );
    }

    if (language === "Urdu") {
      answer =
        protectUrdu(answer);
    }

    // --------------------------------------------------------
    // FINAL RESPONSE
    // --------------------------------------------------------

    return NextResponse.json({
      answer,
      source,
    });
  } catch (error) {
    console.error(
      "API /api/ask error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}
