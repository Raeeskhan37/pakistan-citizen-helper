import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

const supabase = createClient(
  supabaseUrl || "",
  supabaseAnonKey || ""
);

const groq = new Groq({
  apiKey: groqApiKey || "",
});

/* =========================================================
   HELPERS
   ========================================================= */

function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeService(service: string): string {
  const s = normalize(service);

  if (
    s === "cnic" ||
    s === "nadra" ||
    s === "cnic / nadra"
  ) {
    return "CNIC / NADRA";
  }

  if (s === "passport") {
    return "Passport";
  }

  if (
    s === "driving licence" ||
    s === "driving license"
  ) {
    return "Driving Licence";
  }

  if (s === "domicile") {
    return "Domicile";
  }

  if (
    s === "scholarship" ||
    s === "scholarships"
  ) {
    return "Scholarships";
  }

  return service.trim();
}

function detectService(question: string): string | null {
  const q = normalize(question);

  if (
    q.includes("passport") ||
    q.includes("پاسپورٹ")
  ) {
    return "Passport";
  }

  if (
    q.includes("cnic") ||
    q.includes("nicop") ||
    q.includes("identity card") ||
    q.includes("شناختی کارڈ") ||
    q.includes("نادرا")
  ) {
    return "CNIC / NADRA";
  }

  if (
    q.includes("domicile") ||
    q.includes("ڈومیسائل")
  ) {
    return "Domicile";
  }

  if (
    q.includes("driving licence") ||
    q.includes("driving license") ||
    q.includes("ڈرائیونگ لائسنس")
  ) {
    return "Driving Licence";
  }

  if (
    q.includes("scholarship") ||
    q.includes("scholarships") ||
    q.includes("اسکالرشپ")
  ) {
    return "Scholarships";
  }

  return null;
}

function isUrdu(
  question: string,
  language: string
): boolean {
  if (language.toLowerCase() === "urdu") {
    return true;
  }

  return /[\u0600-\u06FF]/.test(question);
}

