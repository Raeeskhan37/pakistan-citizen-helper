"use client";

import { useState } from "react";

/* =========================================================
   SERVICES
========================================================= */

const services = [
  {
    icon: "🪪",
    en: "CNIC / NADRA",
    ur: "شناختی کارڈ / نادرا",
    textEn: "Documents, renewal and general guidance",
    textUr: "دستاویزات، تجدید اور عمومی رہنمائی",

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
        ur: "نیا شناختی کارڈ کیسے بنوایا جا سکتا ہے؟",
      },
    ],
  },

  {
    icon: "🛂",
    en: "Passport",
    ur: "پاسپورٹ",
    textEn: "Application and renewal guidance",
    textUr: "درخواست اور تجدید کی رہنمائی",

    questionEn: "What documents are required for a passport?",
    questionUr: "پاسپورٹ کے لیے کون سے کاغذات ضروری ہیں؟",

    examples: [
      {
        en: "What documents are required for a passport?",
        ur: "پاسپورٹ کے لیے کون سے کاغذات ضروری ہیں؟",
      },
      {
        en: "How long does it take to get a passport?",
        ur: "پاسپورٹ بننے میں کتنا وقت لگتا ہے؟",
      },
      {
        en: "What is the passport fee?",
        ur: "پاسپورٹ کی فیس کتنی ہے؟",
      },
    ],
  },

  {
    icon: "🚗",
    en: "Driving Licence",
    ur: "ڈرائیونگ لائسنس",
    textEn: "General licence information",
    textUr: "لائسنس سے متعلق عمومی معلومات",

    questionEn: "How can I apply for a driving licence?",
    questionUr:
      "میں ڈرائیونگ لائسنس کے لیے کیسے درخواست دے سکتا ہوں؟",

    examples: [
      {
        en: "How can I apply for a driving licence?",
        ur: "میں ڈرائیونگ لائسنس کے لیے کیسے درخواست دے سکتا ہوں؟",
      },
      {
        en: "How can I renew my driving licence?",
        ur: "میں اپنا ڈرائیونگ لائسنس کیسے تجدید کروا سکتا ہوں؟",
      },
      {
        en: "What documents are required for a driving licence?",
        ur: "ڈرائیونگ لائسنس کے لیے کون سے کاغذات ضروری ہیں؟",
      },
    ],
  },

  {
    icon: "🏠",
    en: "Domicile",
    ur: "ڈومیسائل",
    textEn: "Requirements and application guidance",
    textUr: "ضروریات اور درخواست کی رہنمائی",

    questionEn: "How can I apply for a domicile?",
    questionUr:
      "میں ڈومیسائل کے لیے کیسے درخواست دے سکتا ہوں؟",

    examples: [
      {
        en: "How can I apply for a domicile?",
        ur: "میں ڈومیسائل کے لیے کیسے درخواست دے سکتا ہوں؟",
      },
      {
        en: "What documents are required for a domicile?",
        ur: "ڈومیسائل کے لیے کون سے کاغذات ضروری ہیں؟",
      },
      {
        en: "How long does a domicile application take?",
        ur: "ڈومیسائل بننے میں کتنا وقت لگتا ہے؟",
      },
    ],
  },

  {
    icon: "🎓",
    en: "Scholarships",
    ur: "اسکالرشپس",
    textEn: "Find eligibility and official information",
    textUr: "اہلیت اور سرکاری معلومات تلاش کریں",

    questionEn:
      "What scholarships are available for Pakistani students?",
    questionUr:
      "پاکستانی طلباء کے لیے کون سی اسکالرشپس دستیاب ہیں؟",

    examples: [
      {
        en: "What scholarships are available for Pakistani students?",
        ur: "پاکستانی طلباء کے لیے کون سی اسکالرشپس دستیاب ہیں؟",
      },
      {
        en: "What are the eligibility requirements for scholarships?",
        ur: "اسکالرشپ کے لیے اہلیت کے تقاضے کیا ہیں؟",
      },
      {
        en: "How can I apply for a scholarship?",
        ur: "میں اسکالرشپ کے لیے کیسے درخواست دے سکتا ہوں؟",
      },
    ],
  },

  {
    icon: "🔎",
    en: "Other Services",
    ur: "دیگر سروسز",
    textEn: "Ask about another public service",
    textUr: "کسی دوسری سرکاری سروس کے بارے میں پوچھیں",

    questionEn:
      "I need information about a government service.",
    questionUr:
      "مجھے ایک سرکاری سروس کے بارے میں معلومات چاہیے۔",

    examples: [
      {
        en: "How can I apply for a government service?",
        ur: "میں کسی سرکاری سروس کے لیے کیسے درخواست دے سکتا ہوں؟",
      },
      {
        en: "What documents are required?",
        ur: "کون سے کاغذات ضروری ہیں؟",
      },
      {
        en: "Where can I find the official information?",
        ur: "مجھے سرکاری معلومات کہاں سے مل سکتی ہیں؟",
      },
    ],
  },
];

