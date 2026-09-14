import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    // =========================================================
    // 1. READ USER QUESTION
    // =========================================================

    const body = await request.json();
    const question = body?.question;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Please provide a question." },
        { status: 400 }
      );
    }

    // =========================================================
    // 2. ENVIRONMENT VARIABLES
    // =========================================================

    const groqKey = process.env.GROQ_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!groqKey) {
      return NextResponse.json(
        { error: "AI service is not configured." },
        { status: 500 }
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Verified information service is not configured." },
        { status: 500 }
      );
    }

    // =========================================================
    // 3. SUPABASE CONNECTION
    // =========================================================

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    );

    // =========================================================
    // 4. DETECT RELEVANT SERVICE
    // =========================================================

    const lowerQuestion = question.toLowerCase();

    const serviceNames: string[] = [];

    if (
      lowerQuestion.includes("passport") ||
      lowerQuestion.includes("پاسپورٹ")
    ) {
      serviceNames.push("Passport");
    }

    if (
      lowerQuestion.includes("cnic") ||
      lowerQuestion.includes("nadra") ||
      lowerQuestion.includes("national identity") ||
      lowerQuestion.includes("شناختی") ||
      lowerQuestion.includes("نادرا")
    ) {
      serviceNames.push("CNIC / NADRA");
    }

    if (
      lowerQuestion.includes("domicile") ||
      lowerQuestion.includes("ڈومیسائل")
    ) {
      serviceNames.push("Domicile");
    }

    if (
      lowerQuestion.includes("driving licence") ||
      lowerQuestion.includes("driving license") ||
      lowerQuestion.includes("driver licence") ||
      lowerQuestion.includes("driver license") ||
      lowerQuestion.includes("ڈرائیونگ لائسنس")
    ) {
      serviceNames.push("Driving Licence");
    }

    if (
      lowerQuestion.includes("scholarship") ||
      lowerQuestion.includes("scholarships") ||
      lowerQuestion.includes("اسکالرشپ")
    ) {
      serviceNames.push("Scholarships");
    }

    // =========================================================
    // 5. GET VERIFIED INFORMATION
    // =========================================================

    let verifiedQuery = supabase
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
      .eq("active", true);

    if (serviceNames.length > 0) {
      verifiedQuery = verifiedQuery.in(
        "service_name",
        serviceNames
      );
    }

    const {
      data: verifiedInformation,
      error: verifiedError,
    } = await verifiedQuery;

    if (verifiedError) {
      console.error(
        "Supabase error:",
        verifiedError
      );

      return NextResponse.json(
        {
          error:
            "Unable to access verified government information.",
        },
        { status: 500 }
      );
    }

    // =========================================================
    // 6. NO VERIFIED INFORMATION
    // =========================================================

    if (
      !verifiedInformation ||
      verifiedInformation.length === 0
    ) {
      return NextResponse.json({
        answer:
          "I do not currently have verified information for this specific request in my government information database.\n\nI do not want to guess or provide potentially incorrect government requirements.\n\nPlease check the relevant official government department's website."
      });
    }

    // =========================================================
    // 7. BUILD VERIFIED CONTEXT
    // =========================================================

    const verifiedContext =
      verifiedInformation
        .map((item: any) => {
          return `
==================================================
VERIFIED RECORD
==================================================

SERVICE:
${item.service_name}

CATEGORY:
${item.category}

TITLE:
${item.title}

VERIFIED ENGLISH INFORMATION:
${item.content}

VERIFIED URDU TITLE:
${item.title_urdu || "Not available"}

VERIFIED URDU INFORMATION:
${item.content_urdu || "Not available"}

PROVINCE / COVERAGE:
${item.province || "Pakistan"}

OFFICIAL DEPARTMENT:
${item.official_department || "Not specified"}

OFFICIAL SOURCE TITLE:
${item.official_source_title || "Not specified"}

OFFICIAL SOURCE URL:
${item.official_source_url || "Not specified"}

LAST VERIFIED:
${item.last_verified || "Not specified"}

==================================================
END VERIFIED RECORD
==================================================
`;
        })
        .join("\n");

    // =========================================================
    // 8. STRICT VERIFIED-ONLY SYSTEM PROMPT
    // =========================================================

    const systemPrompt = `
You are Pakistan Citizen Helper.

Your role is ONLY to explain information that exists in the
VERIFIED DATABASE supplied below.

The VERIFIED DATABASE is the sole factual authority.

You are NOT a government officer.
You are NOT a government website.
You must NEVER use your own general knowledge as an additional
source.

==================================================
ABSOLUTE FACTUAL RESTRICTION
==================================================

Every factual statement in your answer must be directly
supported by the VERIFIED DATABASE.

If a fact is not present in the database:

DO NOT provide it.

Do not guess.

Do not assume.

Do not infer.

Do not complete missing information from memory.

Do not use common knowledge to fill gaps.

==================================================
MEANING PRESERVATION — CRITICAL
==================================================

You MUST preserve the exact meaning of the verified information.

Do NOT change:

- age groups
- applicant categories
- eligibility conditions
- document names
- government department names
- requirements
- exceptions
- circumstances
- dates
- processing times
- fees
- deadlines
- locations
- levels of certainty

Examples:

If the database says:

"applicants under 18 years"

DO NOT change this to:

"students under 18 years"

because not every applicant under 18 is necessarily a student.

If the database says:

"may be required"

DO NOT change it to:

"is required".

If the database says:

"depending on circumstances"

DO NOT remove that condition.

If the database says:

"additional documents may be required"

DO NOT invent or suggest which additional documents those
might be.

==================================================
NO INVENTED EXAMPLES
==================================================

Never introduce examples that are not explicitly present in
the verified information.

For example, if the database says:

"required parental or legal-guardian documentation"

do NOT write:

"such as birth certificate or guardianship papers"

unless those exact examples are explicitly present in the
database.

==================================================
NO PARAPHRASING THAT CHANGES FACTS
==================================================

Simple language is allowed.

However, simplification must NOT change the factual meaning.

You may shorten a sentence while preserving its meaning.

You may organize information into bullet points.

You may translate the verified information.

You may NOT add new facts.

==================================================
URDU LANGUAGE RULE
==================================================

If the user asks in Urdu:

Answer in clear Urdu script.

Do NOT use Hindi/Devanagari.

Preserve the original meaning of the verified Urdu or English
information.

Do not introduce new Urdu examples or interpretations.

IMPORTANT:

"applicant" means درخواست گزار.

Do NOT translate "applicant" as طالب علم unless the verified
information specifically says طالب علم/student.

==================================================
ENGLISH LANGUAGE RULE
==================================================

If the user asks in English:

Answer in clear, simple English.

==================================================
QUESTION SCOPE
==================================================

Answer only the question asked.

Do not provide unrelated government information.

If the user asks about something not contained in the verified
database, say clearly that the database does not currently
contain verified information for that specific request.

==================================================
OFFICIAL SOURCE RULE
==================================================

At the end of the answer include:

### Official Source

Department: [exact verified department]

Source: [exact verified source title]

Last verified: [exact verified date]

If OFFICIAL SOURCE URL is available, you MUST include it.

Use the exact URL supplied by the database.

Format it as:

[Official source](EXACT_URL)

Never create, modify, shorten, or guess a government URL.

==================================================
SOURCE INFORMATION MUST NOT BE CHANGED
==================================================

Do not change:

- department name
- source title
- URL
- verification date

Copy these values from the verified database.

==================================================
FINAL SELF-CHECK
==================================================

Before producing the answer, silently check:

1. Is every factual claim supported by the database?
2. Did I add any example not present in the database?
3. Did I change any age group?
4. Did I change "applicant" into "student" or another category?
5. Did I change "may" into "must" or "is required"?
6. Did I remove any important condition?
7. Did I invent a document, fee, procedure, location, date,
   deadline, or requirement?
8. Did I change the official department, source, URL, or date?

If any answer is YES, remove or correct that statement before
responding.

==================================================
VERIFIED DATABASE
==================================================

${verifiedContext}

==================================================
END VERIFIED DATABASE
==================================================
`;

    // =========================================================
    // 9. CALL GROQ
    // =========================================================

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },

        body: JSON.stringify({
          model: "openai/gpt-oss-120b",

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

          // Deterministic output is preferred for
          // government-information responses.
          temperature: 0,

          max_tokens: 1000,
        }),
      }
    );

    // =========================================================
    // 10. GROQ ERROR HANDLING
    // =========================================================

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Groq API error:",
        errorText
      );

      return NextResponse.json(
        {
          error:
            "The AI service could not process your request.",
        },
        { status: 500 }
      );
    }

    // =========================================================
    // 11. READ RESPONSE
    // =========================================================

    const data = await response.json();

    const answer =
      data?.choices?.[0]?.message?.content;

    if (!answer) {
      return NextResponse.json(
        {
          error:
            "The AI service returned an empty response.",
        },
        { status: 500 }
      );
    }

    // =========================================================
    // 12. RETURN FINAL ANSWER
    // =========================================================

    return NextResponse.json({
      answer,
    });

  } catch (error) {
    console.error(
      "API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong while processing your question.",
      },
      { status: 500 }
    );
  }
}
