"use client";

import { useEffect, useState } from "react";

type ExampleQuestion = {
  en: string;
  ur: string;
};

const services = [
  {
    icon: "🪪",
    en: "CNIC / NADRA",
    ur: "شناختی کارڈ / نادرا",
    textEn: "Identity cards, renewal and NADRA services",
    textUr: "شناختی کارڈ، تجدید اور نادرا کی خدمات",
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
    textEn: "Passport application, renewal and requirements",
    textUr: "پاسپورٹ کی درخواست، تجدید اور ضروریات",
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
    textEn: "Licence application, renewal and guidance",
    textUr: "لائسنس کی درخواست، تجدید اور رہنمائی",
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
        ur: "میں اپنا ڈرائیونگ لائسنس کیسے تجدید کروا سکتا ہوں؟",
      },
    ],
  },
  {
    icon: "📜",
    en: "Domicile",
    ur: "ڈومیسائل",
    textEn: "Domicile certificate application and requirements",
    textUr: "ڈومیسائل سرٹیفکیٹ کی درخواست اور ضروریات",
    questionEn: "How can I apply for a domicile certificate?",
    questionUr: "میں ڈومیسائل سرٹیفکیٹ کے لیے کیسے درخواست دے سکتا ہوں؟",
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
    icon: "🎓",
    en: "Scholarships",
    ur: "اسکالرشپس",
    textEn: "Scholarships, eligibility and applications",
    textUr: "اسکالرشپس، اہلیت اور درخواستیں",
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
    icon: "🏛️",
    en: "Other Services",
    ur: "دیگر سرکاری خدمات",
    textEn: "Find guidance for other government services",
    textUr: "دیگر سرکاری خدمات کے بارے میں رہنمائی",
    questionEn: "How can I find information about a government service?",
    questionUr:
      "میں کسی سرکاری سروس کے بارے میں معلومات کیسے حاصل کر سکتا ہوں؟",
    examples: [
      {
        en: "How can I find information about a government service?",
        ur: "میں کسی سرکاری سروس کے بارے میں معلومات کیسے حاصل کر سکتا ہوں؟",
      },
      {
        en: "Where can I find official government information?",
        ur: "مجھے سرکاری معلومات کہاں سے مل سکتی ہیں؟",
      },
      {
        en: "What documents may be required for a government service?",
        ur: "کسی سرکاری سروس کے لیے کون سے کاغذات درکار ہو سکتے ہیں؟",
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

  const [query, setQuery] = useState("");

  const [question, setQuestion] = useState<string>(
    services[0].questionEn
  );

  const [answer, setAnswer] = useState("");

  const [source, setSource] = useState<SourceInfo | null>(null);

  const [loading, setLoading] = useState(false);

  const [asked, setAsked] = useState(false);

  function selectService(service: Service) {
    setSelectedService(service);
    setQuery("");

    setQuestion(
      urdu ? service.questionUr : service.questionEn
    );

    setAsked(false);
    setAnswer("");
    setSource(null);

    setTimeout(() => {
      document.getElementById("ask")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function toggleLanguage() {
    const newUrdu = !urdu;

    setUrdu(newUrdu);

    setQuestion(
      newUrdu
        ? selectedService.questionUr
        : selectedService.questionEn
    );
  }

  function chooseExample(value: string) {
    setQuestion(value);
    setAsked(false);
    setAnswer("");
    setSource(null);

    setTimeout(() => {
      document.getElementById("ask")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  }

  async function askQuestion() {
    if (!question.trim() || loading) {
      return;
    }

    setLoading(true);
    setAsked(true);
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
    } catch (error) {
      console.error(error);

      setAnswer(
        urdu
          ? "معذرت، اس وقت جواب حاصل نہیں کیا جا سکا۔ براہ کرم کچھ دیر بعد دوبارہ کوشش کریں۔"
          : "Sorry, we could not get an answer at this time. Please try again."
      );

      setSource(null);
    } finally {
      setLoading(false);
    }
  }

  const visibleServices = services.filter((service) => {
    const searchableText =
      `${service.en} ${service.ur} ${service.textEn} ${service.textUr}`.toLowerCase();

    return searchableText.includes(query.toLowerCase());
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Enter" &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        askQuestion();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  const examples = selectedService.examples;

  return (
    <main
      dir={urdu ? "rtl" : "ltr"}
      className="min-h-screen bg-[#f7f9fc] text-slate-800"
    >
      {/* =====================================================
          TOP NAVIGATION
      ====================================================== */}

      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-green-700 text-2xl shadow-lg shadow-emerald-600/20">
              🇵🇰
            </div>

            <div className={urdu ? "text-right" : "text-left"}>
              <div className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                Pakistan Citizen Helper
              </div>
              <div className="text-[11px] font-medium text-slate-500 sm:text-xs">
                {urdu
                  ? "سرکاری خدمات کی آسان رہنمائی"
                  : "Simple government service guidance"}
              </div>
            </div>
          </button>

          <button
            onClick={toggleLanguage}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            {urdu ? "English" : "اردو"}
          </button>
        </div>
      </header>

      {/* =====================================================
          HERO
      ====================================================== */}

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-green-700 to-blue-800" />

        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-cyan-300/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.35fr_.65fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                {urdu
                  ? "پاکستانی شہریوں کے لیے آسان رہنمائی"
                  : "Built for citizens of Pakistan"}
              </div>

              <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
                {urdu
                  ? "سرکاری خدمات کی معلومات، آسان اور واضح انداز میں"
                  : "Government services, explained simply."}
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-7 text-emerald-50 sm:text-lg">
                {urdu
                  ? "نادرا، پاسپورٹ، ڈومیسائل، ڈرائیونگ لائسنس، اسکالرشپس اور دیگر سرکاری خدمات کے بارے میں آسان رہنمائی حاصل کریں۔"
                  : "Find simple guidance about CNIC, passports, domicile, driving licences, scholarships and other government services."}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-lg">✓</div>
                  <div className="mt-1 text-xs font-semibold text-white">
                    {urdu ? "آسان معلومات" : "Simple guidance"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-lg">🌐</div>
                  <div className="mt-1 text-xs font-semibold text-white">
                    {urdu ? "اردو + English" : "English + اردو"}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-lg">🔎</div>
                  <div className="mt-1 text-xs font-semibold text-white">
                    {urdu ? "ذرائع کے ساتھ" : "Source-focused"}
                  </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex lg:justify-end">
              <div className="relative w-full max-w-sm">
                <div className="rounded-[2rem] border border-white/20 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
                  <div className="rounded-3xl bg-white p-6 shadow-xl">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                          Citizen Helper
                        </div>
                        <div className="mt-1 text-xl font-black text-slate-900">
                          {urdu ? "آپ کیا جاننا چاہتے ہیں؟" : "What do you need?"}
                        </div>
                      </div>

                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
                        💬
                      </div>
                    </div>

                    <div className="space-y-3">
                      {[
                        ["🪪", urdu ? "شناختی کارڈ" : "CNIC"],
                        ["🛂", urdu ? "پاسپورٹ" : "Passport"],
                        ["🚗", urdu ? "ڈرائیونگ لائسنس" : "Driving Licence"],
                      ].map(([icon, label]) => (
                        <div
                          key={label}
                          className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"
                        >
                          <span className="text-xl">{icon}</span>
                          <span className="text-sm font-bold text-slate-700">
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-blue-600 p-4 text-center text-sm font-bold text-white">
                      {urdu
                        ? "اپنا سوال پوچھیں"
                        : "Ask your question"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* SECTION HEADING */}

        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
              {urdu ? "خدمات" : "Services"}
            </div>

            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              {urdu
                ? "آپ کو کس سروس کی معلومات چاہیے؟"
                : "What service do you need?"}
            </h2>
          </div>

          <div className="text-sm text-slate-500">
            {urdu
              ? "سروس منتخب کریں اور سوال پوچھیں"
              : "Choose a service and ask your question"}
          </div>
        </div>

        {/* SERVICE SEARCH */}

        <div className="mb-7">
          <div className="relative">
            <span
              className={`absolute top-1/2 -translate-y-1/2 text-xl ${
                urdu ? "right-4" : "left-4"
              }`}
            >
              🔎
            </span>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                urdu
                  ? "سروس تلاش کریں..."
                  : "Search government services..."
              }
              className={`w-full rounded-2xl border border-slate-200 bg-white py-4 text-sm font-medium shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 ${
                urdu ? "pr-12 pl-4" : "pl-12 pr-4"
              }`}
            />
          </div>
        </div>

        {/* SERVICE CARDS */}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleServices.map((service) => {
            const active =
              selectedService.en === service.en;

            return (
              <button
                key={service.en}
                onClick={() => selectService(service)}
                className={`group relative overflow-hidden rounded-3xl border p-5 text-left transition duration-200 ${
                  active
                    ? "border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-600/10"
                    : "border-slate-200 bg-white shadow-sm hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg"
                }`}
              >
                {active && (
                  <div className="absolute right-4 top-4 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                    {urdu ? "منتخب" : "Selected"}
                  </div>
                )}

                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl transition ${
                    active
                      ? "bg-emerald-600 shadow-lg shadow-emerald-600/20"
                      : "bg-slate-100 group-hover:bg-emerald-50"
                  }`}
                >
                  {service.icon}
                </div>

                <h3 className="mt-5 text-lg font-black text-slate-900">
                  {urdu ? service.ur : service.en}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {urdu
                    ? service.textUr
                    : service.textEn}
                </p>

                <div className="mt-5 flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <span>
                    {urdu ? "سوال پوچھیں" : "Ask about this"}
                  </span>
                  <span>{urdu ? "←" : "→"}</span>
                </div>
              </button>
            );
          })}
        </div>

        {visibleServices.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="text-4xl">🔎</div>

            <h3 className="mt-4 font-black text-slate-900">
              {urdu
                ? "کوئی سروس نہیں ملی"
                : "No service found"}
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              {urdu
                ? "براہ کرم مختلف الفاظ سے دوبارہ تلاش کریں۔"
                : "Try searching with different words."}
            </p>
          </div>
        )}

        {/* =====================================================
            ASK AREA
        ====================================================== */}

        <section
          id="ask"
          className="mt-12 scroll-mt-24"
        >
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
            {/* ASK HEADER */}

            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-900 px-5 py-7 text-white sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-3xl backdrop-blur">
                  {selectedService.icon}
                </div>

                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                    {urdu ? "منتخب سروس" : "Selected service"}
                  </div>

                  <h2 className="mt-1 text-2xl font-black">
                    {urdu
                      ? selectedService.ur
                      : selectedService.en}
                  </h2>

                  <p className="mt-2 text-sm text-slate-300">
                    {urdu
                      ? "اپنا سوال لکھیں۔ ہم آسان انداز میں رہنمائی فراہم کریں گے۔"
                      : "Ask your question and get simple, source-focused guidance."}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-8">
              {/* QUESTION BOX */}

              <label className="mb-3 block text-sm font-black text-slate-800">
                {urdu ? "آپ کا سوال" : "Your question"}
              </label>

              <textarea
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  setAsked(false);
                }}
                rows={5}
                dir={urdu ? "rtl" : "ltr"}
                placeholder={
                  urdu
                    ? "اپنا سوال یہاں لکھیں..."
                    : "Type your question here..."
                }
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-400">
                  {urdu
                    ? "Enter کے ساتھ Ctrl دبائیں یا بٹن استعمال کریں۔"
                    : "Press Ctrl + Enter or use the button."}
                </div>

                <button
                  onClick={askQuestion}
                  disabled={loading || !question.trim()}
                  className="rounded-2xl bg-gradient-to-r from-emerald-600 to-green-700 px-7 py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading
                    ? urdu
                      ? "جواب تلاش کیا جا رہا ہے..."
                      : "Finding answer..."
                    : urdu
                    ? "جواب حاصل کریں"
                    : "Get Answer"}
                </button>
              </div>

              {/* =================================================
                  EXAMPLES
              ================================================== */}

              <div className="mt-8 border-t border-slate-100 pt-7">
                <div className="mb-4">
                  <div className="text-sm font-black text-slate-800">
                    {urdu
                      ? "عام سوالات"
                      : "Popular questions"}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {urdu
                      ? "فوری طور پر سوال منتخب کریں"
                      : "Tap a question to use it instantly"}
                  </div>
                </div>

                <div className="grid gap-3">
                  {examples.map((example) => {
                    const text = urdu
                      ? example.ur
                      : example.en;

                    return (
                      <button
                        key={example.en}
                        onClick={() => chooseExample(text)}
                        className={`group rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 ${
                          urdu ? "text-right" : "text-left"
                        }`}
                      >
                        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs shadow-sm group-hover:bg-emerald-100">
                          ?
                        </span>

                        {text}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* =================================================
                  ANSWER
              ================================================== */}

              {asked && (
                <div className="mt-8 border-t border-slate-100 pt-8">
                  {loading ? (
                    <div className="rounded-3xl bg-slate-50 p-7">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                        </div>

                        <div>
                          <div className="font-black text-slate-900">
                            {urdu
                              ? "معلومات تلاش کی جا رہی ہیں"
                              : "Finding information"}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            {urdu
                              ? "براہ کرم چند لمحے انتظار کریں..."
                              : "Please wait a moment..."}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-emerald-50/40">
                      <div className="border-b border-emerald-100 bg-white/70 px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-lg text-white">
                            ✓
                          </div>

                          <div>
                            <div className="font-black text-slate-900">
                              {urdu
                                ? "رہنمائی"
                                : "Guidance"}
                            </div>

                            <div className="text-xs text-emerald-700">
                              {urdu
                                ? "دستیاب معلومات کی بنیاد پر"
                                : "Based on available information"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        className={`p-5 text-sm leading-8 text-slate-700 sm:p-7 ${
                          urdu ? "text-right" : "text-left"
                        }`}
                      >
                        {answer}
                      </div>

                      {source?.url && (
                        <div className="border-t border-emerald-100 bg-white/70 p-5">
                          <div className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">
                            {urdu
                              ? "سرکاری ذریعہ"
                              : "Official source"}
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="font-bold text-slate-900">
                              {source.department ||
                                "Official Government Source"}
                            </div>

                            {source.title && (
                              <div className="mt-1 text-xs text-slate-500">
                                {source.title}
                              </div>
                            )}

                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                            >
                              {urdu
                                ? "سرکاری ویب سائٹ کھولیں"
                                : "Open official source"}
                              <span>↗</span>
                            </a>

                            {source.lastVerified && (
                              <div className="mt-3 text-[11px] text-slate-400">
                                {urdu
                                  ? `آخری تصدیق: ${source.lastVerified}`
                                  : `Last verified: ${source.lastVerified}`}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* =====================================================
            TRUST / DISCLAIMER
        ====================================================== */}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-2xl">🔎</div>

            <h3 className="mt-4 font-black text-slate-900">
              {urdu
                ? "سرکاری ذرائع پر توجہ"
                : "Official-source focused"}
            </h3>

            <p className="mt-2 text-xs leading-6 text-slate-500">
              {urdu
                ? "ہم کوشش کرتے ہیں کہ شہریوں کو مستند سرکاری معلومات تک رہنمائی دی جائے۔"
                : "The service is designed to guide citizens toward authoritative government information."}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-2xl">🌐</div>

            <h3 className="mt-4 font-black text-slate-900">
              {urdu
                ? "اردو اور English"
                : "English + Urdu"}
            </h3>

            <p className="mt-2 text-xs leading-6 text-slate-500">
              {urdu
                ? "معلومات کو اپنی پسندیدہ زبان میں سمجھنے کی سہولت۔"
                : "Get guidance in the language that is easier for you to understand."}
            </p>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <div className="text-2xl">⚠️</div>

            <h3 className="mt-4 font-black text-slate-900">
              {urdu
                ? "اہم نوٹ"
                : "Important note"}
            </h3>

            <p className="mt-2 text-xs leading-6 text-slate-600">
              {urdu
                ? "فیس، قواعد اور طریقہ کار تبدیل ہو سکتے ہیں۔ درخواست دینے سے پہلے متعلقہ سرکاری ادارے کی تازہ معلومات ضرور دیکھیں۔"
                : "Fees, rules and procedures may change. Always check the relevant government department before applying."}
            </p>
          </div>
        </section>
      </div>

      {/* =====================================================
          FOOTER
      ====================================================== */}

      <footer className="mt-12 border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-xl">
                  🇵🇰
                </div>

                <div>
                  <div className="font-black">
                    Pakistan Citizen Helper
                  </div>

                  <div className="text-xs text-slate-400">
                    {urdu
                      ? "شہریوں کے لیے آسان رہنمائی"
                      : "Simple guidance for citizens"}
                  </div>
                </div>
              </div>

              <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">
                {urdu
                  ? "پاکستانی شہریوں کو سرکاری خدمات کے بارے میں معلومات سمجھنے اور متعلقہ سرکاری ذرائع تک پہنچنے میں مدد دینے کے لیے تیار کیا گیا ہے۔"
                  : "Designed to help Pakistani citizens understand government services and find relevant official information more easily."}
              </p>
            </div>

            <div className="md:text-right">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                {urdu ? "ترقی" : "Developed by"}
              </div>

              <div className="mt-2 text-lg font-black">
                Raees Khan
              </div>

              <div className="mt-1 text-xs text-slate-500">
                Assistant Director, NADRA
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-5 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} Pakistan Citizen Helper
          </div>
        </div>
      </footer>
    </main>
  );
}
