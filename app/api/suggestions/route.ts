import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Suggestion service is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const suggestionType =
      typeof body?.suggestionType === "string"
        ? body.suggestionType.trim().slice(0, 100)
        : "";

    const suggestion =
      typeof body?.suggestion === "string"
        ? body.suggestion.trim().slice(0, 2000)
        : "";

    const department =
      typeof body?.department === "string"
        ? body.department.trim().slice(0, 200)
        : null;

    const language =
      body?.language === "English" || body?.language === "Urdu"
        ? body.language
        : "English";

    if (!suggestionType || !suggestion) {
      return NextResponse.json(
        { error: "Suggestion type and suggestion are required." },
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
      .from("user_suggestions")
      .insert({
        suggestion_type: suggestionType,
        suggestion,
        department,
        language,
      });

    if (error) {
      console.error("Suggestion insert error:", error);

      return NextResponse.json(
        { error: "Unable to save suggestion." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Suggestion submitted successfully.",
    });
  } catch (error) {
    console.error("Suggestion API error:", error);

    return NextResponse.json(
      { error: "Unable to process suggestion." },
      { status: 500 }
    );
  }
}
