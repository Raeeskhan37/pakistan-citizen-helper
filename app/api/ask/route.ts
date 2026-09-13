import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const question = body?.question;

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        {
          error: "Please provide a question.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      answer:
        "Your question has reached the Citizen Helper AI backend successfully. The AI model will be connected in the next step.",
      question: question,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Unable to process your request.",
      },
      { status: 500 }
    );
  }
}
