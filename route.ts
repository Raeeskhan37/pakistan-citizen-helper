import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

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
  liveVerified?: boolean;
  checkedAt?: string;
};

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
]);

function questionTokens(question: string): string[] {
  return tokenize(question).filter(
    (word) => !STOP_WORDS.has(word)
  );
}

const SERVICE_ALIASES: Record<string, string[]> = {
  "CNIC / NADRA": [
    "cnic",
    "nic",
    "identity card",
    "شناختی کارڈ",
    "شناختی",
    "nadra",
    "نادرا",
  ],

  Passport: [
    "passport",
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
    "ڈومیسائل",
  ],

  Scholarships: [
    "scholarship",
    "scholarships",
    "stipend",
    "financial aid",
    "student scholarship",
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

  "Other Services": [
    "birth certificate",
    "death certificate",
    "marriage certificate",
    "divorce certificate",
    "character certificate",
    "police verification",
    "vehicle registration",
    "token tax",
    "income tax",
    "fbr",
    "tax",
    "crc",
    "form b",
    "family registration",
    "fard",
    "birth",
    "death",
    "marriage",
    "divorce",
    "character certificate",
    "پیدائش",
    "وفات",
    "شادی",
    "طلاق",
    "کردار سرٹیفکیٹ",
    "پولیس ویریفکیشن",
    "گاڑی رجسٹریشن",
    "ٹیکس",
  ],
};

function detectServiceFromQuestion(
  question: string,
  records: VerifiedRecord[]
): string | null {
  const q = normalize(question);

  let bestService: string | null = null;
  let bestScore = 0;

  for (const [service, aliases] of Object.entries(
    SERVICE_ALIASES
  )) {
    let score = 0;

    for (const alias of aliases) {
      const a = normalize(alias);

      if (!a) continue;

      if (q.includes(a)) {
        score += a.length >= 8 ? 15 : 10;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestService = service;
    }
  }

  const uniqueServices = Array.from(
    new Set(
      records
        .map((record) => record.service_name)
        .filter(Boolean)
    )
  ) as string[];

  for (const service of uniqueServices) {
    const aliases = SERVICE_ALIASES[service] || [];

    let score = 0;

    if (q.includes(normalize(service))) {
      score += 30;
    }

    for (const alias of aliases) {
      if (q.includes(normalize(alias))) {
        score += 15;
      }
    }

    const serviceWords = tokenize(service);

    for (const word of serviceWords) {
      if (q.includes(word)) {
        score += 5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestService = service;
    }
  }

  return bestScore >= 10 ? bestService : null;
}

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

  for (const token of tokens) {
    if (recordText.includes(token)) {
      score += 3;
    }
  }

  const title = normalize(
    `${record.title ?? ""} ${record.title_urdu ?? ""}`
  );

  for (const token of tokens) {
    if (title.includes(token)) {
      score += 7;
    }
  }

  const category = normalize(record.category);

  for (const token of tokens) {
    if (category.includes(token)) {
      score += 5;
    }
  }

  return score;
}

function selectRecords(
  question: string,
  requestedService: string,
  records: VerifiedRecord[],
  profileProvince?: string
): {
  records: VerifiedRecord[];
  detectedService: string | null;
  jurisdiction: string | null;
} {
  const detectedService =
    detectServiceFromQuestion(question, records);

  const detectedJurisdiction = detectJurisdiction(question);

  let serviceToUse =
    detectedService ||
    requestedService ||
    null;

  const jurisdiction =
    detectedJurisdiction ||
    (serviceToUse &&
      serviceNeedsJurisdiction(serviceToUse) &&
      profileProvince
      ? profileProvince
      : null);

  let working = [...records];

  if (serviceToUse) {
    const serviceNormalized =
      normalize(serviceToUse);

    const serviceRecords = working.filter((record) => {
      const databaseService =
        normalize(record.service_name);

      const databaseUrduService =
        normalize(record.service_name_urdu);

      if (
        databaseService === serviceNormalized ||
        databaseUrduService === serviceNormalized
      ) {
        return true;
      }

      if (
        databaseService.includes(serviceNormalized) ||
        serviceNormalized.includes(databaseService)
      ) {
        return true;
      }

      const aliases =
        SERVICE_ALIASES[serviceToUse] || [];

      return aliases.some((alias) => {
        const a = normalize(alias);

        return (
          databaseService.includes(a) ||
          databaseUrduService.includes(a)
        );
      });
    });

    if (serviceRecords.length > 0) {
      working = serviceRecords;
    }
  }

  if (jurisdiction) {
    const jurisdictionRecords =
      working.filter((record) => {
        const province =
          normalize(record.province);

        return (
          province.includes(
            normalize(jurisdiction)
          ) ||
          normalize(jurisdiction).includes(
            province
          ) ||
          province === "pakistan"
        );
      });

    if (jurisdictionRecords.length > 0) {
      working = jurisdictionRecords;
    }
  }

  const scored = working
    .map((record) => ({
      record,
      score: scoreRecord(question, record),
    }))
    .sort((a, b) => b.score - a.score);

  if (scored.length <= 30) {
    return {
      records: scored.map((x) => x.record),
      detectedService,
      jurisdiction,
    };
  }

  const useful = scored.filter(
    (x) => x.score > 0
  );

  return {
    records:
      useful.length > 0
        ? useful.slice(0, 30).map((x) => x.record)
        : scored.slice(0, 30).map((x) => x.record),
    detectedService,
    jurisdiction,
  };
}

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

function noVerifiedInformation(
  language: "English" | "Urdu"
): string {
  if (language === "Urdu") {
    return "معذرت، اس سوال کے بارے میں ہمارے تصدیق شدہ سرکاری ریکارڈ میں فی الحال کافی معلومات موجود نہیں ہیں۔ براہ کرم سروس یا متعلقہ صوبہ/علاقہ واضح کریں۔";
  }

  return "Sorry, sufficient verified government information is currently not available for this question. Please specify the service or relevant province/jurisdiction.";
}

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


function serviceNeedsJurisdiction(service: string): boolean {
  const s = normalize(service);
  return [
    "domicile",
    "vehicle",
    "excise",
    "birth certificate",
    "death certificate",
    "marriage certificate",
    "divorce certificate",
    "civil registration",
    "land",
    "fard",
    "mutation",
    "police",
    "provincial government jobs",
    "provincial jobs",
    "local government",
  ].some((term) => s.includes(term));
}

function approvedOfficialUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "gov.pk" || host.endsWith(".gov.pk");
  } catch {
    return false;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchOfficialSource(url: string): Promise<string | null> {
  if (!approvedOfficialUrl(url)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "PakistanCitizenHelper/2.0 (public-service-information)",
        Accept: "text/html,application/xhtml+xml,application/pdf;q=0.8,*/*;q=0.5",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/pdf")) {
      // PDF extraction is deliberately not attempted here. The verified
      // Supabase record remains the fallback when the official source is PDF.
      return null;
    }

    const html = await response.text();
    const text = stripHtml(html);

    if (text.length < 120) return null;

    return text.slice(0, 12000);
  } catch (error) {
    console.warn("Official source fetch failed:", url, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    if (
      !SUPABASE_URL ||
      !SUPABASE_ANON_KEY ||
      !GROQ_API_KEY
    ) {
      return NextResponse.json(
        {
          error:
            "Server configuration is incomplete. Check the Vercel environment variables.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const question = String(
      body.question ?? ""
    ).trim();

    const requestedService = String(
      body.service ?? ""
    ).trim();

    const requestedLanguage = String(
      body.language ?? ""
    ).trim();

    const profile = body.profile && typeof body.profile === "object"
      ? {
          province: String(body.profile.province ?? "").trim(),
          district: String(body.profile.district ?? "").trim(),
        }
      : null;

    if (!question) {
      return NextResponse.json(
        {
          error: "Please enter a question.",
        },
        { status: 400 }
      );
    }

    const language: "English" | "Urdu" =
      requestedLanguage.toLowerCase() === "urdu" ||
      isUrdu(question)
        ? "Urdu"
        : "English";

    const supabaseUrl =
      `${SUPABASE_URL}/rest/v1/verified_information` +
      `?select=*&active=eq.true`;

    const supabaseResponse = await fetch(
      supabaseUrl,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
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

    if (
      !Array.isArray(allRecords) ||
      allRecords.length === 0
    ) {
      return NextResponse.json({
        answer: noVerifiedInformation(
          language
        ),
        source: null,
      });
    }

    const selected =
      selectRecords(
        question,
        requestedService,
        allRecords,
        profile?.province
      );

    const relevantRecords =
      selected.records;

    if (relevantRecords.length === 0) {
      return NextResponse.json({
        answer: noVerifiedInformation(
          language
        ),
        source: null,
      });
    }

    const sourceRecord =
      relevantRecords.find(
        (record) =>
          record.official_source_url
      ) || relevantRecords[0];

    const officialUrl =
      sourceRecord?.official_source_url || "";

    const liveOfficialText = officialUrl
      ? await fetchOfficialSource(officialUrl)
      : null;

    const verifiedContext =
      buildVerifiedContext(
        relevantRecords,
        language
      );

    const liveContext = liveOfficialText
      ? `
============================================================
LIVE OFFICIAL SOURCE CONTENT
============================================================

This text was retrieved directly from the approved official
government URL immediately before answering.

Official URL:
${officialUrl}

Content:
${liveOfficialText}

Use this live official content as the freshest source when it
contains the answer. Do not infer facts that are not stated.
============================================================
`
      : `
============================================================
LIVE OFFICIAL SOURCE STATUS
============================================================

The approved official page could not be retrieved right now.
Use the verified Supabase records as fallback information and
clearly avoid claiming that the information was live-verified.
============================================================
`;

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
              officialUrl,
            lastVerified:
              sourceRecord.last_verified ||
              "",
            province:
              sourceRecord.province ||
              "",
            liveVerified: Boolean(liveOfficialText),
            checkedAt: new Date().toISOString(),
          }
        : null;

    const systemPrompt = `
You are Pakistan Citizen Helper.

You provide simple, practical and trustworthy information
about Pakistani government and public services.

============================================================
MOST IMPORTANT RULE
============================================================

ONLY use information contained in the VERIFIED RECORDS and, when present,
the LIVE OFFICIAL SOURCE CONTENT.

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

The application automatically identifies the most likely
service from the user's question.

Do not answer using a different service simply because
the UI selected a different service.

For example:

If UI service = CNIC
but question = "What scholarships are available?"

Answer using SCHOLARSHIP records.

============================================================
JURISDICTION RULE
============================================================

If a question mentions Punjab, Sindh, Khyber Pakhtunkhwa,
Islamabad, Balochistan, AJK or Gilgit-Baltistan, use only
the applicable jurisdiction information where possible.

Do not combine provincial rules.

If rules differ by jurisdiction and the user did not specify
a jurisdiction, clearly tell the user that the requirements
vary and identify the jurisdictions covered by the verified
information.

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

If LIVE OFFICIAL SOURCE CONTENT is present, prefer it for current
fees, timelines, requirements and procedures. If it is absent,
do not describe the answer as live-verified.

============================================================
VERIFIED RECORDS
============================================================

${verifiedContext}

${liveContext}
`;

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

    const groqResponse = await fetch(
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
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
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
        noVerifiedInformation(language);
    }

    if (language === "Urdu") {
      answer = protectUrdu(answer);
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
