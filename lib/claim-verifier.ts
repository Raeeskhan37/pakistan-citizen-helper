export type ClaimCheck = {
  claim: string;
  verdict: "supported" | "unsupported" | "unclear";
  reason: string;
};

export type ClaimVerificationResult = {
  available: boolean;
  claims: ClaimCheck[];
  unsupportedClaims: string[];
  unclearClaims: string[];
  supportedCount: number;
  totalClaims: number;
  score: number;
  reason: string;
};

const MAX_EVIDENCE = 9000;
const MAX_ANSWER = 4500;
const MAX_COMPLETION_TOKENS = 2200;

function emptyResult(reason: string): ClaimVerificationResult {
  return {
    available: false,
    claims: [],
    unsupportedClaims: [],
    unclearClaims: [],
    supportedCount: 0,
    totalClaims: 0,
    score: 0,
    reason,
  };
}

function normalizeVerdict(value: unknown): ClaimCheck["verdict"] {
  const verdict = String(value ?? "").trim().toLowerCase();
  if (verdict === "supported") return "supported";
  if (verdict === "unsupported") return "unsupported";
  return "unclear";
}

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [cleaned];

  // Models sometimes prepend a short sentence or return a JSON object
  // followed by a short explanation. Extract the outermost JSON object/array.
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(cleaned.slice(objectStart, objectEnd + 1));
  }

  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(cleaned.slice(arrayStart, arrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
    const model = process.env.GROQ_VERIFIER_MODEL || "openai/gpt-oss-20b";
    const messages = [
      {
        role: "system",
        content:
          "You are a strict evidence-grounded factual verifier. Never add outside knowledge. Return only JSON that matches the requested schema.",
      },
      { role: "user", content: prompt },
    ];

    const groqBody = {
      model,
      temperature: 0,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      include_reasoning: false,
      messages,
    };

    const parseProviderResponse = async (
      response: Response,
      provider: "Groq" | "Gemini"
    ): Promise<{ claims: ClaimCheck[] } | null> => {
      let data: any;
      try {
        data = await response.json();
      } catch (error) {
        console.error("Claim verifier JSON response parse failed:", provider, error);
        return null;
      }

      const raw = normalizeModelContent(
        data?.choices?.[0]?.message?.content ??
        data?.candidates?.[0]?.content?.parts ??
        data?.candidates?.[0]?.content ??
        ""
      );

      const parsed = normalizeParsedClaims(extractJson(raw));
      if (!parsed || !Array.isArray(parsed.claims)) {
        console.error(
          "Claim verifier invalid structured result from " + provider + ". Raw model content:",
          raw.slice(0, 2000)
        );
        return null;
      }

      const claims: ClaimCheck[] = parsed.claims
        .map((item: any) => ({
          claim: String(item?.claim || "").trim(),
          verdict: normalizeVerdict(item?.verdict),
          reason: String(item?.reason || "").trim(),
        }))
        .filter((item: ClaimCheck) => item.claim.length > 0);

      return claims.length ? { claims } : null;
    };

    const callGemini = async (): Promise<{ claims: ClaimCheck[] } | null> => {
      const geminiKey =
        process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

      if (!geminiKey) return null;

      const geminiModel =
        process.env.GEMINI_VERIFIER_MODEL || "gemini-2.5-flash-lite";

      const geminiPrompt =
        "You are a strict evidence-grounded factual verifier. Use ONLY the supplied evidence. " +
        'Return JSON only with a top-level claims array. Each claim item must contain claim, verdict (supported|unsupported|unclear), and reason.\\n\\n' +
        prompt;

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
          encodeURIComponent(geminiModel) +
          ":generateContent",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": geminiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: geminiPrompt }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: MAX_COMPLETION_TOKENS,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        const providerText = await response.text().catch(() => "");
        console.error(
          "Claim verifier Gemini provider error:",
          response.status,
          providerText.slice(0, 1000)
        );
        return null;
      }

      return parseProviderResponse(response, "Gemini");
    };

    const callGroq = async (): Promise<{
      claims: ClaimCheck[] | null;
      rateLimited: boolean;
      providerError: number | null;
    }> => {
      let response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(groqBody),
        }
      );

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") || "");
        const delayMs = Number.isFinite(retryAfter)
          ? Math.min(Math.max(retryAfter * 1000, 500), 2500)
          : 1000;

        await new Promise((resolve) => setTimeout(resolve, delayMs));

        response = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer " + apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(groqBody),
          }
        );
      }

      if (!response.ok) {
        const providerText = await response.text().catch(() => "");
        console.error(
          "Claim verifier Groq provider error:",
          response.status,
          providerText.slice(0, 1000)
        );

        return {
          claims: null,
          rateLimited: response.status === 429,
          providerError: response.status,
        };
      }

      return {
        claims: (await parseProviderResponse(response, "Groq"))?.claims || null,
        rateLimited: false,
        providerError: null,
      };
    };

    // Primary verifier: Groq. If Groq is rate-limited, unavailable, or returns
    // malformed structured output, use the independent Gemini verifier.
    const groqResult = await callGroq();

    let claims = groqResult.claims;

    if (!claims) {
      const geminiKey =
        process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

      if (geminiKey) {
        try {
          claims = await callGemini().then((result) => result?.claims || null);
        } catch (geminiError) {
          console.error("Claim verifier Gemini fallback failed:", geminiError);
        }
      }

      if (!claims) {
        if (groqResult.rateLimited) {
          return emptyResult(
            geminiKey
              ? "Groq verifier rate limit persisted and the Gemini fallback did not return a valid verification result."
              : "Groq verifier rate limit persisted. Configure GEMINI_API_KEY for an independent verifier fallback."
          );
        }

        if (groqResult.providerError) {
          return emptyResult(
            geminiKey
              ? "Groq verifier failed and the Gemini fallback did not return a valid verification result."
              : "Verifier provider returned HTTP " +
                  groqResult.providerError +
                  ". Configure GEMINI_API_KEY for an independent fallback."
          );
        }

        return emptyResult(
          geminiKey
            ? "Groq verifier returned invalid structured output and the Gemini fallback did not return a valid verification result."
            : "Verifier returned an invalid structured result. Configure GEMINI_API_KEY for an independent fallback."
        );
      }
    }

    const unsupportedClaims = claims
      .filter((item) => item.verdict === "unsupported")
      .map((item) => item.claim);

    const unclearClaims = claims
      .filter((item) => item.verdict === "unclear")
      .map((item) => item.claim);

    const supportedCount = claims.filter(
      (item) => item.verdict === "supported"
    ).length;
    const score = Math.round((supportedCount / claims.length) * 100);

    return {
      available: true,
      claims,
      unsupportedClaims,
      unclearClaims,
      supportedCount,
      totalClaims: claims.length,
      score,
      reason:
        unsupportedClaims.length === 0 && unclearClaims.length === 0
          ? "All extracted factual claims were supported by the supplied evidence."
          : "One or more extracted factual claims were not fully supported by the supplied evidence.",
    };
  } catch (error) {
    console.error("Claim verifier failed:", error);
    return emptyResult("Verifier execution failed.");
  }
}