/* =========================================================
   MARKDOWN ANSWER RENDERER
========================================================= */

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  let bulletItems: string[] = [];
  let numberedItems: string[] = [];
  let tableRows: string[][] = [];
  let insideTable = false;

  function flushBullets() {
    if (bulletItems.length > 0) {
      elements.push(
        <ul
          className="answerList"
          key={`bullets-${elements.length}`}
        >
          {bulletItems.map((item, index) => (
            <li key={index}>{formatInline(item)}</li>
          ))}
        </ul>
      );

      bulletItems = [];
    }
  }

  function flushNumbered() {
    if (numberedItems.length > 0) {
      elements.push(
        <ol
          className="answerNumberedList"
          key={`numbers-${elements.length}`}
        >
          {numberedItems.map((item, index) => (
            <li key={index}>{formatInline(item)}</li>
          ))}
        </ol>
      );

      numberedItems = [];
    }
  }

  function flushTable() {
    if (tableRows.length >= 2) {
      const header = tableRows[0];
      const rows = tableRows.slice(1);

      elements.push(
        <div
          className="answerTableWrapper"
          key={`table-${elements.length}`}
        >
          <table className="answerTable">
            <thead>
              <tr>
                {header.map((cell, index) => (
                  <th key={index}>{formatInline(cell)}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {header.map((_, cellIndex) => (
                    <td key={cellIndex}>
                      {formatInline(row[cellIndex] || "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    tableRows = [];
    insideTable = false;
  }

  function formatInline(value: string) {
    const parts = value.split(
      /(\*\*.*?\*\*|\[.*?\]\(.*?\)|https?:\/\/[^\s]+)/
    );

    return parts.map((part, index) => {
      if (!part) return null;

      if (
        part.startsWith("**") &&
        part.endsWith("**")
      ) {
        return (
          <strong key={index}>
            {part.slice(2, -2)}
          </strong>
        );
      }

      const markdownLink = part.match(
        /^\[(.*?)\]\((.*?)\)$/
      );

      if (markdownLink) {
        return (
          <a
            key={index}
            href={markdownLink[2]}
            target="_blank"
            rel="noopener noreferrer"
          >
            {markdownLink[1]}
          </a>
        );
      }

      if (
        part.startsWith("http://") ||
        part.startsWith("https://")
      ) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
          >
            Official source
          </a>
        );
      }

      return <span key={index}>{part}</span>;
    });
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      flushBullets();
      flushNumbered();

      if (insideTable) {
        flushTable();
      }

      return;
    }

    if (line.includes("|")) {
      const cells = line
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);

      const isSeparator = cells.every((cell) =>
        /^:?-{3,}:?$/.test(cell)
      );

      if (isSeparator) {
        insideTable = true;
        return;
      }

      if (!insideTable && tableRows.length === 0) {
        insideTable = true;
      }

      tableRows.push(cells);
      return;
    }

    if (insideTable) {
      flushTable();
    }

    if (/^[-*•]\s+/.test(line)) {
      flushNumbered();

      bulletItems.push(
        line.replace(/^[-*•]\s+/, "")
      );

      return;
    }

    if (/^\d+[\.\)]\s+/.test(line)) {
      flushBullets();

      numberedItems.push(
        line.replace(/^\d+[\.\)]\s+/, "")
      );

      return;
    }

    flushBullets();
    flushNumbered();

    if (line.startsWith("### ")) {
      elements.push(
        <h4
          className="answerHeading small"
          key={`h-${index}`}
        >
          {formatInline(
            line.replace(/^###\s+/, "")
          )}
        </h4>
      );

      return;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <h3
          className="answerHeading"
          key={`h-${index}`}
        >
          {formatInline(
            line.replace(/^##\s+/, "")
          )}
        </h3>
      );

      return;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <h2
          className="answerHeading large"
          key={`h-${index}`}
        >
          {formatInline(
            line.replace(/^#\s+/, "")
          )}
        </h2>
      );

      return;
    }

    elements.push(
      <p
        className="answerParagraph"
        key={`p-${index}`}
      >
        {formatInline(line)}
      </p>
    );
  });

  flushBullets();
  flushNumbered();

  if (insideTable) {
    flushTable();
  }

  return elements;
}

/* =========================================================
   TYPES
========================================================= */

type Service = (typeof services)[number];

type SourceInfo = {
  department?: string;
  title?: string;
  url?: string;
  lastVerified?: string;
};

type ApiResponse = {
  answer?: string;
  source?: SourceInfo;
  error?: string;
};

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function Home() {
  const [urdu, setUrdu] = useState(false);

  const [query, setQuery] = useState("");

  const [question, setQuestion] = useState(
    services[0].questionEn
  );

  const [answer, setAnswer] = useState("");

  const [source, setSource] =
    useState<SourceInfo | null>(null);

  const [asked, setAsked] = useState(false);

  const [loading, setLoading] = useState(false);

  const [selectedService, setSelectedService] =
    useState<Service>(services[0]);

  /* =======================================================
     SERVICE SELECTION
  ======================================================= */

  function selectService(service: Service) {
    setSelectedService(service);

    setQuery(service.en);

    setQuestion(
      urdu
        ? service.questionUr
        : service.questionEn
    );

    setAsked(false);
    setAnswer("");
    setSource(null);

    setTimeout(() => {
      document
        .getElementById("ask")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 50);
  }

  /* =======================================================
     SERVICE-SPECIFIC EXAMPLES
  ======================================================= */

  function getServiceExamples(service: Service) {
    return service.examples;
  }

  /* =======================================================
     SERVICE SEARCH
  ======================================================= */

  const visibleServices = services.filter(
    (service) => {
      const searchableText =
        `${service.en} ${service.ur} ${service.textEn} ${service.textUr}`.toLowerCase();

      return searchableText.includes(
        query.toLowerCase()
      );
    }
  );

  /* =======================================================
     ASK QUESTION
  ======================================================= */

  async function askQuestion() {
    if (!question.trim() || loading) return;

    setLoading(true);
    setAsked(false);
    setAnswer("");
    setSource(null);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          question: question.trim(),
        }),
      });

      const data: ApiResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to get an AI response."
        );
      }

      setAnswer(
        data.answer ||
          "No answer was returned."
      );

      if (
        data.source &&
        data.source.url
      ) {
        setSource({
          department:
            data.source.department,

          title:
            data.source.title,

          url:
            data.source.url,

          lastVerified:
            data.source.lastVerified,
        });
      } else {
        setSource(null);
      }

      setAsked(true);

      setTimeout(() => {
        document
          .getElementById(
            "answer-result"
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 100);
    } catch (error) {
      console.error(error);

      setSource(null);

      setAnswer(
        urdu
          ? "معذرت، اس وقت AI سروس سے جواب حاصل نہیں ہو سکا۔ براہ کرم دوبارہ کوشش کریں۔"
          : "Sorry, I could not get a response from the AI service. Please try again."
      );

      setAsked(true);
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     CHOOSE EXAMPLE
  ======================================================= */

  function chooseExample(text: string) {
    setQuestion(text);

    setAsked(false);
    setAnswer("");
    setSource(null);
  }

  /* =======================================================
     LANGUAGE TOGGLE
  ======================================================= */

  function toggleLanguage() {
    const nextUrdu = !urdu;

    setUrdu(nextUrdu);

    setQuestion(
      nextUrdu
        ? selectedService.questionUr
        : selectedService.questionEn
    );
  }

  return (
    <main>

      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <nav className="nav">

        <div className="brand">

          <div className="flag">
            🇵🇰
          </div>

          <div>
            <strong>
              Pakistan Citizen Helper
            </strong>

            <span>
              پاکستان سٹیزن ہیلپر
            </span>
          </div>

        </div>

        <button
          className="language"
          onClick={toggleLanguage}
        >
          {urdu
            ? "English"
            : "اردو"}
        </button>

      </nav>

      {/* =====================================================
          HERO
      ===================================================== */}

      <section className="hero">

        <div className="heroContent">

          <div className="pill">
            🇵🇰{" "}
            {urdu
              ? "شہریوں کے لیے آسان معلومات"
              : "Simple information for citizens"}
          </div>

          <h1>
            {urdu
              ? "اپنا سرکاری کام آسانی سے سمجھیں"
              : "Understand your government service, simply."}
          </h1>

          <p>
            {urdu
              ? "مطلوبہ کاغذات، مراحل اور سرکاری ذرائع تلاش کریں — ایک آسان جگہ پر۔"
              : "Find documents, steps and official sources in one simple place."}
          </p>

          <div className="search">

            <span>
              🔎
            </span>

            <input
              value={query}
              onChange={(e) =>
                setQuery(e.target.value)
              }
              placeholder={
                urdu
                  ? "مثلاً شناختی کارڈ، پاسپورٹ، ڈومیسائل..."
                  : "Search CNIC, passport, domicile..."
              }
            />

            <button>
              {urdu
                ? "تلاش"
                : "Search"}
            </button>

          </div>

          <div className="trust">
            ✓ Official sources preferred
            &nbsp; • &nbsp;
            ✓ English + Urdu
            &nbsp; • &nbsp;
            ✓ Mobile friendly
          </div>

        </div>

      </section>

      {/* =====================================================
          SERVICES
      ===================================================== */}

      <section className="content">

        <div className="sectionHead">

          <div>

            <span className="eyebrow">
              {urdu
                ? "مقبول سروسز"
                : "POPULAR SERVICES"}
            </span>

            <h2>
              {urdu
                ? "آپ کس کام میں مدد چاہتے ہیں؟"
                : "What do you need help with?"}
            </h2>

          </div>

          <span className="count">
            {visibleServices.length}{" "}
            {urdu
              ? "سروسز"
              : "services"}
          </span>

        </div>

        <div className="grid">

          {visibleServices.map(
            (service) => (

              <button
                className="card"
                key={service.en}
                onClick={() =>
                  selectService(service)
                }
              >

                <div className="icon">
                  {service.icon}
                </div>

                <div className="cardText">

                  <h3>
                    {urdu
                      ? service.ur
                      : service.en}
                  </h3>

                  <p>
                    {urdu
                      ? service.textUr
                      : service.textEn}
                  </p>

                </div>

                <span className="arrow">
                  →
                </span>

              </button>

            )
          )}

        </div>

        {/* =====================================================
            ASK CITIZEN HELPER
        ===================================================== */}

        <section
          className="ask"
          id="ask"
        >

          <div className="askIcon">
            🤖
          </div>

          <div className="askContent">

            <span className="eyebrow">
              CITIZEN HELPER AI
            </span>

            <h2>
              {urdu
                ? "اپنا سوال عام زبان میں پوچھیں"
                : "Ask Citizen Helper"}
            </h2>

            <p>
              {urdu
                ? "اپنا سوال لکھیں اور Citizen Helper AI سے آسان رہنمائی حاصل کریں۔"
                : "Ask your question in simple language and get clear guidance from Citizen Helper AI."}
            </p>

            {/* =================================================
                SELECTED SERVICE INDICATOR
            ================================================= */}

            <div className="selectedService">
              <span>
                {selectedService.icon}
              </span>

              <strong>
                {urdu
                  ? selectedService.ur
                  : selectedService.en}
              </strong>
            </div>

            {/* =================================================
                QUESTION BOX
            ================================================= */}

            <div className="questionBox">

              <textarea
                value={question}
                onChange={(e) => {
                  setQuestion(
                    e.target.value
                  );

                  setAsked(false);
                  setSource(null);
                }}
                placeholder={
                  urdu
                    ? "مثلاً پاسپورٹ بنوانے کے لیے کون سے کاغذات چاہئیں؟"
                    : "Example: What documents are required for a passport?"
                }
                rows={4}
                disabled={loading}
              />

              <button
                className="askButton"
                onClick={askQuestion}
                disabled={
                  loading ||
                  !question.trim()
                }
              >

                {loading
                  ? urdu
                    ? "جواب تیار ہو رہا ہے..."
                    : "Getting answer..."
                  : urdu
                    ? "سوال پوچھیں"
                    : "Ask Question"}

                {!loading &&
                  " →"}

              </button>

            </div>

            {/* =================================================
                LOADING
            ================================================= */}

            {loading && (

              <div className="loadingBox">

                <div className="loadingIcon">
                  🤖
                </div>

                <div>

                  <strong>
                    {urdu
                      ? "Citizen Helper جواب تیار کر رہا ہے"
                      : "Citizen Helper is preparing your answer"}
                  </strong>

                  <div className="loadingDots">

                    <span></span>
                    <span></span>
                    <span></span>

                  </div>

                </div>

              </div>

            )}

            {/* =================================================
                SERVICE-SPECIFIC EXAMPLES
            ================================================= */}

            <div className="examples">

              <span>
                {urdu
                  ? "مثالی سوالات:"
                  : "Try an example:"}
              </span>

              <div className="exampleList">

                {getServiceExamples(
                  selectedService
                ).map(
                  (item) => (

                    <button
                      key={item.en}
                      onClick={() =>
                        chooseExample(
                          urdu
                            ? item.ur
                            : item.en
                        )
                      }
                      disabled={loading}
                    >
                      {urdu
                        ? item.ur
                        : item.en}
                    </button>

                  )
                )}

              </div>

            </div>

            {/* =================================================
                AI ANSWER
            ================================================= */}

            {asked && (

              <section
                className="answerBox"
                id="answer-result"
              >

                <div className="answerHeader">

                  <div className="answerHeaderLeft">

                    <div className="answerRobot">
                      🤖
                    </div>

                    <div>

                      <strong>
                        Citizen Helper AI
                      </strong>

                      <span>
                        {urdu
                          ? "آپ کے سوال کا جواب"
                          : "Response to your question"}
                      </span>

                    </div>

                  </div>

                  <div className="answerBadge">
                    AI
                  </div>

                </div>

                <div className="questionSummary">

                  <span>
                    {urdu
                      ? "آپ کا سوال"
                      : "Your question"}
                  </span>

                  <p>
                    {question}
                  </p>

                </div>

                <div className="answerContent">
                  {renderMarkdown(answer)}
                </div>

                {/* =================================================
                    OFFICIAL SOURCE
                ================================================= */}

                {source?.url ? (

                  <div className="officialSourceBox">

                    <div className="officialSourceIcon">
                      🔗
                    </div>

                    <div className="officialSourceContent">

                      <strong>
                        {urdu
                          ? "سرکاری ذریعہ"
                          : "Official Source"}
                      </strong>

                      {source.department && (
                        <span>
                          {source.department}
                        </span>
                      )}

                      {source.title && (
                        <span>
                          {source.title}
                        </span>
                      )}

                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {urdu
                          ? "🔗 سرکاری ویب سائٹ کھولیں"
                          : "🔗 Open Official Government Source"}
                      </a>

                      {source.lastVerified && (
                        <small>
                          {urdu
                            ? `آخری تصدیق: ${source.lastVerified}`
                            : `Last verified: ${source.lastVerified}`}
                        </small>
                      )}

                    </div>

                  </div>

                ) : (

                  <div className="officialSourceBox">

                    <div className="officialSourceIcon">
                      🔎
                    </div>

                    <div className="officialSourceContent">

                      <strong>
                        {urdu
                          ? "سرکاری ذریعہ"
                          : "Official Source"}
                      </strong>

                      <span>
                        {urdu
                          ? "اس سوال کے لیے الگ سرکاری ذریعہ دستیاب نہیں ہے۔"
                          : "A verified official source was not returned for this question."}
                      </span>

                    </div>

                  </div>

                )}

                {/* =================================================
                    VERIFICATION NOTICE
                ================================================= */}

                <div className="verificationBox">

                  <div className="verificationIcon">
                    ⚠️
                  </div>

                  <div>

                    <strong>
                      {urdu
                        ? "اہم: معلومات کی تصدیق کریں"
                        : "Important: Verify before acting"}
                    </strong>

                    <p>
                      {urdu
                        ? "سرکاری فیس، دستاویزات، اوقات اور طریقہ کار میں تبدیلی ہو سکتی ہے۔ اہم کام کرنے سے پہلے متعلقہ سرکاری ادارے کے تازہ ترین ذرائع سے تصدیق کریں۔"
                        : "Government fees, documents, timings and procedures may change. Before taking important action, verify the latest information from the relevant official government source."}
                    </p>

                  </div>

                </div>

                <div className="answerFooter">

                  <span>
                    🇵🇰{" "}
                    {urdu
                      ? "پاکستان سٹیزن ہیلپر"
                      : "Pakistan Citizen Helper"}
                  </span>

                  <span>
                    {urdu
                      ? "سرکاری معلومات کو ترجیح دی جاتی ہے"
                      : "Official sources are preferred"}
                  </span>

                </div>

              </section>

            )}

          </div>

        </section>

        {/* =====================================================
            NOTICE
        ===================================================== */}

        <section className="notice">

          <div>
            ⚠️
          </div>

          <div>

            <strong>
              {urdu
                ? "اہم نوٹ"
                : "Important note"}
            </strong>

            <p>
              {urdu
                ? "یہ ایپ سرکاری ادارہ نہیں ہے۔ ہمیشہ تازہ معلومات کے لیے متعلقہ سرکاری ذریعہ چیک کریں۔"
                : "This app is not a government department. Always check the relevant official source for current information."}
            </p>

          </div>

        </section>

      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer>

        <strong>
          Pakistan Citizen Helper 🇵🇰
        </strong>

        <span>
          Understand → Prepare → Check the official source
        </span>

        <small>
          V1 • Bilingual public-service information assistant
        </small>

      </footer>

    </main>
  );
}
