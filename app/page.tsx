"use client";

import { useState } from "react";

const services = [
  {
    icon: "🪪",
    en: "CNIC / NADRA",
    ur: "شناختی کارڈ / نادرا",
    text: "Documents, renewal and general guidance",
  },
  {
    icon: "🛂",
    en: "Passport",
    ur: "پاسپورٹ",
    text: "Application and renewal guidance",
  },
  {
    icon: "🚗",
    en: "Driving Licence",
    ur: "ڈرائیونگ لائسنس",
    text: "General licence information",
  },
  {
    icon: "🏠",
    en: "Domicile",
    ur: "ڈومیسائل",
    text: "Requirements and application guidance",
  },
  {
    icon: "🎓",
    en: "Scholarships",
    ur: "اسکالرشپس",
    text: "Find eligibility and official information",
  },
  {
    icon: "🔎",
    en: "Search Services",
    ur: "سروس تلاش کریں",
    text: "Ask about another public service",
  },
];

export default function Home() {
  const [urdu, setUrdu] = useState(false);
  const [query, setQuery] = useState("");

  const visibleServices = services.filter((service) =>
    `${service.en} ${service.ur} ${service.text}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

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

          {/* SEARCH */}
          <div className="search">
            <span>🔎</span>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                urdu
                  ? "مثلاً شناختی کارڈ، پاسپورٹ، ڈومیسائل..."
                  : "Ask about CNIC, passport, domicile..."
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
            {visibleServices.length} services
          </span>
        </div>

        <div className="grid">

          {visibleServices.map((service) => (
            <button
              className="card"
              key={service.en}
              onClick={() => setQuery(service.en)}
            >

              <div className="icon">
                {service.icon}
              </div>

              <div className="cardText">

                <h3>
                  {urdu ? service.ur : service.en}
                </h3>

                <p>
                  {service.text}
                </p>

              </div>

              <span className="arrow">
                →
              </span>

            </button>
          ))}

        </div>

        {/* AI SECTION */}
        <section className="ask">

          <div className="askIcon">
            🤖
          </div>

          <div>

            <span className="eyebrow">
              CITIZEN HELPER AI
            </span>

            <h2>
              {urdu
                ? "اپنا سوال عام زبان میں پوچھیں"
                : "Ask your question in your own words"}
            </h2>

            <p>
              {urdu
                ? "اگلے مرحلے میں AI آپ کو متعلقہ معلومات اور سرکاری ذریعہ دکھائے گا۔"
                : "In the next phase, AI will guide you using approved service information and official sources."}
            </p>

          </div>

          <button
            onClick={() =>
              alert(
                "AI Assistant will be enabled in the next version."
              )
            }
          >
            {urdu ? "جلد آرہا ہے" : "Coming next"} ✨
          </button>

        </section>

        {/* WARNING */}
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
