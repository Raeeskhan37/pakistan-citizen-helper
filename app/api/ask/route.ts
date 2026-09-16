import { NextResponse } from "next/server";

type ServiceRecord = {
  id?: number;
  service_name?: string;
  category?: string;
  title?: string;
  content_en?: string;
  content_ur?: string;
  province?: string;
  official_department?: string;
  official_source_title?: string;
  official_source_url?: string;
  last_verified?: string;
  active?: boolean;
};

// ============================================================
// TEXT NORMALIZATION
// ============================================================

function normalize(value: string = ""): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================
// SERVICE GROUPS
// ============================================================

const SERVICE_GROUPS: Record<string, string[]> = {
  cnic: [
    "cnic",
    "smart cnic",
    "cnic nadra",
    "nadra",
    "identity card",
    "national identity card",
    "nic",
    "pakid",
  ],

  passport: [
    "passport",
    "pakistani passport",
    "passport office",
    "immigration",
  ],

  domicile: [
    "domicile",
    "domicile certificate",
  ],

  driving: [
    "driving licence",
    "driving license",
    "license",
    "licence",
    "traffic police",
  ],

  scholarship: [
    "scholarship",
    "scholarships",
    "student scholarship",
    "education scholarship",
  ],

  jobs: [
    "government job",
    "government jobs",
    "govt job",
    "govt jobs",
    "job",
    "jobs",
    "vacancy",
    "vacancies",
  ],

  police: [
    "police",
    "police clearance",
    "character certificate",
    "fir",
    "first information report",
  ],

  fbr: [
    "fbr",
    "tax",
    "taxation",
    "income tax",
    "ntn",
    "filer",
  ],

  land: [
    "land",
    "land record",
    "revenue",
    "property",
    "mutation",
    "intiqal",
    "fard",
  ],
};

// ============================================================
// EXACT TOPIC GROUPS
// ============================================================

const TOPIC_GROUPS: Record<string, string[]> = {
  "cnic-new": [
    "new cnic",
    "apply for cnic",
    "apply for a new cnic",
    "first cnic",
    "first time cnic",
    "make cnic",
    "get cnic",
  ],

  "cnic-renewal": [
    "cnic renewal",
    "renew cnic",
    "renew my cnic",
    "renewal of cnic",
    "expired cnic",
    "expiry cnic",
  ],

  "cnic-modification": [
    "cnic modification",
    "modify cnic",
    "modify my cnic",
    "cnic correction",
    "correct cnic",
    "change information on cnic",
    "change details on cnic",
    "update cnic information",
  ],

  "cnic-father-name": [
    "father name",
    "father's name",
    "fathers name",
    "father name correction",
    "correct father name",
    "change father name",
    "father name incorrect",
    "father name wrong",
  ],

  "cnic-mother-name": [
    "mother name",
    "mother's name",
    "mothers name",
    "mother name correction",
    "correct mother name",
    "change mother name",
    "mother name incorrect",
    "mother name wrong",
  ],

  "cnic-dob": [
    "date of birth",
    "dob",
    "birth date",
    "date of birth correction",
    "correct date of birth",
    "change date of birth",
    "dob correction",
    "dob wrong",
    "date of birth wrong",
  ],

  "cnic-name": [
    "name correction",
    "correct my name",
    "change my name",
    "name is incorrect",
    "name is wrong",
    "name wrong on cnic",
  ],

  "cnic-address": [
    "address correction",
    "change address",
    "change my address",
    "update address",
    "address modification",
    "address is incorrect",
    "address is wrong",
    "wrong address",
  ],

  "cnic-lost": [
    "lost cnic",
    "cnic lost",
    "lost my cnic",
    "duplicate cnic",
    "reprint cnic",
    "cnic reprint",
    "replace lost cnic",
  ],

  "cnic-fee": [
    "cnic fee",
    "cnic fees",
    "modification fee",
    "renewal fee",
    "new cnic fee",
    "how much cnic",
    "cost of cnic",
  ],

  "cnic-processing-time": [
    "processing time",
    "how long",
    "how many days",
    "delivery time",
    "cnic delivery",
    "urgent cnic",
    "executive cnic",
    "normal cnic",
  ],

  "passport-new": [
    "new passport",
    "apply for passport",
    "passport application",
    "first passport",
  ],

  "domicile": [
    "domicile",
    "domicile certificate",
    "apply domicile",
    "domicile application",
  ],

  "driving": [
    "driving licence",
    "driving license",
    "learner licence",
    "learner license",
    "driving test",
    "license renewal",
  ],

  "scholarship": [
    "scholarship",
    "scholarships",
    "apply scholarship",
    "scholarship application",
  ],

  "government-job": [
    "government job",
    "government jobs",
    "govt job",
    "job application",
    "government vacancy",
  ],
};

