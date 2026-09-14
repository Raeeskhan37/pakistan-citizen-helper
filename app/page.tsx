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
    textEn: "Licence application, renewal and requirements",
    textUr: "لائسنس کے حصول، تجدید اور ضروریات",
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
    icon: "🏠",
    en: "Domicile",
    ur: "ڈومیسائل",
    textEn: "Application and document guidance",
    textUr: "درخواست اور دستاویزات کی رہنمائی",
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
        en: "How long does it take to get a domicile?",
        ur: "ڈومیسائل بننے میں کتنا وقت لگتا ہے؟",
      },
    ],
  },
  {
    icon: "🎓",
    en: "Scholarships",
    ur: "اسکالرشپس",
    textEn: "Scholarship eligibility and application guidance",
    textUr: "اسکالرشپ کی اہلیت اور درخواست کی رہنمائی",
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
        en: "What documents are required for a scholarship?",
        ur: "اسکالرشپ کے لیے کون سے کاغذات ضروری ہیں؟",
      },
    ],
  },
  {
    icon: "🏛️",
    en: "Other Services",
    ur: "دیگر سرکاری خدمات",
    textEn: "General information about government services",
    textUr: "دیگر سرکاری خدمات کے بارے میں عمومی معلومات",
    questionEn: "How can I find information about a government service?",
    questionUr: "میں کسی سرکاری سروس کے بارے میں معلومات کیسے حاصل کر سکتا ہوں؟",
    examples: [
      {
        en: "How can I find information about a government service?",
        ur: "میں کسی سرکاری سروس کے بارے میں معلومات کیسے حاصل کر سکتا ہوں؟",
      },
      {
        en: "What documents are usually required for government services?",
        ur: "سرکاری خدمات کے لیے عام طور پر کون سے کاغذات درکار ہوتے ہیں؟",
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

  const [query, setQuery] = useState("");

  const [question, setQuestion] = useState(
    services[0].questionEn
  );

  const [answer, setAnswer] = useState("");

  const [source, setSource] = useState<SourceInfo | null>(null);

  const [loading, setLoading] = useState(false);

  const [asked, setAsked] = useState(false);

  /*
   * ---------------------------------------------------------
   * Select a service
   * ---------------------------------------------------------
   */

  function selectService(service: Service) {
    setSelectedService(service);

    setQuery(service.en);

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

  /*
   * ---------------------------------------------------------
   * Change language
   * ---------------------------------------------------------
   */

  function toggleLanguage() {
    const newUrdu = !urdu;

    setUrdu(newUrdu);

    setQuestion(
      newUrdu
        ? selectedService.questionUr
        : selectedService.questionEn
    );
  }

  /*
   * ---------------------------------------------------------
   * Choose an example question
   * ---------------------------------------------------------
   */

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

  /*
   * ---------------------------------------------------------
   * Ask AI
   * ---------------------------------------------------------
   */

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
          ? "معذرت، اس وقت جواب حاصل نہیں کیا جا سکا۔ براہ کرم دوبارہ کوشش کریں۔"
          : "Sorry, we could not get an answer at this time. Please try again."
      );

      setSource(null);
    } finally {
      setLoading(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * Search services
   * ---------------------------------------------------------
   */

  const visibleServices = services.filter((service) => {
    const searchableText =
      `${service.en} ${service.ur} ${service.textEn} ${service.textUr}`.toLowerCase();

    return searchableText.includes(
      query.toLowerCase()
    );
  });

  /*
   * ---------------------------------------------------------
   * Keyboard shortcut
   * ---------------------------------------------------------
   */

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

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  });

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 text-slate-800"
      dir={urdu ? "rtl" : "ltr"}
    >
      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button
            onClick={() => {
              setQuestion(
                urdu
                  ? services[0].questionUr
                  : services[0].questionEn
              );
              setSelectedService(services[0]);
              setQuery("");
              setAsked(false);
              setAnswer("");
              setSource(null);

              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }}
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-green-600 to-blue-600 text-2xl shadow-md">
              🇵🇰
            </div>

            <div className="text-left">
              <h1 className="text-lg font-extrabold leading-tight text-slate-900 sm:text-xl">
                Pakistan Citizen Helper
              </h1>

              <p className="text-xs text-slate-500">
                {urdu
                  ? "پاکستانی شہریوں کے لیے آسان رہنمائی"
                  : "Simple guidance for Pakistani citizens"}
              </p>
            </div>
          </button>

          <button
            onClick={toggleLanguage}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-slate-50"
          >
            {urdu ? "English" : "اردو"}
          </button>
        </div>
      </header>

      {/* =====================================================
          HERO
      ====================================================== */}

      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-12 text-center sm:px-6 sm:pt-16 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
              🇵🇰{" "}
              {urdu
                ? "سرکاری خدمات کی آسان رہنمائی"
                : "Easy guidance for government services"}
            </div>

            <h2 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              {urdu
                ? "پاکستانی شہریوں کے لیے مدد"
                : "Your Guide to Pakistan's Government Services"}
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              {urdu
                ? "نادرا، پاسپورٹ، ڈرائیونگ لائسنس، ڈومیسائل، اسکالرشپس اور دیگر سرکاری خدمات کے بارے میں آسان معلومات حاصل کریں۔"
                : "Get simple guidance about CNIC, passports, driving licences, domicile, scholarships and other government services."}
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          SERVICES
      ====================================================== */}

      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">
              {urdu
                ? "سرکاری خدمات منتخب کریں"
                : "Choose a Government Service"}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {urdu
                ? "اپنی مطلوبہ سروس منتخب کریں"
                : "Select a service to get started"}
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder={
                urdu
                  ? "سروس تلاش کریں..."
                  : "Search services..."
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleServices.map((service) => {
            const selected =
              selectedService.en === service.en;

            return (
              <button
                key={service.en}
                onClick={() => selectService(service)}
                className={`group rounded-2xl border p-5 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg ${
                  selected
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                    : "border-slate-200 bg-white hover:border-blue-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl group-hover:bg-white">
                    {service.icon}
                  </div>

                  {selected && (
                    <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                      {urdu ? "منتخب" : "Selected"}
                    </span>
                  )}
                </div>

                <h4 className="mt-4 text-lg font-bold text-slate-900">
                  {urdu ? service.ur : service.en}
                </h4>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {urdu
                    ? service.textUr
                    : service.textEn}
                </p>
              </button>
            );
          })}
        </div>

        {visibleServices.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="text-4xl">🔎</div>

            <p className="mt-3 font-semibold text-slate-700">
              {urdu
                ? "کوئی سروس نہیں ملی۔"
                : "No service found."}
            </p>
          </div>
        )}
      </section>

      {/* =====================================================
          ASK SECTION
      ====================================================== */}

      <section
        id="ask"
        className="mx-auto max-w-5xl scroll-mt-24 px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          {/* Selected service heading */}

          <div className="border-b border-slate-200 bg-gradient-to-r from-blue-50 to-green-50 px-5 py-5 sm:px-7">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">
                {selectedService.icon}
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  {urdu
                    ? "منتخب سروس"
                    : "Selected Service"}
                </p>

                <h3 className="text-xl font-extrabold text-slate-900">
                  {urdu
                    ? selectedService.ur
                    : selectedService.en}
                </h3>
              </div>
            </div>
          </div>

          {/* Question */}

          <div className="p-5 sm:p-7">
            <label
              htmlFor="question"
              className="mb-3 block text-sm font-bold text-slate-700"
            >
              {urdu
                ? "اپنا سوال لکھیں"
                : "Ask your question"}
            </label>

            <textarea
              id="question"
              value={question}
              onChange={(event) =>
                setQuestion(event.target.value)
              }
              rows={5}
              dir={urdu ? "rtl" : "ltr"}
              placeholder={
                urdu
                  ? "اپنا سوال یہاں لکھیں..."
                  : "Type your question here..."
              }
              className="w-full resize-none rounded-2xl border border-slate-300 bg-slate-50 p-4 text-base leading-7 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">
                {urdu
                  ? "Ctrl + Enter سے بھی سوال پوچھ سکتے ہیں۔"
                  : "You can also press Ctrl + Enter to ask."}
              </p>

              <button
                onClick={askQuestion}
                disabled={loading || !question.trim()}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-bold text-white shadow-md transition hover:from-blue-700 hover:to-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? urdu
                    ? "جواب تیار ہو رہا ہے..."
                    : "Getting answer..."
                  : urdu
                  ? "جواب حاصل کریں"
                  : "Get Answer"}
              </button>
            </div>

            {/* =================================================
                SERVICE-SPECIFIC EXAMPLES
            ================================================== */}

            <div className="mt-8">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">💡</span>

                <h4 className="font-bold text-slate-800">
                  {urdu
                    ? "مثالی سوالات"
                    : "Example Questions"}
                </h4>
              </div>

              <div className="grid gap-3">
                {selectedService.examples.map(
                  (item: ExampleQuestion) => (
                    <button
                      key={item.en}
                      onClick={() =>
                        chooseExample(
                          urdu ? item.ur : item.en
                        )
                      }
                      disabled={loading}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm leading-6 text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {urdu ? item.ur : item.en}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          ANSWER
      ====================================================== */}

      {asked && (
        <section className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xl">
                  🤖
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-900">
                    {urdu
                      ? "پاکستان سٹیزن ہیلپر کا جواب"
                      : "Pakistan Citizen Helper Answer"}
                  </h3>

                  <p className="text-xs text-slate-500">
                    {urdu
                      ? "دستیاب تصدیق شدہ معلومات کی بنیاد پر"
                      : "Based on available verified information"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-7">
              {loading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />

                    <span className="font-semibold text-slate-600">
                      {urdu
                        ? "معلومات تلاش کی جا رہی ہیں..."
                        : "Searching verified information..."}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="h-4 animate-pulse rounded bg-slate-100" />
                    <div className="h-4 animate-pulse rounded bg-slate-100" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ) : (
                <>
                  <div
                    dir={urdu ? "rtl" : "ltr"}
                    className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700"
                  >
                    {answer}
                  </div>

                  {/* =================================================
                      OFFICIAL SOURCE
                  ================================================== */}

                  {source?.url && (
                    <div className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-5">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">✅</div>

                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-green-900">
                            {urdu
                              ? "سرکاری ذریعہ"
                              : "Official Source"}
                          </h4>

                          {source.department && (
                            <p className="mt-1 text-sm font-semibold text-green-800">
                              {source.department}
                            </p>
                          )}

                          {source.title && (
                            <p className="mt-1 text-sm text-green-700">
                              {source.title}
                            </p>
                          )}

                          {source.lastVerified && (
                            <p className="mt-2 text-xs text-green-700">
                              {urdu
                                ? `آخری تصدیق: ${source.lastVerified}`
                                : `Last verified: ${source.lastVerified}`}
                            </p>
                          )}

                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-800"
                          >
                            {urdu
                              ? "سرکاری ویب سائٹ کھولیں"
                              : "Open Official Website"}
                            <span>↗</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {!source?.url && answer && (
                    <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm leading-6 text-amber-800">
                        {urdu
                          ? "نوٹ: اس جواب کے لیے کوئی مخصوص سرکاری ذریعہ دستیاب نہیں ہے۔ اہم معلومات کے لیے متعلقہ سرکاری ادارے سے تصدیق کریں۔"
                          : "Note: A specific official source was not available for this answer. Please verify important information with the relevant government department."}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          TRUST / DISCLAIMER
      ====================================================== */}

      <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔐</span>

            <div>
              <h4 className="font-bold text-blue-900">
                {urdu
                  ? "اہم معلومات"
                  : "Important Information"}
              </h4>

              <p className="mt-2 text-sm leading-6 text-blue-800">
                {urdu
                  ? "یہ ایپ سرکاری معلومات کو آسان انداز میں سمجھنے میں مدد دیتی ہے۔ فیس، قواعد، دستاویزات یا آخری تاریخ جیسے اہم معاملات میں متعلقہ سرکاری ادارے کی ویب سائٹ سے تصدیق ضرور کریں۔"
                  : "This app helps explain government information in simple language. For important matters such as fees, rules, documents or deadlines, always verify the information with the relevant official government department."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          FOOTER
      ====================================================== */}

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-center sm:flex-row sm:px-6 lg:px-8">
          <div>
            <p className="font-bold text-slate-800">
              Pakistan Citizen Helper 🇵🇰
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {urdu
                ? "آسان، واضح اور ذمہ دارانہ شہری رہنمائی"
                : "Simple, clear and responsible citizen guidance"}
            </p>
          </div>

          <p className="text-xs text-slate-400">
            Developed by Raees Khan
          </p>
        </div>
      </footer>
    </main>
  );
}
