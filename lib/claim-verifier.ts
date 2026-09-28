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

const MAX_EVIDENCE = 14000;
const MAX_ANSWER = 7000;

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
    .replace(/^\`\`\`json\s*/i, "")
    .replace(/^\`\`\`\s*/i, "")
    .replace(/\s*\`\`\`$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function verifyAnswerClaims(args: {
  answer: string;
  evidence: string;
  language?: "English" | "Urdu";
}): Promise<ClaimVerificationResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const answer = args.answer.trim();
  const evidence = args.evidence.trim();

  if (!apiKey) return emptyResult("Verifier API key is unavailable.");
  if (answer.length < 20) return emptyResult("The answer is too short to verify.");
  if (evidence.length < 100) return emptyResult("Insufficient evidence was supplied to the verifier.");

  const prompt =
    "You are the Verification Agent for a government-services assistant.\n\n" +
    "Your ONLY job is to check whether factual claims in the proposed answer are supported by the supplied official/verified evidence.\n\n" +
    "Rules:\n" +
    "- Treat the supplied evidence as the only authority.\n" +
    "- Do not use general knowledge.\n" +
    "- Do not assume that a claim is true because it sounds plausible.\n" +
    "- A claim is supported only when the evidence explicitly supports it or clearly entails it.\n" +
    "- A claim is unsupported when the evidence contradicts it or provides no basis for it.\n" +
    "- Use unclear when the evidence is ambiguous or insufficient to decide.\n" +
    "- Ignore headings, greetings, advice to verify, and source URLs as claims.\n" +
    "- Split compound statements into separate factual claims when practical.\n" +
    "- Be especially strict with fees, dates, deadlines, documents, eligibility, processing times, office locations, legal requirements, and jurisdiction-specific requirements.\n" +
    '- Return JSON only with this shape: {"claims":[{"claim":"...","verdict":"supported|unsupported|unclear","reason":"..."}]}\n\n' +
    "PROPOSED ANSWER:\n" +
    answer.slice(0, MAX_ANSWER) +
    "\n\nSUPPLIED EVIDENCE:\n" +
    evidence.slice(0, MAX_EVIDENCE);

  try {
    const model = process.env.GROQ_VERIFIER_MODEL || "openai/gpt-oss-120b";
    const messages = [
      {
        role: "system",
        content:
          "You are a strict evidence-grounded factual verifier. Never add outside knowledge. Return only JSON that matches the requested schema.",
      },
      { role: "user", content: prompt },
    ];

    const requestBody = {
      model,
      temperature: 0,
      max_completion_tokens: 1800,
      include_reasoning: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "claim_verification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              claims: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    claim: { type: "string" },
                    verdict: {
                      type: "string",
                      enum: ["supported", "unsupported", "unclear"],
                    },
                    reason: { type: "string" },
                  },
                  required: ["claim", "verdict", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["claims"],
            additionalProperties: false,
          },
        },
      },
      messages,
    };

    let response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    // Groq can temporarily return 429 when the verifier model hits a rate limit.
    // Retry once only, respecting Retry-After when it is supplied.
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") || "");
      const delayMs = Number.isFinite(retryAfter)
        ? Math.min(Math.max(retryAfter * 1000, 500), 2500)
        : 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
    }

    if (!response.ok) {
      const providerText = await response.text().catch(() => "");
      console.error("Claim verifier provider error:", response.status, providerText.slice(0, 500));

      // If GPT-OSS 120B is rate-limited, try the lighter production model once.
      // The fallback uses JSON-object mode for broad Groq compatibility.
      if (response.status === 429) {
        const fallbackModel = process.env.GROQ_VERIFIER_FALLBACK_MODEL || "openai/gpt-oss-20b";
        const fallbackResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: fallbackModel,
            temperature: 0,
            max_completion_tokens: 1800,
            // GPT-OSS 20B supports Groq Structured Outputs too.
            // Keep the same strict schema as the primary model so the fallback
            // cannot silently change the verifier's response contract.
            include_reasoning: false,
            response_format: requestBody.response_format,
            messages,
          }),
        });

        if (fallbackResponse.ok) {
          response = fallbackResponse;
        } else if (fallbackResponse.status === 400) {
          // Retry JSON Object Mode if strict structured output is rejected.
          const fallbackJsonResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: fallbackModel,
              temperature: 0,
              max_completion_tokens: 1800,
              include_reasoning: false,
              response_format: { type: "json_object" },
              messages: [
                ...messages,
                {
                  role: "user",
                  content:
                    'Return a valid JSON object only. It MUST contain a top-level "claims" array. Each item MUST contain claim, verdict, and reason. verdict MUST be exactly supported, unsupported, or unclear.',
                },
              ],
            }),
          });

          if (fallbackJsonResponse.ok) {
            response = fallbackJsonResponse;
          } else {
            const fallbackText = await fallbackJsonResponse.text().catch(() => "");
            console.error(
              "Claim verifier fallback JSON-mode provider error:",
              fallbackJsonResponse.status,
              fallbackText.slice(0, 500)
            );
            return emptyResult(
              "Verifier fallback provider returned HTTP " + fallbackJsonResponse.status + "."
            );
          }
        } else {
          const fallbackText = await fallbackResponse.text().catch(() => "");
          console.error(
            "Claim verifier fallback provider error:",
            fallbackResponse.status,
            fallbackText.slice(0, 500)
          );
          return emptyResult(
            fallbackResponse.status === 429
              ? "Verifier provider rate limit persisted on the primary and fallback models."
              : "Verifier fallback provider returned HTTP " + fallbackResponse.status + "."
          );
        }
      } else {
        return emptyResult("Verifier provider returned HTTP " + response.status + ".");
      }
    }

    const data = await response.json();
    const raw = String(data?.choices?.[0]?.message?.content || "");
    const parsed = extractJson(raw) as { claims?: unknown } | null;

    if (!parsed || !Array.isArray(parsed.claims)) {
      return emptyResult("Verifier returned an invalid structured result.");
    }

    const claims: ClaimCheck[] = parsed.claims
      .map((item: any) => ({
        claim: String(item?.claim || "").trim(),
        verdict: normalizeVerdict(item?.verdict),
        reason: String(item?.reason || "").trim(),
      }))
      .filter((item: ClaimCheck) => item.claim.length > 0);

    if (!claims.length) return emptyResult("No factual claims were extracted for verification.");

    const unsupportedClaims = claims
      .filter((item) => item.verdict === "unsupported")
      .map((item) => item.claim);

    const unclearClaims = claims
      .filter((item) => item.verdict === "unclear")
      .map((item) => item.claim);

    const supportedCount = claims.filter((item) => item.verdict === "supported").length;
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
