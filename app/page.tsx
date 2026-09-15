"use client";

import { useEffect, useMemo, useState } from "react";

type ExampleQuestion = {
  en: string;
  ur: string;
};

const services = [
  {
    en: "CNIC / NADRA",
    ur: "شناختی کارڈ / نادرا",
    icon: "🪪",
    descriptionEn: "CNIC application, renewal and related services",
    descriptionUr: "شناختی کارڈ، تجدید اور متعلقہ خدمات",
    questionEn: "How can I renew my CNIC?",
    questionUr: "میں اپنا شناختی کارڈ کیسے تجدید کروا سکتا ہوں؟",
    examples: [
      {
        en: "How can I renew my CNIC?",
        ur: "میں اپنا شناختی کارڈ کیسے تجدید کروا سکتا ہوں؟",
      },
      {
        en: "What documents are required for CNIC renewal?",
        ur: "شناختی کارڈ کی تجدید کے لیے کون سے کاغذات ضروری ہیں؟",
      },
      {
        en: "How can I apply for a new CNIC?",
        ur: "میں نئے شناختی کارڈ کے لیے کیسے درخواست دے سکتا ہوں؟",
      },
    ],
  },
  {
    en: "Passport",
    ur: "پاسپورٹ",
    icon: "🛂",
    descriptionEn: "Passport application, documents, fees and processing",
    descriptionUr: "پاسپورٹ درخواست، کاغذات، فیس اور کارروائی",
    questionEn: "What documents are required for a passport?",
    questionUr: "پاسپورٹ کے لیے کون سے کاغذات ضروری ہیں؟",
    examples: [
      {
        en: "What documents are required for a passport?",
        ur: "پاسپورٹ کے لیے کون سے کاغذات ضروری ہیں؟",
      },
      {
        en: "How long does it take to get a passport?",
        ur: "پاسپورٹ حاصل کرنے میں کتنا وقت لگتا ہے؟",
      },
      {
        en: "What is the passport fee?",
        ur: "پاسپورٹ کی فیس کتنی ہے؟",
      },
    ],
  },
  {
    en: "Driving Licence",
    ur: "ڈرائیونگ لائسنس",
    icon: "🚗",
    descriptionEn: "Licence application, renewal and requirements",
    descriptionUr: "لائسنس درخواست، تجدید اور ضروریات",
    questionEn: "How can I apply for a driving licence?",
    questionUr: "میں ڈرائیونگ لائسنس کے لیے کیسے درخواست دے سکتا ہوں؟",
    examples: [
      {
        en: "How can I apply for a driving licence?",
        ur: "میں ڈرائیونگ لائسنس کے لیے کیسے درخواست دے سکتا ہوں؟",
      },
      {
        en: "What documents are required for a driving licence?",
        ur: "ڈرائیونگ لائسنس کے لیے کون سے کاغذات ضروری ہیں؟",
      },
      {
        en: "How can I renew my driving licence?",
        ur: "میں اپنا ڈرائیونگ لائسنس کیسے تجدید کر سکتا ہوں؟",
      },
    ],
  },
  {
    en: "Domicile",
    ur: "ڈومیسائل",
    icon: "📄",
    descriptionEn: "Domicile application, documents and processing",
    descriptionUr: "ڈومیسائل درخواست، کاغذات اور کارروائی",
    questionEn: "How can I apply for a domicile certificate?",
    questionUr:
      "میں ڈومیسائل سرٹیفکیٹ کے لیے کیسے درخواست دے سکتا ہوں؟",
    examples: [
      {
        en: "How can I apply for a domicile certificate?",
        ur: "میں ڈومیسائل سرٹیفکیٹ کے لیے کیسے درخواست دے سکتا ہوں؟",
      },
      {
        en: "What documents are required for domicile?",
        ur: "ڈومیسائل کے لیے کون سے کاغذات ضروری ہیں؟",
      },
      {
        en: "How long does domicile processing take?",
        ur: "ڈومیسائل بننے میں کتنا وقت لگتا ہے؟",
      },
    ],
  },
  {
    en: "Scholarships",
    ur: "اسکالرشپس",
    icon: "🎓",
    descriptionEn: "Scholarships, eligibility and application guidance",
    descriptionUr: "اسکالرشپس، اہلیت اور درخواست کی رہنمائی",
    questionEn: "What scholarships are available for students?",
    questionUr: "طلباء کے لیے کون سی اسکالرشپس دستیاب ہیں؟",
    examples: [
      {
        en: "What scholarships are available for students?",
        ur: "طلباء کے لیے کون سی اسکالرشپس دستیاب ہیں؟",
      },
      {
        en: "How can I apply for a scholarship?",
        ur: "میں اسکالرشپ کے لیے کیسے درخواست دے سکتا ہوں؟",
      },
      {
        en: "What documents are required for scholarships?",
        ur: "اسکالرشپ کے لیے کون سے کاغذات ضروری ہیں؟",
      },
    ],
  },
  {
    en: "Other Services",
    ur: "دیگر خدمات",
    icon: "🏛️",
    descriptionEn: "Find information about other government services",
    descriptionUr: "دیگر سرکاری خدمات کے بارے میں معلومات",
    questionEn:
      "How can I find information about a government service?",
    questionUr:
      "میں کسی سرکاری سروس کے بارے میں معلومات کیسے حاصل کر سکتا ہوں؟",
    examples: [
      {
        en: "How can I find information about a government service?",
        ur: "میں کسی سرکاری سروس کے بارے میں معلومات کیسے حاصل کر سکتا ہوں؟",
      },
      {
        en: "What documents are required for a government service?",
        ur: "کسی سرکاری سروس کے لیے کون سے کاغذات ضروری ہیں؟",
      },
      {
        en: "Where can I find official government information?",
        ur: "مجھے سرکاری معلومات کہاں سے مل سکتی ہیں؟",
      },
    ],
  },
] as const;