// ============================================================
// SERVICE DETECTION
// ============================================================

function normalizeServiceName(serviceName: string = ""): string {
  const text = normalize(serviceName);

  for (const [group, aliases] of Object.entries(SERVICE_GROUPS)) {
    if (
      aliases.some((alias) =>
        text.includes(normalize(alias))
      )
    ) {
      return group;
    }
  }

  return text;
}

function detectServiceFromQuestion(
  question: string
): string | null {
  const text = normalize(question);

  for (const [group, aliases] of Object.entries(
    SERVICE_GROUPS
  )) {
    if (
      aliases.some((alias) =>
        text.includes(normalize(alias))
      )
    ) {
      return group;
    }
  }

  return null;
}

// ============================================================
// TOPIC DETECTION
// ============================================================

function detectTopic(
  question: string
): string | null {
  const text = normalize(question);

  const priorityTopics = [
    "cnic-father-name",
    "cnic-mother-name",
    "cnic-dob",
    "cnic-address",
    "cnic-name",
    "cnic-lost",
    "cnic-fee",
    "cnic-processing-time",
    "cnic-new",
    "cnic-renewal",
    "cnic-modification",
    "passport-new",
    "domicile",
    "driving",
    "scholarship",
    "government-job",
  ];

  for (const topic of priorityTopics) {
    const aliases = TOPIC_GROUPS[topic] || [];

    if (
      aliases.some((alias) =>
        text.includes(normalize(alias))
      )
    ) {
      return topic;
    }
  }

  return null;
}

// ============================================================
// JURISDICTION
// ============================================================

function detectJurisdiction(
  question: string
): string | null {
  const text = normalize(question);

  if (text.includes("punjab")) return "Punjab";
  if (text.includes("sindh")) return "Sindh";
  if (text.includes("balochistan")) return "Balochistan";

  if (
    text.includes("khyber pakhtunkhwa") ||
    text.includes("kpk") ||
    text.includes("kp")
  ) {
    return "Khyber Pakhtunkhwa";
  }

  if (text.includes("islamabad")) return "Islamabad";
  if (text.includes("gilgit")) return "Gilgit-Baltistan";
  if (text.includes("azad kashmir")) {
    return "Azad Jammu and Kashmir";
  }

  return null;
}

// ============================================================
// RECORD TOPIC MATCHING
// ============================================================

