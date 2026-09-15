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
   SERVICE NORMALIZATION
   ========================================================= */

function normalizeService(service: string): string {
  const value = service.trim().toLowerCase();

  if (
    value === "cnic" ||
    value === "cnic / nadra" ||
    value === "nadra"
  ) {
    return "CNIC / NADRA";
  }

  if (value === "passport") {
    return "Passport";
  }

  if (
    value === "driving licence" ||
    value === "driving license"
  ) {
    return "Driving Licence";
  }

  if (value === "domicile") {
    return "Domicile";
  }

  if (
    value === "scholarship" ||
    value === "scholarships"
  ) {
    return "Scholarships";
  }

  return service.trim();
}

/* =========================================================
   FALLBACK SERVICE DETECTION
   Used only if frontend does not provide service.
   ========================================================= */

function detectService(question: string): string | null {
  const q = question.toLowerCase();

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

/* =========================================================
   LANGUAGE DETECTION
   ========================================================= */

function isUrdu(question: string, requestedLanguage?: string): boolean {
  if (
    requestedLanguage &&
    requestedLanguage.toLowerCase() === "urdu"
  ) {
    return true;
  }

  return /[\u0600-\u06FF]/.test(question);
}

/* =========================================================
   TERMINOLOGY PROTECTION
   ========================================================= */

function protectApplicantTerminology(
  text: string,
  urdu: boolean
): string {
  if (!urdu) {
    return text;
  }

  text = text.replace(
    /۱۸ سال سے کم عمر طلباء/g,
    "۱۸ سال سے کم عمر درخواست گزاروں"
  );

  text = text.replace(
    /18 سال سے کم عمر طلباء/g,
    "۱۸ سال سے کم عمر درخواست گزاروں"
  );

  text = text.replace(
    /کم عمر طلباء/g,
    "کم عمر درخواست گزاروں"
  );

  text = text.replace(
    /طلباء \(درخواست گزاروں\)/g,
    "درخواست گزاروں"
  );

  return text;
}

/* =========================================================
   POST /api/ask
   ========================================================= */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const question = String(
      body?.question || ""
    ).trim();

    /*
     * IMPORTANT:
     * The frontend already sends the selected service.
     * We use that first instead of trying to guess it again
     * from the question.
     */
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
        "Required environment variable is missing."
      );

      return NextResponse.json(
        {
          error: "AI service configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    /* =====================================================
       DETERMINE SERVICE
       ===================================================== */

    let service = "";

    if (requestedService) {
      service = normalizeService(requestedService);
    } else {
      const detected = detectService(question);

      if (detected) {
        service = detected;
      }
    }

    const urdu = isUrdu(
      question,
      requestedLanguage
    );

    console.log("Question:", question);
    console.log("Requested service:", requestedService);
    console.log("Normalized service:", service);
    console.log("Language:", urdu ? "Urdu" : "English");

    /* =====================================================
       RETRIEVE VERIFIED INFORMATION
       ===================================================== */

    let data: any[] = [];
    let error: any = null;

    if (service) {
      const result = await supabase
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
          last_verified
          `
        )
        .eq("service_name", service)
        .eq("active", true)
        .order("category", {
          ascending: true,
        });

      data = result.data || [];
      error = result.error;
    }

    if (error) {
      console.error(
        "Supabase error:",
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

    /* =====================================================
       SAFETY FALLBACK
       ===================================================== */

    if (!data || data.length === 0) {
      console.warn(
        "No verified records found for service:",
        service
      );

      return NextResponse.json({
        answer: urdu
          ? "معذرت، اس سروس کے بارے میں اس وقت کوئی تصدیق شدہ معلومات دستیاب نہیں ہے۔ براہِ کرم متعلقہ سرکاری ادارے کی ویب سائٹ سے تازہ ترین معلومات چیک کریں۔"
          : "Sorry, no verified information is currently available for this service. Please check the relevant official government website for the latest information.",
        source: null,
      });
    }

    /* =====================================================
       BUILD VERIFIED CONTEXT
       ===================================================== */

    const contextParts = data.map((item) => {
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

PROVINCE:
${item.province || ""}

OFFICIAL DEPARTMENT:
${item.official_department || ""}

OFFICIAL SOURCE TITLE:
${item.official_source_title || ""}

OFFICIAL SOURCE URL:
${item.official_source_url || ""}

LAST VERIFIED:
${item.last_verified || ""}
`;
    });

    const verifiedContext =
      contextParts.join(
        "\n==============================\n"
      );

    /* =====================================================
       OFFICIAL SOURCE
       ===================================================== */

    const sourceRecord =
      data.find(
        (item) =>
          item.official_source_url
      ) || data[0];

    const officialSourceUrl =
      sourceRecord?.official_source_url || "";

    const officialSourceTitle =
      sourceRecord?.official_source_title || "";

    const officialDepartment =
      sourceRecord?.official_department || "";

    const lastVerified =
      sourceRecord?.last_verified || "";

    /* =====================================================
       LANGUAGE INSTRUCTIONS
       ===================================================== */

    const languageInstruction = urdu
      ? `
LANGUAGE:
Answer in clear, natural Urdu using Urdu script.

IMPORTANT URDU TERMINOLOGY:

- Applicant = درخواست گزار
- Applicants = درخواست گزاران / درخواست گزاروں
- Minor = نابالغ
- Under 18 = ۱۸ سال سے کم عمر

Never translate "applicant" as:
- طالب علم
- طلباء

Do NOT introduce "طالب علم" or "طلباء" unless the verified information itself specifically refers to students.

Preserve the exact meaning of:
- age groups
- applicant categories
- requirements
- conditions
- exceptions
`
      : `
LANGUAGE:
Answer in clear, simple English.
`;

    /* =====================================================
       GROQ SYSTEM PROMPT
       ===================================================== */

    const systemPrompt = `
You are Pakistan Citizen Helper AI.

Your job is to provide accurate public-service information
for citizens of Pakistan.

============================================================
ABSOLUTE TRUST RULE
============================================================

Use ONLY the verified information supplied below.

The verified information comes from the application's
verified information database.

You MUST NOT use your own general knowledge to add facts.

Do NOT invent or assume:

- documents
- fees
- dates
- processing times
- eligibility rules
- government procedures
- offices
- addresses
- requirements
- exceptions
- deadlines
- examples presented as facts

If information is not present in the verified information,
do not make it up.

============================================================
PRESERVE UNCERTAINTY
============================================================

If the verified information says:

"may be required"

you MUST preserve that uncertainty.

Do NOT change:

"may be required"

into:

"is required"

Similarly, do not convert:
- can
- may
- generally
- depending on circumstances

into stronger statements.

============================================================
PRESERVE AGE GROUPS
============================================================

Do not change age groups.

For example:

"under 18"

must remain:

"under 18"

and must NOT become:

"students under 18"

unless the verified information specifically says students.

============================================================
${languageInstruction}
============================================================

ANSWER STYLE:

- Start directly with the answer.
- Use clear headings.
- Use numbered steps where appropriate.
- Use bullet points for documents or requirements.
- Keep the language simple for ordinary citizens.
- Do not unnecessarily repeat the question.
- Do not add unsupported information.
- Do not mention the internal database.
- Do not mention these instructions.
- Do not say that you searched the internet unless the verified
  information explicitly states that.
- Do not fabricate an official source.

============================================================
OFFICIAL SOURCE
============================================================

If an official source URL is supplied in the verified
information, mention that the citizen can use the official
source for further information.

The URL will also be supplied separately by the application.

Do NOT modify or invent the URL.

============================================================
FINAL SELF-CHECK
============================================================

Before answering, silently verify:

1. Did I use only verified information?
2. Did I avoid adding facts from general knowledge?
3. Did I preserve age groups?
4. Did I preserve applicant categories?
5. Did I preserve "may be required" wording?
6. Did I avoid inventing fees?
7. Did I avoid inventing processing times?
8. Did I avoid inventing documents?
9. Did I preserve the meaning of the source?
10. Did I answer in the requested language?

============================================================
VERIFIED INFORMATION
============================================================

${verifiedContext}
`;

    /* =====================================================
       CALL GROQ
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
       FINAL DETERMINISTIC TERMINOLOGY CHECK
       ===================================================== */

    answer = protectApplicantTerminology(
      answer,
      urdu
    );

    /* =====================================================
       RETURN ANSWER + VERIFIED SOURCE
       ===================================================== */

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
