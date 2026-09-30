import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Feedback service is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const rating =
      body?.rating === "positive" || body?.rating === "negative"
        ? body.rating
        : null;

    const comment =
      typeof body?.comment === "string"
        ? body.comment.trim().slice(0, 2000)
        : null;

    const department =
      typeof body?.department === "string"
        ? body.department.trim().slice(0, 200)
        : null;

    const language =
      body?.language === "English" || body?.language === "Urdu"
        ? body.language
        : "English";

    if (!rating) {
      return NextResponse.json(
        { error: "A valid feedback rating is required." },
        { status: 400 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { error } = await supabase
      .from("user_feedback")
      .insert({
        rating,
        comment,
        department,
        language,
      });

    if (error) {
      console.error("Feedback insert error:", error);

      return NextResponse.json(
        { error: "Unable to save feedback." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Feedback submitted successfully.",
    });
  } catch (error) {
    console.error("Feedback API error:", error);

    return NextResponse.json(
      { error: "Unable to process feedback." },
      { status: 500 }
    );
  }
}