type Service = (typeof services)[number];

type SourceInfo = {
  department?: string;
  title?: string;
  url?: string;
  lastVerified?: string;
};

type ApiResponse = {
  answer?: string;
  source?: SourceInfo | null;
  error?: string;
};

export default function Home() {
  const [urdu, setUrdu] = useState(false);
  const [selectedService, setSelectedService] =
    useState<Service>(services[0]);

  const [search, setSearch] = useState("");

  const [question, setQuestion] = useState<string>(
    services[0].questionEn
  );

  const [answer, setAnswer] = useState("");
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState("");

  const filteredServices = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return services;

    return services.filter(
      (service) =>
        service.en.toLowerCase().includes(value) ||
        service.ur.includes(value) ||
        service.descriptionEn.toLowerCase().includes(value)
    );
  }, [search]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();

        if (!loading && question.trim()) {
          askQuestion();
        }
      }
    };

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, [question, loading]);

  function selectService(service: Service) {
    setSelectedService(service);
    setQuestion(urdu ? service.questionUr : service.questionEn);
    setAnswer("");
    setSource(null);
    setError("");
    setAsked(false);

    setTimeout(() => {
      document
        .getElementById("ask-section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  function toggleLanguage() {
    const newUrdu = !urdu;

    setUrdu(newUrdu);

    setQuestion(
      newUrdu
        ? selectedService.questionUr
        : selectedService.questionEn
    );

    setAnswer("");
    setSource(null);
    setError("");
    setAsked(false);
  }

  async function askQuestion() {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || loading) return;

    setLoading(true);
    setAsked(true);
    setAnswer("");
    setSource(null);
    setError("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          service: selectedService.en,
          language: urdu ? "Urdu" : "English",
        }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to get an answer."
        );
      }

      setAnswer(data.answer || "");
      setSource(data.source || null);

      setTimeout(() => {
        document
          .getElementById("answer-box")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 150);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function useExample(example: ExampleQuestion) {
    setQuestion(urdu ? example.ur : example.en);
    setAnswer("");
    setSource(null);
    setError("");
    setAsked(false);

    setTimeout(() => {
      document
        .getElementById("ask-section")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  }

  return (
    <main className={urdu ? "urdu" : ""} dir={urdu ? "rtl" : "ltr"}>
      {/* =====================================================
          NAVIGATION
      ====================================================== */}

      <nav className="nav">
        <div className="brand">
          <div className="flag">🇵🇰</div>

          <div>
            <strong>Pakistan Citizen Helper</strong>
            <span>
              {urdu
                ? "سرکاری خدمات کی آسان رہنمائی"
                : "Simple guidance for government services"}
            </span>
          </div>
        </div>

        <button
          className="language"
          onClick={toggleLanguage}
          type="button"
          aria-label="Change language"
        >
          {urdu ? "English" : "اردو"}
        </button>
      </nav>

      {/* =====================================================
          HERO
      ====================================================== */}

      <section className="hero">
        <div className="heroContent">
          <div className="pill">
            🇵🇰{" "}
            {urdu
              ? "پاکستانی شہریوں کے لیے"
              : "For citizens of Pakistan"}
          </div>

          <h1>
            {urdu
              ? "سرکاری خدمات کی معلومات آسانی سے حاصل کریں"
              : "Government Services, Made Simple"}
          </h1>

          <p>
            {urdu
              ? "نادرا، پاسپورٹ، ڈومیسائل، ڈرائیونگ لائسنس، اسکالرشپس اور دیگر سرکاری خدمات کے بارے میں آسان رہنمائی حاصل کریں۔"
              : "Get simple, reliable guidance about CNIC, passports, domicile, driving licences, scholarships and other government services."}
          </p>

          <div className="search">
            <span>🔎</span>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                urdu
                  ? "سروس تلاش کریں..."
                  : "Search for a service..."
              }
              dir={urdu ? "rtl" : "ltr"}
              aria-label="Search services"
            />

            <button
              type="button"
              onClick={() => {
                document
                  .getElementById("services")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  });
              }}
            >
              {urdu ? "تلاش کریں" : "Explore"}
            </button>
          </div>

          <div className="trust">
            🔐{" "}
            {urdu
              ? "معلومات سرکاری ذرائع سے تصدیق شدہ ہونے کی کوشش کی جاتی ہے"
              : "Information is based on verified official sources whenever available"}
          </div>
        </div>
      </section>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}

      <div className="content">
        {/* SERVICES */}

        <section id="services">
          <div className="sectionHead">
            <div>
              <span className="eyebrow">
                {urdu ? "خدمات" : "SERVICES"}
              </span>

              <h2>
                {urdu
                  ? "آپ کو کس سروس کے بارے میں معلومات چاہیے؟"
                  : "What service do you need help with?"}
              </h2>
            </div>

            <div className="count">
              {filteredServices.length}{" "}
              {urdu ? "خدمات" : "services"}
            </div>
          </div>

          <div className="grid">
            {filteredServices.map((service) => (
              <button
                key={service.en}
                type="button"
                className="card"
                onClick={() => selectService(service)}
              >
                <div className="icon">{service.icon}</div>

                <div className="cardText">
                  <h3>
                    {urdu ? service.ur : service.en}
                  </h3>

                  <p>
                    {urdu
                      ? service.descriptionUr
                      : service.descriptionEn}
                  </p>
                </div>

                <div className="arrow">
                  {urdu ? "←" : "→"}
                </div>
              </button>
            ))}
          </div>

          {filteredServices.length === 0 && (
            <div className="notice">
              <div>🔎</div>

              <div>
                <strong>
                  {urdu
                    ? "کوئی سروس نہیں ملی"
                    : "No service found"}
                </strong>

                <p>
                  {urdu
                    ? "براہ کرم کوئی دوسرا لفظ تلاش کریں۔"
                    : "Try searching with a different word."}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ===================================================
            ASK AI
        ==================================================== */}

        <section className="ask" id="ask-section">
          <div className="askIcon">🤖</div>

          <div className="askContent">
            <span className="eyebrow">
              {urdu ? "اے آئی مددگار" : "AI ASSISTANT"}
            </span>

            <h2>
              {urdu
                ? "اپنا سوال پوچھیں"
                : "Ask your question"}
            </h2>

            <p>
              {urdu
                ? "منتخب سروس کے بارے میں اپنا سوال لکھیں۔"
                : "Ask a question about the selected government service."}
            </p>

            <div className="questionBox">
              <textarea
                value={question}
                onChange={(event) =>
                  setQuestion(event.target.value)
                }
                placeholder={
                  urdu
                    ? "اپنا سوال یہاں لکھیں..."
                    : "Write your question here..."
                }
                dir={urdu ? "rtl" : "ltr"}
                disabled={loading}
              />

              <button
                className="askButton"
                type="button"
                onClick={askQuestion}
                disabled={loading || !question.trim()}
              >
                {loading
                  ? urdu
                    ? "جواب تیار کیا جا رہا ہے..."
                    : "Preparing answer..."
                  : urdu
                    ? "جواب حاصل کریں →"
                    : "Get Answer →"}
              </button>
            </div>

            {/* EXAMPLES */}

            <div className="examples">
              <span>
                {urdu
                  ? "مثالی سوالات:"
                  : "Example questions:"}
              </span>

              <div className="exampleList">
                {selectedService.examples.map(
                  (example, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => useExample(example)}
                      disabled={loading}
                    >
                      {urdu ? example.ur : example.en}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* LOADING */}

            {loading && (
              <div className="loadingBox">
                <div className="loadingIcon">🤖</div>

                <div>
                  <strong>
                    {urdu
                      ? "سرکاری معلومات کی بنیاد پر جواب تیار کیا جا رہا ہے"
                      : "Preparing an answer from verified information"}
                  </strong>

                  <div className="loadingDots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            {/* ERROR */}

            {error && !loading && (
              <div className="notice">
                <div>⚠️</div>

                <div>
                  <strong>
                    {urdu
                      ? "جواب حاصل نہیں ہو سکا"
                      : "Unable to get an answer"}
                  </strong>

                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* =================================================
                ANSWER
            ================================================== */}

            {asked && answer && !loading && (
              <div className="answerBox" id="answer-box">
                <div className="answerHeader">
                  <div className="answerHeaderLeft">
                    <div className="answerRobot">🤖</div>

                    <div>
                      <strong>
                        {urdu
                          ? "پاکستان سٹیزن ہیلپر"
                          : "Pakistan Citizen Helper"}
                      </strong>

                      <span>
                        {urdu
                          ? "اے آئی معاون جواب"
                          : "AI-assisted guidance"}
                      </span>
                    </div>
                  </div>

                  <div className="answerBadge">
                    {urdu ? "تصدیق شدہ" : "VERIFIED"}
                  </div>
                </div>

                <div className="questionSummary">
                  <span>
                    {urdu ? "آپ کا سوال" : "YOUR QUESTION"}
                  </span>

                  <p>{question}</p>
                </div>

                <div
                  className="answerContent"
                  dir={urdu ? "rtl" : "ltr"}
                >
                  <AnswerRenderer answer={answer} />
                </div>

                {/* VERIFICATION */}

                <div className="verificationBox">
                  <div className="verificationIcon">
                    🔎
                  </div>

                  <div>
                    <strong>
                      {urdu
                        ? "اہم تصدیقی نوٹ"
                        : "Important verification note"}
                    </strong>

                    <p>
                      {urdu
                        ? "سرکاری قواعد، فیس اور ضروریات وقت کے ساتھ تبدیل ہو سکتی ہیں۔ درخواست دینے سے پہلے متعلقہ سرکاری ادارے کے تازہ ترین ذرائع کو ضرور چیک کریں۔"
                        : "Government rules, fees and requirements can change. Please check the latest information from the relevant official department before applying."}
                    </p>
                  </div>
                </div>

                {/* SOURCE */}

                {source && (
                  <div className="answerFooter">
                    <div>
                      <strong>
                        {urdu
                          ? "سرکاری ذریعہ: "
                          : "Official source: "}
                      </strong>

                      {source.department ||
                        "Official Government Department"}
                    </div>

                    <div>
                      {source.lastVerified && (
                        <>
                          {urdu
                            ? "آخری تصدیق: "
                            : "Last verified: "}
                          {source.lastVerified}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {source?.url && (
                  <div
                    style={{
                      padding: "0 21px 18px",
                      background: "#f8fbf9",
                    }}
                  >
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        background: "#e8f5ed",
                        color: "#126c3b",
                        fontWeight: 800,
                        textDecoration: "none",
                      }}
                    >
                      🔗{" "}
                      {urdu
                        ? "سرکاری ذریعہ دیکھیں"
                        : "View Official Source"}
                    </a>

                    {source.title && (
                      <div
                        style={{
                          marginTop: "8px",
                          color: "#718078",
                          fontSize: "12px",
                        }}
                      >
                        {source.title}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* GENERAL NOTICE */}

            <div className="notice">
              <div>⚠️</div>

              <div>
                <strong>
                  {urdu
                    ? "اہم معلومات"
                    : "Important information"}
                </strong>

                <p>
                  {urdu
                    ? "یہ سروس شہریوں کی رہنمائی کے لیے ہے۔ حتمی فیصلہ اور تازہ ترین معلومات ہمیشہ متعلقہ سرکاری ادارے سے حاصل کریں۔"
                    : "This service is intended to help citizens understand government procedures. Always confirm final requirements and current information with the relevant government department."}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* =====================================================
          FOOTER
      ====================================================== */}

      <footer>
        <strong>🇵🇰 Pakistan Citizen Helper</strong>

        <span>
          {urdu
            ? "پاکستانی شہریوں کے لیے آسان سرکاری معلومات"
            : "Simple government-service guidance for Pakistani citizens"}
        </span>

        <span>
          Developed by Raees Khan • Assistant Director, NADRA
        </span>

        <small>
          {urdu
            ? "معلومات متعلقہ سرکاری ذرائع سے تصدیق کرنے کی سفارش کی جاتی ہے۔"
            : "Always verify important information with the relevant official source."}
        </small>
      </footer>
    </main>
  );
}

/* =========================================================
   ANSWER RENDERER
   Converts basic AI markdown into readable HTML.
========================================================= */

function AnswerRenderer({ answer }: { answer: string }) {
  const lines = answer.split(/\r?\n/);

  const elements: React.ReactNode[] = [];
  let bulletItems: string[] = [];
  let numberedItems: string[] = [];

  function flushBullets() {
    if (bulletItems.length === 0) return;

    elements.push(
      <ul className="answerList" key={`ul-${elements.length}`}>
        {bulletItems.map((item, index) => (
          <li
            key={index}
            dangerouslySetInnerHTML={{
              __html: formatInline(item),
            }}
          />
        ))}
      </ul>
    );

    bulletItems = [];
  }

  function flushNumbered() {
    if (numberedItems.length === 0) return;

    elements.push(
      <ol
        className="answerNumberedList"
        key={`ol-${elements.length}`}
      >
        {numberedItems.map((item, index) => (
          <li
            key={index}
            dangerouslySetInnerHTML={{
              __html: formatInline(item),
            }}
          />
        ))}
      </ol>
    );

    numberedItems = [];
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      flushBullets();
      flushNumbered();
      return;
    }

    /* Markdown table rows are handled as normal text
       rather than breaking the answer. */

    if (/^[-*•]\s+/.test(line)) {
      flushNumbered();

      bulletItems.push(
        line.replace(/^[-*•]\s+/, "")
      );

      return;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      flushBullets();

      numberedItems.push(
        line.replace(/^\d+[.)]\s+/, "")
      );

      return;
    }

    flushBullets();
    flushNumbered();

    if (/^###\s+/.test(line)) {
      elements.push(
        <h4
          className="answerHeading small"
          key={index}
          dangerouslySetInnerHTML={{
            __html: formatInline(
              line.replace(/^###\s+/, "")
            ),
          }}
        />
      );

      return;
    }

    if (/^##\s+/.test(line)) {
      elements.push(
        <h3
          className="answerHeading"
          key={index}
          dangerouslySetInnerHTML={{
            __html: formatInline(
              line.replace(/^##\s+/, "")
            ),
          }}
        />
      );

      return;
    }

    if (/^#\s+/.test(line)) {
      elements.push(
        <h2
          className="answerHeading large"
          key={index}
          dangerouslySetInnerHTML={{
            __html: formatInline(
              line.replace(/^#\s+/, "")
            ),
          }}
        />
      );

      return;
    }

    elements.push(
      <p
        className="answerParagraph"
        key={index}
        dangerouslySetInnerHTML={{
          __html: formatInline(line),
        }}
      />
    );
  });

  flushBullets();
  flushNumbered();

  return <>{elements}</>;
}

function formatInline(text: string) {
  let html = escapeHtml(text);

  /* Links */

  html = html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  /* Bold */

  html = html.replace(
    /\*\*(.*?)\*\*/g,
    "<strong>$1</strong>"
  );

  /* Italic */

  html = html.replace(
    /\*(.*?)\*/g,
    "<em>$1</em>"
  );

  return html;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