function recordMatchesTopic(
  record: ServiceRecord,
  topic: string | null
): boolean {
  if (!topic) return true;

  const searchable = normalize(
    [
      record.service_name,
      record.category,
      record.title,
      record.content_en,
      record.content_ur,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const aliases = TOPIC_GROUPS[topic] || [];

  return aliases.some((alias) =>
    searchable.includes(normalize(alias))
  );
}

// ============================================================
// RECORD SCORING
// ============================================================

function scoreRecord(
  record: ServiceRecord,
  question: string,
  service: string | null,
  topic: string | null,
  jurisdiction: string | null
): number {
  const q = normalize(question);

  const serviceName = normalizeServiceName(
    record.service_name || ""
  );

  const category = normalize(
    record.category || ""
  );

  const title = normalize(
    record.title || ""
  );

  const content = normalize(
    record.content_en || ""
  );

  let score = 0;

  if (service && serviceName === service) {
    score += 100;
  }

  if (
    topic &&
    recordMatchesTopic(record, topic)
  ) {
    score += 200;
  }

  const words = q
    .split(" ")
    .filter((word) => word.length > 2);

  for (const word of words) {
    if (category.includes(word)) score += 8;
    if (title.includes(word)) score += 6;
    if (content.includes(word)) score += 1;
  }

  if (jurisdiction) {
    const province = normalize(
      record.province || ""
    );

    if (
      province === normalize(jurisdiction)
    ) {
      score += 50;
    } else if (province === "pakistan") {
      score += 20;
    }
  }

  if (record.active !== false) {
    score += 5;
  }

  return score;
}

// ============================================================
// SELECT RECORDS
// ============================================================

function selectRecords(
  records: ServiceRecord[],
  question: string
): ServiceRecord[] {
  const service =
    detectServiceFromQuestion(question);

  const topic =
    detectTopic(question);

  const jurisdiction =
    detectJurisdiction(question);

  let candidates = records.filter(
    (record) => record.active !== false
  );

  if (service) {
    const serviceCandidates =
      candidates.filter(
        (record) =>
          normalizeServiceName(
            record.service_name || ""
          ) === service
      );

    if (serviceCandidates.length > 0) {
      candidates = serviceCandidates;
    }
  }

  if (topic) {
    const topicCandidates =
      candidates.filter((record) =>
        recordMatchesTopic(record, topic)
      );

    if (topicCandidates.length > 0) {
      candidates = topicCandidates;
    }
  }

  candidates = candidates
    .map((record) => ({
      record,
      score: scoreRecord(
        record,
        question,
        service,
        topic,
        jurisdiction
      ),
    }))
    .sort(
      (a, b) => b.score - a.score
    )
    .map((item) => item.record);

  return candidates.slice(0, 5);
}

// ============================================================
// BUILD VERIFIED CONTEXT
// ============================================================

function buildVerifiedContext(
  records: ServiceRecord[]
): string {
  if (records.length === 0) {
    return "No verified record was found.";
  }

  return records
    .map((record, index) => {
      return `
VERIFIED RECORD ${index + 1}

Service:
${record.service_name || ""}

Category:
${record.category || ""}

Title:
${record.title || ""}

Verified English Information:
${record.content_en || ""}

Verified Urdu Information:
${record.content_ur || ""}

Province/Jurisdiction:
${record.province || ""}

Official Department:
${record.official_department || ""}

Official Source:
${record.official_source_title || ""}

Official Source URL:
${record.official_source_url || ""}

Last Verified:
${record.last_verified || ""}
`;
    })
    .join(
      "\n-----------------------------\n"
    );
}

// ============================================================
// POST API
// ============================================================

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const question =
      typeof body.question === "string"
        ? body.question.trim()
        : "";

    const language =
      body.language === "ur"
        ? "ur"
        : "en";

    if (!question) {
      return NextResponse.json(
        {
          answer:
            language === "ur"
              ? "براہ کرم اپنا سوال لکھیں۔"
              : "Please enter your question.",
        },
        { status: 400 }
      );
    }

    // ========================================================
    // ENVIRONMENT VARIABLES
    // ========================================================

    const supabaseUrl =
      process.env.SUPABASE_URL;

    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY;

    const groqApiKey =
      process.env.GROQ_API_KEY;

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !groqApiKey
    ) {
      return NextResponse.json(
        {
          answer:
            "⚠️ Server configuration is incomplete. Check the Vercel environment variables.",
        },
        { status: 500 }
      );
    }

    // ========================================================
    // GET VERIFIED INFORMATION FROM SUPABASE
    // ========================================================

    const supabaseResponse =
      await fetch(
        `${supabaseUrl}/rest/v1/verified_information?active=eq.true&select=*`,
        {
          method: "GET",
          headers: {
            apikey: supabaseAnonKey,
            Authorization:
              `Bearer ${supabaseAnonKey}`,
            "Content-Type":
              "application/json",
          },
          cache: "no-store",
        }
      );

    if (!supabaseResponse.ok) {
      const errorText =
        await supabaseResponse.text();

      console.error(
        "Supabase error:",
        supabaseResponse.status,
        errorText
      );

      return NextResponse.json(
        {
          answer:
            language === "ur"
              ? "ویری فائیڈ معلومات حاصل کرنے میں مسئلہ پیش آیا۔"
              : "There was a problem retrieving verified information.",
        },
        { status: 500 }
      );
    }

    const records =
      (await supabaseResponse.json()) as ServiceRecord[];

    // ========================================================
    // SELECT RELEVANT VERIFIED RECORDS
    // ========================================================

    const selectedRecords =
      selectRecords(
        records,
        question
      );

    if (
      selectedRecords.length === 0
    ) {
      return NextResponse.json({
        answer:
          language === "ur"
            ? "اس سوال کے لیے ہمارے تصدیق شدہ ریکارڈ میں معلومات موجود نہیں ہیں۔"
            : "The verified records do not contain information for this question.",
        source: null,
      });
    }

    const verifiedContext =
      buildVerifiedContext(
        selectedRecords
      );

    const detectedTopic =
      detectTopic(question);

    // ========================================================
    // STRICT AI PROMPT
    // ========================================================

    const systemPrompt = `
You are Pakistan Citizen Helper.

Answer Pakistani government service questions using ONLY
the verified information supplied below.

IMPORTANT RULES:

1. Answer ONLY the exact subject asked by the user.

2. Do NOT give unrelated information.

3. Do NOT mix different service topics.

4. If the user asks about father's name, answer only about
   father's name.

5. If the user asks about mother's name, answer only about
   mother's name.

6. If the user asks about date of birth, answer only about
   date of birth.

7. If the user asks about address, answer only about address.

8. If the user asks about fees, answer only about fees.

9. If the user asks about processing time, answer only about
   processing time.

10. If the verified records do not contain enough information
    for the exact question, say so clearly.

11. Never invent documents, fees, dates, requirements or
    procedures.

12. Do not guess.

13. Keep the answer concise and practical.

14. Mention the official source when appropriate.

15. Answer in ${
      language === "ur"
        ? "Urdu"
        : "English"
    }.

Detected topic:
${
  detectedTopic ||
  "General service question"
}

Verified information:
${verifiedContext}
`;

    // ========================================================
    // GROQ
    // ========================================================

    const groqResponse =
      await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${groqApiKey}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            model:
              "openai/gpt-oss-120b",

            temperature: 0.1,

            max_completion_tokens: 900,

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
          }),
        }
      );

    if (!groqResponse.ok) {
      const errorText =
        await groqResponse.text();

      console.error(
        "Groq error:",
        groqResponse.status,
        errorText
      );

      return NextResponse.json(
        {
          answer:
            language === "ur"
              ? "AI جواب تیار کرنے میں مسئلہ پیش آیا۔ براہ کرم دوبارہ کوشش کریں۔"
              : "There was a problem generating the AI answer. Please try again.",
        },
        { status: 500 }
      );
    }

    const groqData =
      await groqResponse.json();

    const answer =
      groqData?.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return NextResponse.json(
        {
          answer:
            language === "ur"
              ? "اس سوال کا جواب تیار نہیں کیا جا سکا۔"
              : "An answer could not be generated for this question.",
        },
        { status: 500 }
      );
    }

    // ========================================================
    // SOURCE
    // ========================================================

    const primarySource =
      selectedRecords[0];

    return NextResponse.json({
      answer,

      source: {
        title:
          primarySource.official_source_title ||
          primarySource.title ||
          "Official Government Source",

        url:
          primarySource.official_source_url ||
          "",

        department:
          primarySource.official_department ||
          "",

        last_verified:
          primarySource.last_verified ||
          "",
      },
    });
  } catch (error) {
    console.error(
      "API error:",
      error
    );

    return NextResponse.json(
      {
        answer:
          "An unexpected server error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}

Now do only these 4 steps

1. GitHub → "version-2"
2. Replace the entire "app/api/ask/route.ts" with the code above.
3. Commit the change.
4. Wait for Vercel to show Ready.

Then test:

How can I modify my date of birth in my CNIC?

If it fails again, open Vercel Runtime Logs and send me the new error. Don't change anything else yet.

One important point: this file now correctly uses your actual Supabase table:

"verified_information"

and not "citizen_services".
