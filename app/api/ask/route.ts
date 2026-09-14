import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

export const runtime = "nodejs";

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
    return "CNIC";
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

function isUrdu(question: string): boolean {
  return /[\u0600-\u06FF]/.test(question);
}

function protectApplicantTerminology(text: string, urdu: boolean): string {
  if (!urdu) {
    return text;
  }

  // Prevent the model from changing "applicants" into "students".
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const question = String(body?.question || "").trim();

    if (!question) {
      return NextResponse.json(
        {
          error: "Please enter a question.",
        },
        { status: 400 }
      );
    }

    if (!supabaseUrl || !supabaseAnonKey || !groqApiKey) {
      console.error("Required environment variable is missing.");

      return NextResponse.json(
        {
          error: "AI service configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    const service = detectService(question);
    const urdu = isUrdu(question);

    let verifiedContext = "";
    let officialSourceUrl = "";
    let officialSourceTitle = "";
    let officialDepartment = "";
    let lastVerified = "";

    if (service) {
      const { data, error } = await supabase
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
        .order("category", { ascending: true });

      if (error) {
        console.error("Supabase error:", error);

        return NextResponse.json(
          {
            error: "Unable to retrieve verified information.",
          },
          { status: 500 }
        );
      }

      if (data && data.length > 0) {
        const contextParts = data.map((item) => {
          const title = urdu
            ? item.title_urdu || item.title
            : item.title;

          const content = urdu
            ? item.content_urdu || item.content
            : item.content;

          return `
CATEGORY:
${item.category}

TITLE:
${title}

VERIFIED CONTENT:
${content}

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

        verifiedContext = contextParts.join("\n----------------------\n");

        const first = data[0];

        officialSourceUrl = first.official_source_url || "";
        officialSourceTitle = first.official_source_title || "";
        officialDepartment = first.official_department || "";
        lastVerified = first.last_verified || "";
      }
    }

    const languageInstruction = urdu
      ? `
LANGUAGE:
Answer in clear, natural Urdu.

IMPORTANT URDU TERMINOLOGY:
- "Applicant" means "درخواست گزار".
- Never translate "applicant" as "طالب علم" or "طلباء".
- "Minor" means "نابالغ" or "۱۸ سال سے کم عمر".
- Do not introduce the word "طالب علم" unless the verified source itself specifically refers to students.
- Preserve the exact meaning of age groups and applicant categories.
`
      : `
LANGUAGE:
Answer in clear, simple English.
`;

    const systemPrompt = `
You are Pakistan Citizen Helper AI.

Your job is to provide accurate public-service information for Pakistan.

TRUST RULE:
Use ONLY the verified information supplied below.

Do NOT use your own general knowledge to add facts.

Do NOT invent:
- documents
- fees
- dates
- processing times
- eligibility rules
- government procedures
- offices
- requirements
- examples presented as facts

If the verified information says something "may be required", preserve that uncertainty.
Do NOT change "may be required" into "is required".

Do NOT change applicant categories.

Do NOT change age groups.

Do NOT change the meaning of the verified information.

${languageInstruction}

VERY IMPORTANT:
If the verified information says:

"For ages under 18 / Minor"

the answer must NOT say:

"students under 18"

It must refer to:

"applicants under 18"
or the appropriate Urdu equivalent:
"۱۸ سال سے کم عمر درخواست گزار"

The user is asking for public-service guidance, not educational advice.

ANSWER STYLE:
- Start directly with the answer.
- Use clear headings.
- Use numbered lists where appropriate.
- Keep the language easy for ordinary citizens.
- Do not unnecessarily repeat the question.
- Do not claim information that is not present in the verified information.

OFFICIAL SOURCE:
If an official source URL is supplied, include it at the end of the answer.
Do not replace or modify the URL.

Before finalizing your answer, silently check:
1. Did I use only verified information?
2. Did I preserve the original meaning?
3. Did I preserve age groups?
4. Did I preserve applicant categories?
5. Did I preserve "may be required" wording?
6. Did I avoid inventing facts?
7. Did I include the official source when available?

VERIFIED INFORMATION:
${verifiedContext || "No service-specific verified information was found."}
`;

    const completion = await groq.chat.completions.create({
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
      completion.choices?.[0]?.message?.content?.trim() || "";

    if (!answer) {
      return NextResponse.json(
        {
          error: "AI returned an empty response.",
        },
        { status: 500 }
      );
    }

    // Final deterministic terminology protection.
    answer = protectApplicantTerminology(answer, urdu);

    // Add official source separately so the frontend can render
    // a guaranteed clickable source instead of depending on the AI
    // to format the URL correctly.
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
    console.error("API /api/ask error:", error);

    return NextResponse.json(
      {
        error: "AI service is temporarily unavailable.",
      },
      { status: 500 }
    );
  }
}