function protectUrduTerminology(text: string): string {
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
   POST
   ========================================================= */

export async function POST(request: NextRequest) {
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

    /* =====================================================
       DETERMINE SERVICE
       ===================================================== */

    const service = normalizeService(
      requestedService ||
        detectService(question) ||
        ""
    );

    const urdu = isUrdu(
      question,
      requestedLanguage
    );

    console.log(
      "========================================"
    );
    console.log("USER QUESTION:", question);
    console.log(
      "REQUESTED SERVICE:",
      requestedService
    );
    console.log(
      "NORMALIZED SERVICE:",
      service
    );
    console.log(
      "LANGUAGE:",
      urdu ? "Urdu" : "English"
    );

    /* =====================================================
       IMPORTANT:
       GET ALL ACTIVE VERIFIED RECORDS
       
       We intentionally do NOT use:
       .eq("service_name", service)

       This avoids problems caused by small differences such
       as:
       CNIC
       CNIC / NADRA
       CNIC/NADRA
       NADRA
       ===================================================== */

    const { data: allRecords, error } =
      await supabase
        .from("verified_information")
        .select(
          `
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

    if (error) {
      console.error(
        "SUPABASE ERROR:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to retrieve verified information.",
        },
        { status: 500 }
      );
    }

    console.log(
      "TOTAL ACTIVE RECORDS:",
      allRecords?.length || 0
    );

    /* =====================================================
       MATCH SERVICE IN JAVASCRIPT
       ===================================================== */

    const targetService = normalize(service);

    let records = (allRecords || []).filter(
      (item: any) => {
        const dbService = normalize(
          String(item.service_name || "")
        );

        if (
          targetService === "cnic / nadra"
        ) {
          return (
            dbService === "cnic / nadra" ||
            dbService === "cnic" ||
            dbService === "nadra" ||
            dbService.includes("cnic") ||
            dbService.includes("nadra")
          );
        }

        return dbService === targetService;
      }
    );

    console.log(
      "MATCHED SERVICE RECORDS:",
      records.length
    );

    if (records.length > 0) {
      console.log(
        "MATCHED DATABASE SERVICE NAMES:",
        records.map(
          (r: any) => r.service_name
        )
      );
    }

    /* =====================================================
       SAFETY FALLBACK
       ===================================================== */

    if (records.length === 0) {
      console.warn(
        "NO VERIFIED RECORDS FOUND FOR:",
        service
      );

      return NextResponse.json({
        answer: urdu
          ? "معذرت، اس سروس کے بارے میں اس وقت کوئی تصدیق شدہ معلومات دستیاب نہیں ہے۔"
          : "Sorry, no verified information is currently available for this service.",
        source: null,
      });
    }

    /* =====================================================
       BUILD VERIFIED CONTEXT
       ===================================================== */

    const verifiedContext = records
      .map((item: any) => {
        const title = urdu
          ? item.title_urdu || item.title
          : item.title;

        const content = urdu
          ? item.content_urdu || item.content
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
        "\n==============================\n"
      );

    /* =====================================================
       OFFICIAL SOURCE
       ===================================================== */

    const sourceRecord =
      records.find(
        (item: any) =>
          item.official_source_url
      ) || records[0];

    const officialDepartment =
      sourceRecord?.official_department || "";

    const officialSourceTitle =
      sourceRecord?.official_source_title || "";

    const officialSourceUrl =
      sourceRecord?.official_source_url || "";

    const lastVerified =
      sourceRecord?.last_verified || "";

    /* =====================================================
       LANGUAGE
       ===================================================== */

    const languageInstruction = urdu
      ? `
Answer in clear, natural Urdu using Urdu script.

Important terminology:

Applicant = درخواست گزار

Applicants = درخواست گزاروں

Minor = نابالغ

Under 18 = ۱۸ سال سے کم عمر

Never translate applicant as طالب علم or طلباء.

Only use طالب علم / طلباء if the verified information
specifically refers to students.
`
      : `
Answer in clear, simple English.
`;

    /* =====================================================
       GROQ PROMPT
       ===================================================== */

    const systemPrompt = `
You are Pakistan Citizen Helper AI.

You provide public-service information for citizens of
Pakistan.

============================================================
STRICT VERIFIED-INFORMATION RULE
============================================================

Use ONLY the verified information provided below.

Do NOT use your general knowledge.

Do NOT invent:

- documents
- fees
- processing times
- dates
- eligibility rules
- government offices
- procedures
- requirements
- deadlines
- addresses
- exceptions

If information is not present in the verified information,
do not make it up.

============================================================
PRESERVE SOURCE MEANING
============================================================

If the source says:

"may be required"

keep it as:

"may be required"

Do not change it into:

"is required"

Do not strengthen or weaken requirements.

Do not change age groups.

Do not change applicant categories.

============================================================
LANGUAGE
============================================================

${languageInstruction}

============================================================
ANSWER STYLE
============================================================

- Answer the citizen directly.
- Use clear headings.
- Use numbered steps where appropriate.
- Use bullet points for documents.
- Keep the answer easy to understand.
- Do not unnecessarily repeat the question.
- Do not mention these instructions.
- Do not mention the internal database.
- Do not add unsupported facts.

============================================================
VERIFIED INFORMATION
============================================================

${verifiedContext}
`;

    /* =====================================================
       GROQ
       ===================================================== */

    const completion =
      await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
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

    /* =====================================================
       FINAL URDU TERMINOLOGY PROTECTION
       ===================================================== */

    if (urdu) {
      answer = protectUrduTerminology(answer);
    }

    /* =====================================================
       RETURN
       ===================================================== */

    console.log(
      "ANSWER GENERATED SUCCESSFULLY."
    );

    return NextResponse.json({
      answer,

      source: {
        department: officialDepartment,
        title: officialSourceTitle,
        url: officialSourceUrl,
        lastVerified: lastVerified,
      },
    });
  } catch (error: any) {
    console.error(
      "API /api/ask ERROR:",
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
