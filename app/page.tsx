"use client";

import { useState } from "react";

const services = [
  {
    icon: "🪪",
    en: "CNIC / NADRA",
    ur: "شناختی کارڈ / نادرا",
    textEn: "Documents, renewal and general guidance",
    textUr: "دستاویزات، تجدید اور عمومی رہنمائی",
  },
  {
    icon: "🛂",
    en: "Passport",
    ur: "پاسپورٹ",
    textEn: "Application and renewal guidance",
    textUr: "درخواست اور تجدید کی رہنمائی",
  },
  {
    icon: "🚗",
    en: "Driving Licence",
    ur: "ڈرائیونگ لائسنس",
    textEn: "General licence information",
    textUr: "لائسنس سے متعلق عمومی معلومات",
  },
  {
    icon: "🏠",
    en: "Domicile",
    ur: "ڈومیسائل",
    textEn: "Requirements and application guidance",
    textUr: "ضروریات اور درخواست کی رہنمائی",
  },
  {
    icon: "🎓",
    en: "Scholarships",
    ur: "اسکالرشپس",
    textEn: "Find eligibility and official information",
    textUr: "اہلیت اور سرکاری معلومات تلاش کریں",
  },
  {
    icon: "🔎",
    en: "Other Services",
    ur: "دیگر سروسز",
    textEn: "Ask about another public service",
    textUr: "کسی دوسری سرکاری سروس کے بارے میں پوچھیں",
  },
];

const examples = [
  {
    en: "What documents are required for a passport?",
    ur: "پاسپورٹ کے لیے کون سے کاغذات ضروری ہیں؟",
  },
  {
    en: "How can I renew my CNIC?",
    ur: "میں اپنا شناختی کارڈ کیسے تجدید کروا سکتا ہوں؟",
  },
  {
    en: "How can I apply for a domicile?",
    ur: "میں ڈومیسائل کے لیے کیسے درخواست دے سکتا ہوں؟",
  },
];

export default function Home() {
  const [urdu, setUrdu] = useState(false);
  const [query, setQuery] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asked, setAsked] = useState(false);
  const [loading, setLoading] = useState(false);

  const visibleServices = services.filter((service) =>
    `${service.en} ${service.ur} ${service.textEn} ${service.textUr}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  async function askQuestion() {
    if (!question.trim() || loading) return;

    setLoading(true);
    setAsked(false);
    setAnswer("");

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to get an AI response."
        );
      }

      setAnswer(data.answer || "No answer was returned.");
      setAsked(true);
    } catch (error) {
      console.error(error);

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

  function chooseExample(text: string) {
    setQuestion(text);
    setAsked(false);
    setAnswer("");
  }

  return (
    <main>
      {/* NAVIGATION */}
      <nav className="nav">
        <div className="brand">
          <div className="flag">🇵🇰</div>

          <div>
            <strong>Pakistan Citizen Helper</strong>
            <span>پاکستان سٹیزن ہیلپر</span>
          </div>
        </div>

        <button
          className="language"
          onClick={() => setUrdu(!urdu)}
        >
          {urdu ? "English" : "اردو"}
        </button>
      </nav>

      {/* HERO */}
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

          {/* SERVICE SEARCH */}
          <div className="search">
            <span>🔎</span>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                urdu
                  ? "مثلاً شناختی کارڈ، پاسپورٹ، ڈومیسائل..."
                  : "Search CNIC, passport, domicile..."
              }
            />

            <button>
              {urdu ? "تلاش" : "Search"}
            </button>
          </div>

          <div className="trust">
            ✓ Official sources preferred &nbsp; • &nbsp;
            ✓ English + Urdu &nbsp; • &nbsp;
            ✓ Mobile friendly
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="content">
        <div className="sectionHead">
          <div>
            <span className="eyebrow">
              {urdu ? "مقبول سروسز" : "POPULAR SERVICES"}
            </span>

            <h2>
              {urdu
                ? "آپ کس کام میں مدد چاہتے ہیں؟"
                : "What do you need help with?"}
            </h2>
          </div>

          <span className="count">
            {visibleServices.length}{" "}
            {urdu ? "سروسز" : "services"}
          </span>
        </div>

        <div className="grid">
          {visibleServices.map((service) => (
            <button
              className="card"
              key={service.en}
              onClick={() => {
                setQuery(service.en);

                setQuestion(
                  urdu
                    ? `${service.ur} کے بارے میں معلومات چاہیے۔`
                    : `I need information about ${service.en}.`
                );

                document
                  .getElementById("ask")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <div className="icon">{service.icon}</div>

              <div className="cardText">
                <h3>{urdu ? service.ur : service.en}</h3>

                <p>
                  {urdu
                    ? service.textUr
                    : service.textEn}
                </p>
              </div>

              <span className="arrow">→</span>
            </button>
          ))}
        </div>

        {/* ASK CITIZEN HELPER */}
        <section className="ask" id="ask">
          <div className="askIcon">🤖</div>

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
                ? "اپنا سوال لکھیں اور Citizen Helper AI سے رہنمائی حاصل کریں۔"
                : "Ask your question in simple language and get guidance from Citizen Helper AI."}
            </p>

            {/* QUESTION BOX */}
            <div className="questionBox">
              <textarea
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  setAsked(false);
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
                disabled={loading || !question.trim()}
              >
                {loading
                  ? urdu
                    ? "جواب تیار ہو رہا ہے..."
                    : "Getting answer..."
                  : urdu
                    ? "سوال پوچھیں"
                    : "Ask Question"}{" "}
                {!loading && "→"}
              </button>
            </div>

            {/* EXAMPLES */}
            <div className="examples">
              <span>
                {urdu
                  ? "مثالی سوالات:"
                  : "Try an example:"}
              </span>

              <div className="exampleList">
                {examples.map((item) => (
                  <button
                    key={item.en}
                    onClick={() =>
                      chooseExample(
                        urdu ? item.ur : item.en
                      )
                    }
                    disabled={loading}
                  >
                    {urdu ? item.ur : item.en}
                  </button>
                ))}
              </div>
            </div>

            {/* AI ANSWER */}
            {asked && (
              <div className="answerBox">
                <div className="answerTitle">
                  🤖 Citizen Helper AI
                </div>

                <p className="aiAnswer">
                  {answer}
                </p>

                <small>
                  ⚠️{" "}
                  {urdu
                    ? "اہم معلومات کے لیے متعلقہ سرکاری ذریعہ ضرور چیک کریں۔"
                    : "For important matters, always verify information with the relevant official government source."}
                </small>
              </div>
            )}
          </div>
        </section>

        {/* NOTICE */}
        <section className="notice">
          <div>⚠️</div>

          <div>
            <strong>
              {urdu ? "اہم نوٹ" : "Important note"}
            </strong>

            <p>
              {urdu
                ? "یہ ایپ سرکاری ادارہ نہیں ہے۔ ہمیشہ تازہ معلومات کے لیے متعلقہ سرکاری ذریعہ چیک کریں۔"
                : "This app is not a government department. Always check the relevant official source for current information."}
            </p>
          </div>
        </section>
      </section>

      {/* FOOTER */}
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
