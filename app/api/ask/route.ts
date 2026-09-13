import { NextResponse } from "next/server";

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

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service is not configured." },
        { status: 500 }
      );
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            {
              role: "system",
              content:
                "You are Pakistan Citizen Helper, a helpful public-service information assistant for citizens of Pakistan. Answer clearly and simply. Do not invent government fees, documents, deadlines, procedures, or official requirements. If you are not certain, clearly say that the information should be verified from the relevant official government department. Prefer official Pakistani government sources.",
            },
            {
              role: "user",
              content: question,
            },
          ],
          temperature: 0.2,
          max_tokens: 800,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error("Groq API error:", errorText);

      return NextResponse.json(
        {
          error: "The AI service could not process your request.",
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
    console.error("API error:", error);

    return NextResponse.json(
      {
        error: "Something went wrong while processing your question.",
      },
      { status: 500 }
    );
  }
}
