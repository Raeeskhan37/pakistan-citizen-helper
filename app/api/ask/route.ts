import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_MODEL = "openai/gpt-oss-120b";

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

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s/.-]/gu, " ")
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
  "could",
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
  "process",
  "procedure",
  "information",
  "service",
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
  "طریقہ",
  "کار",
  "معلومات",
]);

function questionTokens(question: string): string[] {
  return tokenize(question).filter((word) => !STOP_WORDS.has(word));
}

/* ============================================================
   SERVICE GROUPS
   ============================================================ */

const SERVICE_GROUPS: Record<string, string[]> = {
  CNIC: [
    "cnic",
    "nic",
    "smart cnic",
    "cnic nadra",
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
    "emigration",
    "emigrant",
    "overseas employment",
    "work visa",
    "employment visa",
    "پروٹیکٹر",
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

/* ============================================================
   EXACT TOPIC GROUPS
   This is the major improvement.
   ============================================================ */

const TOPIC_GROUPS: Record<string, string[]> = {
  "CNIC New": [
    "new cnic",
    "first cnic",
    "first time cnic",
    "apply for cnic",
    "new identity card",
    "نیا شناختی کارڈ",
    "نئے شناختی کارڈ",
    "پہلی بار شناختی کارڈ",
  ],

  "CNIC Renewal": [
    "cnic renewal",
    "renew cnic",
    "renewal of cnic",
    "renew my cnic",
    "شناختی کارڈ کی تجدید",
    "شناختی کارڈ تجدید",
  ],

  "CNIC Modification": [
    "cnic modification",
    "modify cnic",
    "modify my cnic",
    "change information on cnic",
    "update information on cnic",
    "correct information on cnic",
    "شناختی کارڈ میں ترمیم",
    "شناختی کارڈ کی معلومات درست",
  ],

  "CNIC Father's Name": [
    "father name",
    "father's name",
    "fathers name",
    "father name correction",
    "correct father name",
    "change father name",
    "dad name",
    "والد کا نام",
    "والد کے نام",
    "والد کا نام درست",
  ],

  "CNIC Mother's Name": [
    "mother name",
    "mother's name",
    "mothers name",
    "mother name correction",
    "correct mother name",
    "change mother name",
    "mom name",
    "والدہ کا نام",
    "والدہ کے نام",
    "والدہ کا نام درست",
  ],

  "CNIC Date of Birth": [
    "date of birth",
    "dob",
    "birth date",
    "correct date of birth",
    "change date of birth",
    "wrong date of birth",
    "age correction",
    "age modification",
    "date birth correction",
    "تاریخ پیدائش",
    "تاریخ پیدائش درست",
    "عمر کی درستگی",
    "عمر میں ترمیم",
  ],

  "CNIC Name": [
    "change name",
    "name correction",
    "correct my name",
    "change my name",
    "wrong name",
    "name on cnic",
    "نام کی تبدیلی",
    "نام درست",
    "نام کی درستگی",
  ],

  "CNIC Address": [
    "address change",
    "change address",
    "address correction",
    "correct address",
    "new address",
    "change my address",
    "address on cnic",
    "پتہ تبدیل",
    "پتہ کی تبدیلی",
    "پتہ درست",
    "پتے کی درستگی",
  ],

  "CNIC Lost/Reprint": [
    "lost cnic",
    "lost my cnic",
    "duplicate cnic",
    "reprint cnic",
    "replacement cnic",
    "damaged cnic",
    "شناختی کارڈ گم",
    "گمشدہ شناختی کارڈ",
    "شناختی کارڈ دوبارہ",
  ],

  "CNIC Fee": [
    "cnic fee",
    "cnic fees",
    "modification fee",
    "renewal fee",
    "smart cnic fee",
    "شناختی کارڈ فیس",
    "ترمیم فیس",
  ],

  "CNIC Processing Time": [
    "cnic processing time",
    "how long cnic",
    "cnic delivery time",
    "modification processing time",
    "processing time",
    "شناختی کارڈ کتنے دن",
    "پروسیسنگ ٹائم",
  ],

  "Passport New": [
    "new passport",
    "apply passport",
    "first passport",
    "نیا پاسپورٹ",
    "پاسپورٹ بنوانا",
  ],

  "Domicile": [
    "domicile",
    "domicile certificate",
    "ڈومیسائل",
  ],

  "Driving Licence": [
    "driving licence",
    "driving license",
    "driving licence renewal",
    "ڈرائیونگ لائسنس",
  ],

  "Scholarship": [
    "scholarship",
    "scholarship eligibility",
    "scholarship application",
    "scholarship deadline",
    "scholarship amount",
    "اسکالرشپ",
    "وظیفہ",
  ],

  "Government Job": [
    "government job",
    "government jobs",
    "govt job",
    "سرکاری ملازمت",
    "سرکاری نوکری",
  ],
};

/* ============================================================
   NORMALIZE DATABASE SERVICE
   ============================================================ */

function normalizeServiceName(serviceName: string): string {
  const value = normalize(serviceName);

  if (
    value.includes("cnic") ||
    value.includes("identity card") ||
    value.includes("national identity") ||
    value.includes("شناختی")
  ) {
    return "CNIC";
  }

  if (
    value.includes("passport") ||
    value.includes("پاسپورٹ")
  ) {
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

  if (
    value.includes("domicile") ||
    value.includes("ڈومیسائل")
  ) {
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

/* ============================================================
   DETECT SERVICE
   ============================================================ */

function detectServiceFromQuestion(
  question: string,
  records: VerifiedRecord[]
): string | null {
  const q = normalize(question);

  let bestService: string | null = null;
  let bestScore = 0;

  for (const [serviceGroup, aliases] of Object.entries(
    SERVICE_GROUPS
  )) {
    let score = 0;

    for (const alias of aliases) {
      const a = normalize(alias);

      if (a && q.includes(a)) {
        score += a.length >= 8 ? 20 : 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestService = serviceGroup;
    }
  }

  const databaseServices = Array.from(
    new Set(
      records
        .map((record) => record.service_name)
        .filter(Boolean)
    )
  ) as string[];

  for (const databaseService of databaseServices) {
    const normalizedDatabaseService =
      normalizeServiceName(databaseService);

    const databaseText = normalize(databaseService);

    let score = 0;

    if (q.includes(databaseText)) {
      score += 40;
    }

    const aliases =
      SERVICE_GROUPS[normalizedDatabaseService] || [];

    for (const alias of aliases) {
      if (q.includes(normalize(alias))) {
        score += 15;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestService = normalizedDatabaseService;
    }
  }

  return bestScore >= 10 ? bestService : null;
}

/* ============================================================
   DETECT EXACT TOPIC
   ============================================================ */

function detectTopic(question: string): string | null {
  const q = normalize(question);

  let bestTopic: string | null = null;
  let bestScore = 0;

  for (const [topic, aliases] of Object.entries(
    TOPIC_GROUPS
  )) {
    let score = 0;

    for (const alias of aliases) {
      const a = normalize(alias);

      if (!a) continue;

      if (q.includes(a)) {
        /*
         * Long, specific phrases get much more weight.
         * This prevents "CNIC modification" from beating
         * "father's name correction".
         */
        score += a.length >= 12 ? 40 : a.length >= 7 ? 25 : 15;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }

  return bestScore >= 15 ? bestTopic : null;
}

/* ============================================================
   JURISDICTION
   ============================================================ */

function detectJurisdiction(
  question: string
): string | null {
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

/* ============================================================
   TOPIC MATCHING
   ============================================================ */

function recordMatchesTopic(
  record: VerifiedRecord,
  topic: string
): boolean {
  const topicWords = TOPIC_GROUPS[topic] || [];

  const recordText = normalize(
    [
      record.category,
      record.title,
      record.title_urdu,
      record.content,
      record.content_urdu,
    ].join(" ")
  );

  return topicWords.some((alias) =>
    recordText.includes(normalize(alias))
  );
}

/* ============================================================
   RECORD SCORING
   ============================================================ */

function scoreRecord(
  question: string,
  record: VerifiedRecord,
  detectedTopic: string | null
): number {
  const q = normalize(question);

  const title = normalize(
    `${record.title ?? ""} ${record.title_urdu ?? ""}`
  );

  const category = normalize(record.category);

  const service = normalize(
    `${record.service_name ?? ""} ${
      record.service_name_urdu ?? ""
    }`
  );

  const content = normalize(
    `${record.content ?? ""} ${
      record.content_urdu ?? ""
    }`
  );

  const tokens = questionTokens(q);

  let score = 0;

  /* Exact topic match is extremely important */
  if (detectedTopic && recordMatchesTopic(record, detectedTopic)) {
    score += 100;
  }

  /* Category */
  for (const token of tokens) {
    if (category.includes(token)) {
      score += 12;
    }
  }

  /* Title */
  for (const token of tokens) {
    if (title.includes(token)) {
      score += 15;
    }
  }

  /* Service */
  for (const token of tokens) {
    if (service.includes(token)) {
      score += 6;
    }
  }

  /* Content */
  for (const token of tokens) {
    if (content.includes(token)) {
      score += 2;
    }
  }

  return score;
}

/* ============================================================
   SELECT RECORDS
   ============================================================ */

function selectRecords(
  question: string,
  requestedService: string,
  records: VerifiedRecord[]
): {
  records: VerifiedRecord[];
  detectedService: string | null;
  detectedTopic: string | null;
  jurisdiction: string | null;
} {
  const detectedService =
    detectServiceFromQuestion(question, records);

  const detectedTopic = detectTopic(question);

  const jurisdiction =
    detectJurisdiction(question);

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

  /* ----------------------------------------------------------
     STEP 1: SERVICE FILTER
     ---------------------------------------------------------- */

  if (serviceToUse) {
    const serviceRecords = working.filter((record) => {
      const databaseService =
        normalizeServiceName(
          record.service_name || ""
        );

      return databaseService === serviceToUse;
    });

    if (serviceRecords.length > 0) {
      working = serviceRecords;
    }
  }

  /* ----------------------------------------------------------
     STEP 2: EXACT TOPIC FILTER
     ---------------------------------------------------------- */

  if (detectedTopic) {
    const topicRecords = working.filter((record) =>
      recordMatchesTopic(record, detectedTopic)
    );

    /*
     * Very important:
     *
     * If an exact topic record exists, DO NOT mix it with
     * unrelated general records.
     */
    if (topicRecords.length > 0) {
      working = topicRecords;
    }
  }

  /* ----------------------------------------------------------
     STEP 3: JURISDICTION
     ---------------------------------------------------------- */

  if (jurisdiction) {
    const jurisdictionRecords =
      working.filter((record) => {
        const province = normalize(record.province);
        const requested =
          normalize(jurisdiction);

        return (
          province.includes(requested) ||
          requested.includes(province) ||
          province === "pakistan"
        );
      });

    if (jurisdictionRecords.length > 0) {
      working = jurisdictionRecords;
    }
  }

  /* ----------------------------------------------------------
     STEP 4: SCORE
     ---------------------------------------------------------- */

  const scored = working
    .map((record) => ({
      record,
      score: scoreRecord(
        question,
        record,
        detectedTopic
      ),
    }))
    .sort((a, b) => b.score - a.score);

  /*
   * If an exact topic was detected and matching records
   * exist, only return those records.
   */
  if (detectedTopic && scored.length > 0) {
    return {
      records: scored
        .slice(0, 8)
        .map((item) => item.record),
      detectedService,
      detectedTopic,
      jurisdiction,
    };
  }

  return {
    records: scored
      .slice(0, 12)
      .map((item) => item.record),
    detectedService,
    detectedTopic,
    jurisdiction,
  };
}

/* ============================================================
   VERIFIED CONTEXT
   ============================================================ */

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

Service:
${record.service_name || ""}

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

/* ============================================================
   FALLBACK
   ============================================================ */

function noVerifiedInformation(
  language: "English" | "Urdu"
): string {
  if (language === "Urdu") {
    return "اس سوال کے بارے میں ہمارے تصدیق شدہ سرکاری ریکارڈ میں کافی مخصوص معلومات موجود نہیں ہیں۔ براہ کرم نادرا کی سرکاری ہدایات سے تصدیق کریں۔";
  }

  return "Our verified government records do not currently contain enough specific information to answer this question. Please check the official government source for the current requirements.";
}

/* ============================================================
   URDU PROTECTION
   ============================================================ */

function protectUrdu(text: string): string {
  return text
    .replace(/شناختی کارڈ/gi, "شناختی کارڈ")
    .replace(/ڈرائیونگ لائسنس/gi, "ڈرائیونگ لائسنس")
    .replace(/پاسپورٹ/gi, "پاسپورٹ")
    .replace(/ڈومیسائل/gi, "ڈومیسائل")
    .replace(/اسکالرشپ/gi, "اسکالرشپ")
    .replace(
      /پروٹیکٹر/gi,
      "پروٹیکٹر آف ایمیگرنٹس"
    );
}

/* ============================================================
   POST
   ============================================================ */

export async function POST(
  request: NextRequest
) {
  try {
    const SUPABASE_URL =
      process.env.SUPABASE_URL;

    const SUPABASE_ANON_KEY =
      process.env.SUPABASE_ANON_KEY;

    const GROQ_API_KEY =
      process.env.GROQ_API_KEY;

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
          GROQ_API_KEY: !GROQ_API_KEY,
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

    const body =
      await request.json();

    const question =
      String(body.question ?? "").trim();

    const requestedService =
      String(body.service ?? "").trim();

    const requestedLanguage =
      String(body.language ?? "").trim();

    if (!question) {
      return NextResponse.json(
        {
          error:
            "Please enter a question.",
        },
        { status: 400 }
      );
    }

    const language:
      | "English"
      | "Urdu" =
      requestedLanguage.toLowerCase() ===
        "urdu" ||
      isUrdu(question)
        ? "Urdu"
        : "English";

    /* --------------------------------------------------------
       SUPABASE
       -------------------------------------------------------- */

    const supabaseUrl =
      `${SUPABASE_URL}/rest/v1/verified_information` +
      `?select=*&active=eq.true`;

    const supabaseResponse =
      await fetch(supabaseUrl, {
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
      });

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

    /* --------------------------------------------------------
       SELECT MOST RELEVANT RECORDS
       -------------------------------------------------------- */

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

    const verifiedContext =
      buildVerifiedContext(
        relevantRecords,
        language
      );

    const sourceRecord =
      relevantRecords.find(
        (record) =>
          record.official_source_url
      ) ||
      relevantRecords[0];

    const source: SourceInfo | null =
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

    /* ========================================================
       STRICT ANSWER PROMPT
       ======================================================== */

    const systemPrompt = `
You are Pakistan Citizen Helper.

Your job is to answer Pakistani government-service
questions using ONLY the verified records supplied below.

============================================================
MOST IMPORTANT RULE: ANSWER THE EXACT QUESTION
============================================================

The user wants a focused answer to the specific question.

Do NOT write a general article about the whole service.

Identify the exact subject of the question and answer ONLY
that subject.

Examples:

If the user asks:

"My father's name is wrong on my CNIC. How can I correct it?"

Answer only about father's-name correction.

Do NOT explain:
- address correction
- date-of-birth correction
- general CNIC modification
- CNIC renewal
- lost CNIC
- unrelated fees

If the user asks:

"My date of birth is wrong on my CNIC."

Answer only about date-of-birth correction.

If the user asks:

"How can I change my address on CNIC?"

Answer only about address modification.

If the user asks:

"What is the fee?"

Answer only the relevant fee.

If the user asks:

"How long does it take?"

Answer only the relevant processing time.

============================================================
DO NOT MIX RECORDS
============================================================

When the supplied verified records contain an exact
topic-specific record, prioritize that record.

Do NOT combine unrelated records merely because they belong
to the same department or service.

For example:

Father's Name record + Address record

must NOT become one combined answer about both topics.

============================================================
VERIFIED INFORMATION ONLY
============================================================

Use ONLY facts present in the supplied VERIFIED RECORDS.

Never invent:

- documents
- fees
- deadlines
- eligibility
- processing times
- addresses
- office locations
- procedures
- legal requirements
- age limits
- government rules

If the requested detail is absent, say briefly:

"The verified record does not currently contain the specific
requirement."

Then direct the user to the official source.

============================================================
DO NOT ASSUME
============================================================

Do not assume that a general CNIC modification rule applies
to every type of modification.

Do not assume that documents required for one type of
correction are required for another.

Do not assume fees or processing times.

============================================================
ANSWER LENGTH
============================================================

Keep answers concise and directly useful.

Normally use approximately 3-8 short paragraphs or bullets.

Do NOT create all of these sections automatically:

What it is
Eligibility
Required documents
How to apply
Fee
Processing time
Where to apply

Only include a section if it directly answers the user's
question AND the verified records contain information for it.

============================================================
QUESTION-SPECIFIC ANSWER
============================================================

The detected topic is:

${selected.detectedTopic || "Not specifically detected"}

The detected service is:

${selected.detectedService || requestedService || "Not specified"}

The detected jurisdiction is:

${selected.jurisdiction || "Not specified"}

Use this information to keep the answer focused.

============================================================
URDU
============================================================

If the requested language is Urdu:

- Answer in Pakistani Urdu.
- Use Urdu script.
- Do not use Hindi/Devanagari.
- Keep official names and URLs where appropriate.
- Keep the answer concise.

============================================================
OFFICIAL SOURCE
============================================================

The application will separately display the official source.

Do not create fake URLs.

============================================================
VERIFIED RECORDS
============================================================

${verifiedContext}
`;

    const userPrompt = `
Exact user question:

${question}

Selected service:

${requestedService || "Not specified"}

Detected topic:

${selected.detectedTopic || "Not detected"}

Detected service:

${selected.detectedService || "Not detected"}

Detected jurisdiction:

${selected.jurisdiction || "Not specified"}

Language:

${language}

Answer ONLY the exact question asked.

Do not add unrelated information.

Do not invent missing information.
`;

    /* --------------------------------------------------------
       GROQ
       -------------------------------------------------------- */

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
            temperature: 0.1,
            max_completion_tokens: 900,
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
