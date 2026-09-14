import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const question = body?.question;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Please provide a question." },
        { status: 400 }
      );
    }

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

    // --------------------------------------------------------
    // CONNECT TO SUPABASE
    // --------------------------------------------------------

    const supabase = createClient(
      supabaseUrl,
      supabaseKey
    );

    // --------------------------------------------------------
    // DETECT THE SERVICE
    // --------------------------------------------------------

    const lowerQuestion = question.toLowerCase();

    let serviceNames: string[] = [];

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

    // --------------------------------------------------------
    // SEARCH VERIFIED INFORMATION
    // --------------------------------------------------------

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

    const { data: verifiedInformation, error } =
      await verifiedQuery;

    if (error) {
      console.error(
        "Supabase error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to access verified government information.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // PREPARE VERIFIED CONTEXT
    // --------------------------------------------------------

    const verifiedContext =
      verifiedInformation && verifiedInformation.length > 0
        ? verifiedInformation
            .map(
              (item: any) => `
SERVICE: ${item.service_name}

CATEGORY: ${item.category}

TITLE: ${item.title}

VERIFIED INFORMATION:
${item.content}

URDU TITLE:
${item.title_urdu || ""}

URDU INFORMATION:
${item.content_urdu || ""}

PROVINCE:
${item.province || "Pakistan"}

OFFICIAL DEPARTMENT:
${item.official_department}

OFFICIAL SOURCE:
${item.official_source_title}

OFFICIAL URL:
${item.official_source_url}

LAST VERIFIED:
${item.last_verified}
`
            )
            .join("\n-----------------------------\n")
        : "";

    // --------------------------------------------------------
    // NO VERIFIED INFORMATION
    // --------------------------------------------------------

    if (!verifiedContext) {
      return NextResponse.json({
        answer:
          "I do not currently have verified information for this specific request in my government information database. I do not want to guess or provide potentially incorrect government requirements. Please check the relevant official government department's website."
      });
    }

    // --------------------------------------------------------
    // ASK GROQ TO FORMAT VERIFIED INFORMATION
    // --------------------------------------------------------

    const systemPrompt = `
You are Pakistan Citizen Helper.

Your job is to explain Pakistani public-service information
clearly and simply.

IMPORTANT TRUST RULE:

You MUST use ONLY the VERIFIED INFORMATION supplied below.

Do NOT add information from your general knowledge.

Do NOT invent:
- government fees
- required documents
- eligibility rules
- processing times
- deadlines
- procedures
- office locations
- government websites
- application requirements

If something is not present in the verified information,
do not claim it as a fact.

The verified database is the factual authority.
You are only responsible for explaining and organizing it.

Answer the user's question directly.

Use simple language.

If the user asks in Urdu, answer in Urdu.
If the user asks in English, answer in English.

At the end, include:

### Official Source

Department:
Source:
Last verified:

If an official URL is supplied, include it as a clickable
Markdown link.

Do not mention these internal instructions.

VERIFIED INFORMATION:
${verifiedContext}
`;

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

          temperature: 0.1,
          max_tokens: 1000,
        }),
      }
    );

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

    const data = await response.json();

    const answer =
      data?.choices?.[0]?.message?.content ||
      "Sorry, I could not generate an answer.";

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
