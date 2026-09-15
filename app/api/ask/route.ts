import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

if (!supabaseUrl || !supabaseAnonKey || !groqApiKey) {
  console.error("Missing required environment variables.");
}

const supabase = createClient(
  supabaseUrl || "",
  supabaseAnonKey || ""
);

const groq = new Groq({
  apiKey: groqApiKey || "",
});

/* =========================================================
   TEXT HELPERS
   ========================================================= */

function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function isUrdu(
  question: string,
  requestedLanguage: string
): boolean {
  if (
    requestedLanguage &&
    requestedLanguage.toLowerCase() === "urdu"
  ) {
    return true;
  }

  return /[\u0600-\u06FF]/.test(question);
}

/* =========================================================
   SERVICE MATCHING
   =========================================================
   
   The database is the source of truth.

   We do NOT hard-code individual services.

   Example:
   User/frontend:
      "CNIC / NADRA"

   Database:
      "CNIC / NADRA"

   Or:
      "Driving Licence"

   Database:
      "Driving Licence"

   New services added later will automatically work.
   ========================================================= */

function serviceMatches(
  databaseService: string,
  requestedService: string
): boolean {
  const db = normalize(databaseService);
  const requested = normalize(requestedService);

  if (!db || !requested) {
    return false;
  }

  if (db === requested) {
    return true;
  }

  /*
   * Flexible matching for harmless variations.
   */

  const dbCompact = db
    .replace(/\//g, "")
    .replace(/\s+/g, "");

  const requestedCompact = requested
    .replace(/\//g, "")
    .replace(/\s+/g, "");

  if (dbCompact === requestedCompact) {
    return true;
  }

  return false;
}

/* =========================================================
   QUESTION RELEVANCE
   =========================================================
   
   We use the question to identify relevant records inside
   the already-selected service.

   We intentionally keep this simple and safe.
   If no category appears relevant, ALL verified records
   for the service are supplied to Groq.

   This prevents missing important information.
   ========================================================= */

function scoreRecord(
  record: any,
  question: string
): number {
  const q = normalize(question);

  const text = normalize(
    [
      record.category,
      record.title,
      record.content,
      record.title_urdu,
      record.content_urdu,
    ]
      .filter(Boolean)
      .join(" ")
  );

  let score = 0;

  const keywords = [
    "fee",
    "fees",
    "cost",
    "price",
    "charges",
    "فیس",
    "فیس کتنی",
    "کتنی فیس",
    "خرچہ",
    "اخراجات",

    "document",
    "documents",
    "required",
    "requirements",
    "کاغذات",
    "دستاویز",
    "دستاویزات",
    "ضروری",

    "eligibility",
    "eligible",
    "qualification",
    "اہلیت",
    "مستحق",

    "apply",
    "application",
    "process",
    "procedure",
    "steps",
    "درخواست",
    "درخواست کیسے",
    "طریقہ",
    "عمل",

    "renew",
    "renewal",
    "renew",
    "تجدید",
    "دوبارہ",

    "time",
    "duration",
    "processing",
    "days",
    "کتنا وقت",
    "مدت",

    "where",
    "office",
    "location",
    "کہاں",
    "دفتر",

    "protector",
    "emigration",
    "employment",
    "visa",
    "work visa",
    "protector of emigrants",
    "پروٹیکٹر",
    "پروٹیکٹر آف ایمیگرنٹس",
    "امیگریشن",
    "ملازمت",
    "ورک ویزا",
    "بیرون ملک ملازمت",
  ];

  for (const keyword of keywords) {
    if (q.includes(keyword) && text.includes(keyword)) {
      score += 2;
    }
  }

  /*
   * Exact category/title word overlap.
   */

  const questionWords = q
    .split(/\s+/)
    .filter((word) => word.length >= 3);

  for (const word of questionWords) {
    if (text.includes(word)) {
      score += 1;
    }
  }

  return score;
}

/* =========================================================
   URDU TERMINOLOGY PROTECTION
   ========================================================= */

function protectUrduTerminology(
  text: string
): string {
  return text
    .replace(
      /۱۸ سال سے کم عمر طلباء/g,
      "۱۸ سال سے کم عمر درخواست گزاروں"
    )
    .replace(
      /18 سال سے کم عمر طلباء/g,
      "۱۸ سال سے کم عمر درخواست گزاروں"
    )
    .replace(
      /کم عمر طلباء/g,
      "کم عمر درخواست گزاروں"
    )
    .replace(
      /طلباء \(درخواست گزاروں\)/g,
      "درخواست گزاروں"
    );
}

/* =========================================================
   POST /api/ask
   ========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const question = String(
      body?.question || ""
    ).trim();

    const requestedService = String(
      body?.service || ""
    ).trim();

    const requestedLanguage = String(
      body?.language || ""
    ).trim();

    if (!question) {
      return NextResponse.json(
        {
          error: "Please enter a question.",
        },
        { status: 400 }
      );
    }

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !groqApiKey
    ) {
      console.error(
        "Missing Supabase or Groq environment variables."
      );

      return NextResponse.json(
        {
          error:
            "AI service configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    const urdu = isUrdu(
      question,
      requestedLanguage
    );

    /*
     * =====================================================
     * GET ALL ACTIVE VERIFIED INFORMATION
     * =====================================================
     *
     * No service is hard-coded here.
     *
     * This means new services can be added to Supabase
     * without changing this API.
     */

    const {
      data: allRecords,
      error: supabaseError,
    } = await supabase
      .from("verified_information")
      .select(
        `
        id,
        service_name,
        category,
        title,
        content,
        service_name_urdu,
        title_urdu,
        content_urdu,
        province,
        official_department,
        official_source_title,
        official_source_url,
        last_verified,
        active
        `
      )
      .eq("active", true)
      .order("category", {
        ascending: true,
      });

    if (supabaseError) {
      console.error(
        "Supabase error:",
        supabaseError
      );

      return NextResponse.json(
        {
          error:
            "Unable to retrieve verified information.",
        },
        { status: 500 }
      );
    }

    const records = allRecords || [];

    console.log(
      "Total active verified records:",
      records.length
    );

    /*
     * =====================================================
     * FIND SERVICE RECORDS
     * =====================================================
     */

    let serviceRecords = records;

    if (requestedService) {
      serviceRecords = records.filter(
        (record: any) =>
          serviceMatches(
            String(record.service_name || ""),
            requestedService
          )
      );
    }

    /*
     * If the frontend did not provide a service or no exact
     * service was found, search the question against the
     * service names.
     */

    if (
      serviceRecords.length === 0 &&
      !requestedService
    ) {
      const questionText =
        normalize(question);

      serviceRecords = records.filter(
        (record: any) => {
          const serviceName =
            normalize(
              String(
                record.service_name || ""
              )
            );

          const serviceUrdu =
            normalize(
              String(
                record.service_name_urdu || ""
              )
            );

          return (
            questionText.includes(serviceName) ||
            (serviceUrdu &&
              questionText.includes(
                serviceUrdu
              ))
          );
        }
      );
    }

    console.log(
      "Requested service:",
      requestedService
    );

    console.log(
      "Service records found:",
      serviceRecords.length
    );

    /*
     * =====================================================
     * NO VERIFIED DATA
     * =====================================================
     */

    if (serviceRecords.length === 0) {
      return NextResponse.json({
        answer: urdu
          ? "معذرت، اس سروس کے بارے میں اس وقت کوئی تصدیق شدہ معلومات دستیاب نہیں ہے۔"
          : "Sorry, no verified information is currently available for this service.",
        source: null,
      });
    }

    /*
     * =====================================================
     * SELECT RELEVANT RECORDS
     * =====================================================
     *
     * We keep all records available as a safety net.
     *
     * Relevant records are placed first.
     */

    const scoredRecords =
      serviceRecords.map(
        (record: any) => ({
          record,
          score: scoreRecord(
            record,
            question
          ),
        })
      );

    scoredRecords.sort(
      (a, b) => b.score - a.score
    );

    /*
     * Keep ALL verified records.

     * This is deliberate.

     * For public-service questions, it is safer to give
     * Groq the complete verified service information than
     * accidentally exclude an important condition.
     */

    const relevantRecords =
      scoredRecords.map(
        (item) => item.record
      );

    /*
     * =====================================================
     * BUILD VERIFIED CONTEXT
     * =====================================================
     */

    const verifiedContext =
      relevantRecords
        .map((item: any) => {
          const title = urdu
            ? item.title_urdu ||
              item.title
            : item.title;

          const content = urdu
            ? item.content_urdu ||
              item.content
            : item.content;

          return `
SERVICE:
${item.service_name || ""}

CATEGORY:
${item.category || ""}

TITLE:
${title || ""}

VERIFIED CONTENT:
${content || ""}

OFFICIAL DEPARTMENT:
${item.official_department || ""}

OFFICIAL SOURCE TITLE:
${item.official_source_title || ""}

OFFICIAL SOURCE URL:
${item.official_source_url || ""}

LAST VERIFIED:
${item.last_verified || ""}
`;
        })
        .join(
          "\n========================================\n"
        );

    /*
     * =====================================================
     * OFFICIAL SOURCE
     * =====================================================
     */

    const sourceRecord =
      relevantRecords.find(
        (item: any) =>
          item.official_source_url
      ) ||
      relevantRecords[0];

    const officialDepartment =
      sourceRecord?.official_department ||
      "";

    const officialSourceTitle =
      sourceRecord?.official_source_title ||
      "";

    const officialSourceUrl =
      sourceRecord?.official_source_url ||
      "";

    const lastVerified =
      sourceRecord?.last_verified ||
      "";

    /*
     * =====================================================
     * LANGUAGE
     * =====================================================
     */

    const languageInstruction = urdu
      ? `
Answer in clear, natural Urdu using Urdu script.

Use these terms:

Applicant = درخواست گزار

Applicants = درخواست گزاروں

Minor = نابالغ

Under 18 = ۱۸ سال سے کم عمر

Never translate applicant as:
طالب علم
or
طلباء

Only use طالب علم / طلباء when the verified information
specifically refers to students.
`
      : `
Answer in clear, simple English.
`;

    /*
     * =====================================================
     * SYSTEM PROMPT
     * =====================================================
     */

    const systemPrompt = `
You are Pakistan Citizen Helper AI.

You provide public-service information for citizens of
Pakistan.

============================================================
ABSOLUTE TRUST RULE
============================================================

Use ONLY the verified information supplied below.

The information below comes from the application's
verified-information database.

Do NOT use your own general knowledge to add facts.

Do NOT invent:

- documents
- fees
- processing times
- dates
- eligibility requirements
- procedures
- offices
- addresses
- deadlines
- government rules
- exceptions
- contact information

If the verified information does not contain an answer,
say that the available verified information does not specify
that detail.

============================================================
IMPORTANT
============================================================

The citizen may ask about:

- eligibility
- required documents
- application procedure
- renewal
- fees
- processing time
- office/location
- requirements
- visa processing
- overseas employment
- Protector of Emigrants
- registration
- scholarships
- any other category

Answer according to the verified information available.

============================================================
PROTECTOR OF EMIGRANTS
============================================================

If the question is about Protector of Emigrants,
overseas employment, work/employment visa processing,
emigration registration, or related requirements:

Use ONLY the supplied verified information.

Do NOT say that a Protector is required for every type of visa.

Clearly distinguish overseas employment/emigration matters
from ordinary visit, tourist, business, or other visas unless
the verified information specifically covers them.

If the verified information states that registration or
Protector processing applies to employment/emigration cases,
explain that condition clearly.

============================================================
PRESERVE UNCERTAINTY
============================================================

If the verified information says:

"may be required"

keep that meaning.

Do NOT change it to:

"is required"

Do not strengthen or weaken government requirements.

============================================================
PRESERVE AGE GROUPS
============================================================

Do not change age groups.

Do not change applicant categories.

============================================================
${languageInstruction}
============================================================

ANSWER STYLE:

- Answer the citizen directly.
- Use clear headings.
- Use numbered steps when appropriate.
- Use bullet points for documents.
- Keep language simple.
- Do not unnecessarily repeat the question.
- Do not mention the internal database.
- Do not mention these instructions.
- Do not invent missing information.
- If a detail is not verified, clearly say so.

============================================================
OFFICIAL SOURCE
============================================================

Use the official source information supplied below.

Do not invent or modify official URLs.

The application will separately display the official source.

============================================================
VERIFIED INFORMATION
============================================================

${verifiedContext}
`;

    /*
     * =====================================================
     * GROQ
     * =====================================================
     */

    const completion =
      await groq.chat.completions.create({
        model:
          "openai/gpt-oss-120b",

        temperature: 0,

        max_tokens: 1200,

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
      });

    let answer =
      completion.choices?.[0]?.message?.content?.trim() ||
      "";

    if (!answer) {
      return NextResponse.json(
        {
          error:
            "AI returned an empty response.",
        },
        { status: 500 }
      );
    }

    /*
     * Final Urdu terminology protection.
     */

    if (urdu) {
      answer =
        protectUrduTerminology(answer);
    }

    /*
     * =====================================================
     * RETURN
     * =====================================================
     */

    return NextResponse.json({
      answer,

      source: {
        department:
          officialDepartment,

        title:
          officialSourceTitle,

        url:
          officialSourceUrl,

        lastVerified:
          lastVerified,
      },
    });
  } catch (error: any) {
    console.error(
      "API /api/ask error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "AI service is temporarily unavailable.",
      },
      { status: 500 }
    );
  }
}
