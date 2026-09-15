"use client";

import { useState } from "react";

type Service = {
  id: string;
  name: string;
  icon: string;
  description: string;
  question: string;
};

type Department = {
  id: string;
  name: string;
  urdu: string;
  icon: string;
  description: string;
  services: Service[];
};

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

const departments: Department[] = [
  {
    id: "nadra",
    name: "NADRA Services",
    urdu: "نادرا کی خدمات",
    icon: "🪪",
    description: "Identity documents, family certificates and registration services",
    services: [
      {
        id: "cnic",
        name: "CNIC / Smart CNIC",
        icon: "🪪",
        description: "New, renewal, modification and reprint",
        question: "How can I apply for a new CNIC?",
      },
      {
        id: "cnic-renewal",
        name: "CNIC Renewal",
        icon: "🔄",
        description: "Renew an existing CNIC",
        question: "How can I renew my CNIC?",
      },
      {
        id: "cnic-modification",
        name: "CNIC Modification",
        icon: "✏️",
        description: "Update information on your CNIC",
        question: "How can I modify my CNIC information?",
      },
      {
        id: "cnic-reprint",
        name: "CNIC Reprint / Lost",
        icon: "♻️",
        description: "Replace a lost or damaged CNIC",
        question: "How can I get a reprint of my lost CNIC?",
      },
      {
        id: "crc",
        name: "Child Registration Certificate (CRC / B-Form)",
        icon: "👶",
        description: "Registration document for children",
        question: "How can I apply for a Child Registration Certificate (CRC / B-Form)?",
      },
      {
        id: "juvenile-card",
        name: "Juvenile Card",
        icon: "🧒",
        description: "Identity document for children",
        question: "How can I apply for a Juvenile Card?",
      },
      {
        id: "frc",
        name: "Family Registration Certificate (FRC)",
        icon: "👨‍👩‍👧‍👦",
        description: "Certificate showing family composition",
        question: "How can I obtain a Family Registration Certificate (FRC)?",
      },
      {
        id: "nicop",
        name: "NICOP",
        icon: "🌍",
        description: "Identity card for overseas Pakistanis",
        question: "How can I apply for NICOP?",
      },
      {
        id: "poc",
        name: "POC",
        icon: "🌐",
        description: "Pakistan Origin Card",
        question: "How can I apply for a Pakistan Origin Card (POC)?",
      },
      {
        id: "cancellation",
        name: "Cancellation Certificate",
        icon: "📄",
        description: "Cancellation of registration documents",
        question: "How can I apply for a NADRA Cancellation Certificate?",
      },
      {
        id: "pakid",
        name: "PakID Services",
        icon: "📱",
        description: "NADRA online identity services",
        question: "What services can I use through the NADRA PakID app?",
      },
      {
        id: "nadra-fees",
        name: "NADRA Fees & Processing Time",
        icon: "💰",
        description: "Current fees and processing timelines",
        question: "What are the current NADRA fees and processing times?",
      },
    ],
  },

  {
    id: "union-council",
    name: "Union Council / Local Government",
    urdu: "یونین کونسل / بلدیاتی خدمات",
    icon: "🏛️",
    description: "Civil registration and local government certificates",
    services: [
      {
        id: "birth",
        name: "Birth Certificate",
        icon: "👶",
        description: "Birth registration and certificate",
        question: "How can I obtain a birth certificate?",
      },
      {
        id: "death",
        name: "Death Certificate",
        icon: "📜",
        description: "Death registration and certificate",
        question: "How can I obtain a death certificate?",
      },
      {
        id: "marriage",
        name: "Marriage Certificate",
        icon: "💍",
        description: "Marriage registration and certificate",
        question: "How can I obtain a marriage certificate?",
      },
      {
        id: "divorce",
        name: "Divorce Certificate",
        icon: "📄",
        description: "Divorce registration and certificate",
        question: "How can I obtain a divorce certificate?",
      },
      {
        id: "civil-registration",
        name: "Civil Registration",
        icon: "📝",
        description: "Birth, death and family registration information",
        question: "What civil registration services are provided by the local government?",
      },
    ],
  },

  {
    id: "excise",
    name: "Excise & Taxation",
    urdu: "ایکسائز اینڈ ٹیکسیشن",
    icon: "🚗",
    description: "Vehicle registration, transfer and vehicle taxation",
    services: [
      {
        id: "vehicle-registration",
        name: "Motor Vehicle Registration",
        icon: "🚗",
        description: "Register a new vehicle",
        question: "How can I register a motor vehicle?",
      },
      {
        id: "vehicle-transfer",
        name: "Vehicle Ownership Transfer",
        icon: "🔁",
        description: "Transfer vehicle ownership",
        question: "How can I transfer ownership of a vehicle?",
      },
      {
        id: "token-tax",
        name: "Vehicle Token Tax",
        icon: "💰",
        description: "Vehicle tax and payment information",
        question: "How can I pay vehicle token tax?",
      },
      {
        id: "vehicle-verification",
        name: "Vehicle Verification",
        icon: "🔎",
        description: "Verify vehicle registration information",
        question: "How can I verify a vehicle?",
      },
      {
        id: "vehicle-renewal",
        name: "Vehicle Registration Renewal",
        icon: "🔄",
        description: "Vehicle registration renewal",
        question: "How can I renew my vehicle registration?",
      },
      {
        id: "number-plate",
        name: "Number Plate",
        icon: "🔢",
        description: "Vehicle number plate information",
        question: "How can I obtain or replace a vehicle number plate?",
      },
    ],
  },

  {
    id: "police",
    name: "Police Services",
    urdu: "پولیس کی خدمات",
    icon: "👮",
    description: "Police verification and public facilitation services",
    services: [
      {
        id: "police-clearance",
        name: "Police Clearance Certificate",
        icon: "📜",
        description: "Police clearance for official purposes",
        question: "How can I obtain a Police Clearance Certificate?",
      },
      {
        id: "character-certificate",
        name: "Police Character Certificate",
        icon: "📄",
        description: "Character certificate requirements and process",
        question: "How can I obtain a Police Character Certificate?",
      },
      {
        id: "police-verification",
        name: "Police Verification",
        icon: "🔎",
        description: "Police verification services",
        question: "How can I apply for police verification?",
      },
      {
        id: "tenant-verification",
        name: "Tenant Verification",
        icon: "🏠",
        description: "Tenant registration and verification",
        question: "How can I get tenant verification?",
      },
      {
        id: "employee-verification",
        name: "Employee Verification",
        icon: "👤",
        description: "Employee/background verification",
        question: "How can I apply for employee verification?",
      },
      {
        id: "fir",
        name: "FIR / Police Complaint",
        icon: "🚨",
        description: "Information about police complaints and FIRs",
        question: "How can I register or follow up a police complaint or FIR?",
      },
    ],
  },

  {
    id: "passport",
    name: "Passport & Immigration",
    urdu: "پاسپورٹ اور امیگریشن",
    icon: "🛂",
    description: "Passport and immigration-related information",
    services: [
      {
        id: "passport",
        name: "Passport",
        icon: "🛂",
        description: "New passport and general requirements",
        question: "How can I apply for a passport?",
      },
      {
        id: "passport-renewal",
        name: "Passport Renewal",
        icon: "🔄",
        description: "Renew an existing passport",
        question: "How can I renew my passport?",
      },
      {
        id: "passport-modification",
        name: "Passport Modification",
        icon: "✏️",
        description: "Passport modification information",
        question: "How can I modify my passport information?",
      },
      {
        id: "lost-passport",
        name: "Lost Passport",
        icon: "⚠️",
        description: "Procedure for a lost passport",
        question: "What should I do if my passport is lost?",
      },
      {
        id: "immigration",
        name: "Immigration Information",
        icon: "🌍",
        description: "General immigration information",
        question: "What immigration services and procedures are available?",
      },
    ],
  },

  {
    id: "protector",
    name: "Protector & Overseas Employment",
    urdu: "پروٹیکٹر اور بیرون ملک ملازمت",
    icon: "✈️",
    description: "Overseas employment and Protector of Emigrants",
    services: [
      {
        id: "protector",
        name: "Protector of Emigrants",
        icon: "🛡️",
        description: "Protector registration and requirements",
        question: "How can I obtain Protector of Emigrants registration?",
      },
      {
        id: "overseas-employment",
        name: "Overseas Employment",
        icon: "✈️",
        description: "Information for Pakistanis going abroad for employment",
        question: "What is the process for going abroad for employment from Pakistan?",
      },
      {
        id: "protector-fees",
        name: "Protector Fees",
        icon: "💰",
        description: "Protector-related fees and payments",
        question: "What are the current Protector of Emigrants fees?",
      },
      {
        id: "employment-promoters",
        name: "Licensed Overseas Employment Promoters",
        icon: "🏢",
        description: "Information about licensed employment promoters",
        question: "How can I verify a licensed Overseas Employment Promoter?",
      },
    ],
  },

  {
    id: "education",
    name: "Education & Scholarships",
    urdu: "تعلیم اور وظائف",
    icon: "🎓",
    description: "Scholarships and education-related services",
    services: [
      {
        id: "hec-scholarships",
        name: "HEC Scholarships",
        icon: "🎓",
        description: "Higher Education Commission scholarships",
        question: "What HEC scholarships are currently available?",
      },
      {
        id: "scholarship-eligibility",
        name: "Scholarship Eligibility",
        icon: "✅",
        description: "Eligibility criteria for scholarships",
        question: "How can I check my eligibility for government scholarships?",
      },
      {
        id: "scholarship-application",
        name: "Scholarship Application",
        icon: "📝",
        description: "How to apply for scholarships",
        question: "How can I apply for a government scholarship?",
      },
      {
        id: "scholarship-directory",
        name: "Scholarship Directory",
        icon: "📚",
        description: "Find available scholarship programmes",
        question: "Where can I find official scholarship opportunities?",
      },
    ],
  },

  {
    id: "land",
    name: "Land & Revenue",
    urdu: "اراضی اور ریونیو",
    icon: "🏠",
    description: "Land records and revenue services",
    services: [
      {
        id: "fard",
        name: "Fard / Land Record",
        icon: "📜",
        description: "Land ownership record information",
        question: "How can I obtain a Fard or land record?",
      },
      {
        id: "mutation",
        name: "Mutation / Intiqal",
        icon: "🔄",
        description: "Land mutation and transfer",
        question: "How can I apply for land mutation or Intiqal?",
      },
      {
        id: "land-verification",
        name: "Land Record Verification",
        icon: "🔎",
        description: "Verify land record information",
        question: "How can I verify a land record?",
      },
    ],
  },

  {
    id: "fbr",
    name: "FBR / Taxation",
    urdu: "ایف بی آر / ٹیکس",
    icon: "💰",
    description: "Federal tax and taxpayer services",
    services: [
      {
        id: "income-tax-registration",
        name: "Income Tax Registration / NTN",
        icon: "🧾",
        description: "Register for income tax",
        question: "How can I register for income tax and obtain an NTN?",
      },
      {
        id: "income-tax-return",
        name: "Income Tax Return",
        icon: "📑",
        description: "Income tax return information",
        question: "How can I file my income tax return?",
      },
      {
        id: "taxpayer-verification",
        name: "Taxpayer Verification",
        icon: "🔎",
        description: "Verify taxpayer information",
        question: "How can I verify my taxpayer status?",
      },
      {
        id: "atl",
        name: "Active Taxpayer List (ATL)",
        icon: "📋",
        description: "ATL and filer information",
        question: "How can I check my Active Taxpayer List status?",
      },
      {
        id: "iris",
        name: "FBR IRIS",
        icon: "💻",
        description: "FBR online tax system",
        question: "What services are available through FBR IRIS?",
      },
    ],
  },

  {
    id: "domicile",
    name: "Domicile",
    urdu: "ڈومیسائل",
    icon: "📍",
    description: "Domicile certificates and related information",
    services: [
      {
        id: "punjab-domicile",
        name: "Punjab Domicile",
        icon: "📍",
        description: "Punjab domicile information",
        question: "How can I apply for a Punjab domicile?",
      },
      {
        id: "kp-domicile",
        name: "Khyber Pakhtunkhwa Domicile",
        icon: "📍",
        description: "KP domicile information",
        question: "How can I apply for a Khyber Pakhtunkhwa domicile?",
      },
      {
        id: "sindh-domicile",
        name: "Sindh Domicile",
        icon: "📍",
        description: "Sindh domicile information",
        question: "How can I apply for a Sindh domicile?",
      },
      {
        id: "balochistan-domicile",
        name: "Balochistan Domicile",
        icon: "📍",
        description: "Balochistan domicile information",
        question: "How can I apply for a Balochistan domicile?",
      },
      {
        id: "ict-domicile",
        name: "Islamabad / ICT Domicile",
        icon: "📍",
        description: "ICT domicile information",
        question: "How can I apply for an Islamabad domicile?",
      },
    ],
  },

  {
    id: "jobs",
    name: "Government Jobs",
    urdu: "سرکاری ملازمتیں",
    icon: "💼",
    description: "Government recruitment and employment information",
    services: [
      {
        id: "federal-jobs",
        name: "Federal Government Jobs",
        icon: "🇵🇰",
        description: "Federal government vacancies",
        question: "Where can I find official federal government jobs?",
      },
      {
        id: "provincial-jobs",
        name: "Provincial Government Jobs",
        icon: "🏢",
        description: "Provincial government vacancies",
        question: "Where can I find official provincial government jobs?",
      },
      {
        id: "public-sector-jobs",
        name: "Public Sector Jobs",
        icon: "💼",
        description: "Public-sector employment",
        question: "Where can I find official public sector jobs?",
      },
    ],
  },
];

const languageOptions = [
  { id: "English", label: "English", icon: "🇬🇧" },
  { id: "Urdu", label: "اردو", icon: "🇵🇰" },
];

export default function Home() {
  const [selectedDepartment, setSelectedDepartment] = useState<Department>(
    departments[0]
  );

  const [selectedService, setSelectedService] = useState<Service>(
    departments[0].services[0]
  );

  const [question, setQuestion] = useState<string>(
    departments[0].services[0].question
  );

  const [language, setLanguage] = useState("English");
  const [answer, setAnswer] = useState("");
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function chooseDepartment(department: Department) {
    setSelectedDepartment(department);

    const firstService = department.services[0];

    setSelectedService(firstService);
    setQuestion(firstService.question);
    setAnswer("");
    setSource(null);
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function chooseService(service: Service) {
    setSelectedService(service);
    setQuestion(service.question);
    setAnswer("");
    setSource(null);
    setError("");
  }

  async function askQuestion() {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setError("Please enter a question.");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");
    setSource(null);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          service: selectedService.name,
          language,
        }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to process your question.");
      }

      setAnswer(data.answer || "No answer was returned.");
      setSource(data.source || null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleQuestionKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askQuestion();
    }
  }

  return (
    <main className={language === "Urdu" ? "urdu-mode" : ""}>
      {/* NAVIGATION */}
      <nav className="top-nav">
        <div className="brand">
          <div className="brand-icon">🇵🇰</div>

          <div>
            <div className="brand-title">Pakistan Citizen Helper</div>
            <div className="brand-subtitle">
              Government Services Information Assistant
            </div>
          </div>
        </div>

        <div className="language-switch">
          {languageOptions.map((item) => (
            <button
              key={item.id}
              className={
                language === item.id
                  ? "language-button active"
                  : "language-button"
              }
              onClick={() => setLanguage(item.id)}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-badge">🇵🇰 PUBLIC SERVICE INFORMATION</div>

        <h1>
          Pakistan Citizen
          <span> Helper</span>
        </h1>

        <p>
          Find verified information about Pakistani government services,
          requirements, documents, fees and application procedures.
        </p>

        <div className="trust-line">
          <span>✓ Official sources</span>
          <span>✓ Verified information</span>
          <span>✓ English & Urdu</span>
        </div>
      </section>

      {/* DEPARTMENT SELECTOR */}
      <section className="department-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">STEP 1</span>
            <h2>Select a Government Department</h2>
            <p>
              Choose the department or major service area you need.
            </p>
          </div>
        </div>

        <div className="department-grid">
          {departments.map((department) => (
            <button
              key={department.id}
              className={
                selectedDepartment.id === department.id
                  ? "department-card selected"
                  : "department-card"
              }
              onClick={() => chooseDepartment(department)}
            >
              <div className="department-icon">{department.icon}</div>

              <div className="department-content">
                <h3>{department.name}</h3>

                <p>{department.description}</p>

                <div className="service-count">
                  {department.services.length} services
                </div>
              </div>

              <div className="arrow">→</div>
            </button>
          ))}
        </div>
      </section>

      {/* SERVICE LIST */}
      <section className="service-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">STEP 2</span>

            <h2>
              {selectedDepartment.icon} {selectedDepartment.name}
            </h2>

            <p>
              Select the specific service you need.
            </p>
          </div>
        </div>

        <div className="service-grid">
          {selectedDepartment.services.map((service) => (
            <button
              key={service.id}
              className={
                selectedService.id === service.id
                  ? "service-card selected"
                  : "service-card"
              }
              onClick={() => chooseService(service)}
            >
              <div className="service-icon">{service.icon}</div>

              <div className="service-card-content">
                <h3>{service.name}</h3>
                <p>{service.description}</p>
              </div>

              <div className="service-arrow">›</div>
            </button>
          ))}
        </div>
      </section>

      {/* ASK AI */}
      <section className="ask-section">
        <div className="ask-header">
          <div>
            <span className="eyebrow">STEP 3</span>

            <h2>
              Ask About{" "}
              <span>{selectedService.name}</span>
            </h2>

            <p>
              Ask your question in English or Urdu. The assistant will use
              verified information available for this service.
            </p>
          </div>

          <div className="selected-service-badge">
            {selectedService.icon} {selectedService.name}
          </div>
        </div>

        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleQuestionKeyDown}
          placeholder={
            language === "Urdu"
              ? "اپنا سوال یہاں لکھیں..."
              : "Ask your question here..."
          }
          rows={5}
          className="question-box"
          dir={language === "Urdu" ? "rtl" : "ltr"}
        />

        <div className="ask-actions">
          <div className="hint">
            Press Enter to ask • Shift + Enter for a new line
          </div>

          <button
            className="ask-button"
            onClick={askQuestion}
            disabled={loading}
          >
            {loading ? "⏳ Checking..." : "✨ Get Verified Answer"}
          </button>
        </div>

        {error && (
          <div className="error-box">
            ⚠️ {error}
          </div>
        )}
      </section>

      {/* LOADING */}
      {loading && (
        <section className="loading-section">
          <div className="loading-spinner">⟳</div>

          <h3>Checking verified information...</h3>

          <p>
            We are finding the most relevant information for:
            <strong> {selectedService.name}</strong>
          </p>
        </section>
      )}

      {/* ANSWER */}
      {!loading && answer && (
        <section className="answer-section">
          <div className="answer-header">
            <div>
              <span className="eyebrow">VERIFIED INFORMATION</span>
              <h2>Answer</h2>
            </div>

            <div className="verified-badge">✓ Verified</div>
          </div>

          <div
            className="answer-content"
            dir={language === "Urdu" ? "rtl" : "ltr"}
          >
            {answer.split("\n").map((line, index) => (
              <p key={index}>
                {line || "\u00A0"}
              </p>
            ))}
          </div>

          {source && (
            <div className="source-card">
              <div className="source-icon">🔗</div>

              <div className="source-info">
                <span>OFFICIAL SOURCE</span>

                <strong>
                  {source.title ||
                    source.department ||
                    "Official Government Source"}
                </strong>

                {source.department && (
                  <small>{source.department}</small>
                )}

                {source.lastVerified && (
                  <small>
                    Last verified: {source.lastVerified}
                  </small>
                )}
              </div>

              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-button"
                >
                  Visit Official Source ↗
                </a>
              )}
            </div>
          )}

          <div className="answer-warning">
            <strong>Important:</strong> Government fees, requirements,
            processing times and procedures can change. Always confirm
            important information from the linked official source.
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section className="how-section">
        <div className="section-heading centered">
          <span className="eyebrow">HOW IT WORKS</span>

          <h2>Simple. Verified. Citizen-focused.</h2>

          <p>
            Pakistan Citizen Helper organizes government services by
            department so citizens can find the right information quickly.
          </p>
        </div>

        <div className="how-grid">
          <div className="how-card">
            <div>1</div>
            <h3>Select Department</h3>
            <p>
              Choose NADRA, Police, Excise, Union Council, FBR or another
              government service area.
            </p>
          </div>

          <div className="how-card">
            <div>2</div>
            <h3>Select Service</h3>
            <p>
              Select the exact service such as CRC, vehicle transfer,
              birth certificate or police clearance.
            </p>
          </div>

          <div className="how-card">
            <div>3</div>
            <h3>Ask Your Question</h3>
            <p>
              Ask in English or Urdu and receive information based on
              verified records.
            </p>
          </div>

          <div className="how-card">
            <div>4</div>
            <h3>Check Official Source</h3>
            <p>
              Follow the official source link to confirm the latest
              government information.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div>
          <strong>🇵🇰 Pakistan Citizen Helper</strong>

          <p>
            A citizen-focused information assistant for Pakistani
            government services.
          </p>
        </div>

        <div className="footer-right">
          <p>
            Developed by <strong>Raees Khan</strong>
          </p>

          <p>Assistant Director, NADRA</p>
        </div>
      </footer>

      {/* PAGE STYLES */}
      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        main {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(16, 185, 129, 0.11),
              transparent 28%
            ),
            radial-gradient(
              circle at 90% 10%,
              rgba(59, 130, 246, 0.1),
              transparent 30%
            ),
            #f7fafc;
          color: #172033;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .top-nav {
          min-height: 76px;
          padding: 14px 6%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          background: rgba(255, 255, 255, 0.94);
          border-bottom: 1px solid #e7edf2;
          position: sticky;
          top: 0;
          z-index: 20;
          backdrop-filter: blur(15px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-icon {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, #0f766e, #059669);
          font-size: 25px;
          box-shadow: 0 8px 22px rgba(5, 150, 105, 0.2);
        }

        .brand-title {
          font-size: 18px;
          font-weight: 850;
          color: #12352f;
        }

        .brand-subtitle {
          margin-top: 2px;
          font-size: 11px;
          color: #718096;
        }

        .language-switch {
          display: flex;
          gap: 7px;
        }

        .language-button {
          border: 1px solid #dce5ea;
          background: white;
          color: #52616f;
          padding: 9px 13px;
          border-radius: 11px;
          cursor: pointer;
          font-weight: 700;
        }

        .language-button.active {
          background: #0f766e;
          border-color: #0f766e;
          color: white;
        }

        .hero {
          max-width: 1100px;
          margin: 0 auto;
          padding: 76px 24px 58px;
          text-align: center;
        }

        .hero-badge,
        .eyebrow {
          display: inline-block;
          color: #047857;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .hero h1 {
          margin: 15px 0 15px;
          font-size: clamp(40px, 7vw, 72px);
          line-height: 0.98;
          letter-spacing: -0.05em;
          color: #132a27;
        }

        .hero h1 span {
          color: #059669;
        }

        .hero p {
          max-width: 720px;
          margin: 0 auto;
          font-size: 18px;
          line-height: 1.7;
          color: #617080;
        }

        .trust-line {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px 25px;
          margin-top: 24px;
          color: #3e635c;
          font-size: 13px;
          font-weight: 700;
        }

        .department-section,
        .service-section,
        .ask-section,
        .answer-section,
        .how-section {
          max-width: 1180px;
          margin: 0 auto;
          padding: 35px 24px;
        }

        .section-heading {
          margin-bottom: 22px;
        }

        .section-heading h2 {
          margin: 7px 0 6px;
          font-size: clamp(25px, 4vw, 34px);
          color: #182b38;
          letter-spacing: -0.025em;
        }

        .section-heading p {
          margin: 0;
          color: #708090;
        }

        .centered {
          text-align: center;
        }

        .department-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .department-card {
          position: relative;
          text-align: left;
          display: flex;
          align-items: center;
          gap: 16px;
          min-height: 130px;
          padding: 20px;
          border: 1px solid #e0e8ed;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.95);
          cursor: pointer;
          transition: 0.22s ease;
          box-shadow: 0 7px 22px rgba(25, 45, 60, 0.04);
        }

        .department-card:hover,
        .department-card.selected {
          transform: translateY(-3px);
          border-color: #5fc6aa;
          box-shadow: 0 13px 32px rgba(15, 118, 110, 0.11);
        }

        .department-icon {
          flex: 0 0 auto;
          width: 58px;
          height: 58px;
          border-radius: 17px;
          display: grid;
          place-items: center;
          background: #ecfdf5;
          font-size: 29px;
        }

        .department-content {
          min-width: 0;
        }

        .department-content h3 {
          margin: 0 0 6px;
          font-size: 17px;
          color: #18332e;
        }

        .department-content p {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: #73818b;
        }

        .service-count {
          margin-top: 9px;
          font-size: 11px;
          color: #059669;
          font-weight: 800;
        }

        .arrow {
          margin-left: auto;
          font-size: 24px;
          color: #9aabb4;
        }

        .service-section {
          margin-top: 10px;
        }

        .service-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .service-card {
          min-height: 120px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
          padding: 16px;
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 17px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .service-card:hover,
        .service-card.selected {
          border-color: #54b89e;
          transform: translateY(-2px);
          box-shadow: 0 10px 26px rgba(15, 118, 110, 0.09);
        }

        .service-icon {
          width: 43px;
          height: 43px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: #f0fdf9;
          font-size: 22px;
        }

        .service-card-content {
          min-width: 0;
        }

        .service-card h3 {
          margin: 0 0 5px;
          font-size: 14px;
          line-height: 1.35;
          color: #20313d;
        }

        .service-card p {
          margin: 0;
          font-size: 11px;
          line-height: 1.45;
          color: #788792;
        }

        .service-arrow {
          margin-left: auto;
          color: #9aabb4;
          font-size: 23px;
        }

        .ask-section {
          margin-top: 30px;
          padding: 30px;
          border-radius: 26px;
          background:
            linear-gradient(
              135deg,
              rgba(236, 253, 245, 0.95),
              rgba(239, 246, 255, 0.96)
            );
          border: 1px solid #d8ebe5;
        }

        .ask-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 25px;
        }

        .ask-header h2 {
          margin: 7px 0;
          font-size: 30px;
          color: #173a34;
        }

        .ask-header h2 span {
          color: #059669;
        }

        .ask-header p {
          margin: 0;
          max-width: 700px;
          color: #637570;
          line-height: 1.6;
        }

        .selected-service-badge {
          flex: 0 0 auto;
          padding: 11px 15px;
          border-radius: 13px;
          background: white;
          border: 1px solid #d4e7e1;
          color: #176653;
          font-size: 12px;
          font-weight: 800;
        }

        .question-box {
          width: 100%;
          margin-top: 25px;
          resize: vertical;
          min-height: 130px;
          border: 1px solid #cbded8;
          border-radius: 17px;
          background: white;
          padding: 18px;
          font-size: 16px;
          line-height: 1.6;
          color: #20343e;
          outline: none;
          font-family: inherit;
        }

        .question-box:focus {
          border-color: #10a37f;
          box-shadow: 0 0 0 4px rgba(16, 163, 127, 0.1);
        }

        .ask-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-top: 13px;
        }

        .hint {
          font-size: 11px;
          color: #71818a;
        }

        .ask-button {
          border: none;
          padding: 14px 22px;
          border-radius: 13px;
          background: linear-gradient(135deg, #047857, #059669);
          color: white;
          font-weight: 850;
          cursor: pointer;
          box-shadow: 0 9px 20px rgba(5, 150, 105, 0.2);
        }

        .ask-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .error-box {
          margin-top: 15px;
          padding: 13px 16px;
          border-radius: 12px;
          background: #fff1f2;
          border: 1px solid #fecdd3;
          color: #9f1239;
          font-size: 13px;
        }

        .loading-section {
          max-width: 760px;
          margin: 30px auto;
          padding: 32px 24px;
          text-align: center;
          background: white;
          border-radius: 22px;
          border: 1px solid #e4ebef;
        }

        .loading-spinner {
          width: 48px;
          height: 48px;
          margin: 0 auto 15px;
          border: 4px solid #d9eee8;
          border-top-color: #059669;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 25px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .loading-section h3 {
          margin: 0 0 7px;
          color: #1d3833;
        }

        .loading-section p {
          margin: 0;
          color: #71808a;
          font-size: 13px;
        }

        .answer-section {
          margin-top: 20px;
          padding: 30px;
          background: white;
          border-radius: 25px;
          border: 1px solid #dfe8ed;
          box-shadow: 0 10px 35px rgba(30, 55, 70, 0.06);
        }

        .answer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          border-bottom: 1px solid #e9eef1;
          padding-bottom: 17px;
        }

        .answer-header h2 {
          margin: 6px 0 0;
          color: #17342f;
        }

        .verified-badge {
          padding: 8px 12px;
          border-radius: 999px;
          background: #ecfdf5;
          color: #047857;
          font-size: 12px;
          font-weight: 850;
        }

        .answer-content {
          padding: 22px 4px;
          color: #33444f;
          font-size: 16px;
          line-height: 1.85;
        }

        .answer-content p {
          margin: 0 0 8px;
        }

        .source-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 17px;
          border-radius: 17px;
          background: #f7fbfa;
          border: 1px solid #dcece7;
        }

        .source-icon {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #e4f7f0;
        }

        .source-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .source-info span {
          font-size: 9px;
          letter-spacing: 0.1em;
          color: #059669;
          font-weight: 900;
        }

        .source-info strong {
          color: #25413b;
          font-size: 13px;
        }

        .source-info small {
          color: #71818a;
          font-size: 10px;
        }

        .source-button {
          margin-left: auto;
          flex: 0 0 auto;
          text-decoration: none;
          padding: 10px 13px;
          border-radius: 10px;
          background: #0f766e;
          color: white;
          font-size: 11px;
          font-weight: 800;
        }

        .answer-warning {
          margin-top: 14px;
          padding: 13px 15px;
          border-radius: 12px;
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #785d08;
          font-size: 11px;
          line-height: 1.6;
        }

        .how-section {
          padding-top: 70px;
          padding-bottom: 65px;
        }

        .how-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 15px;
          margin-top: 30px;
        }

        .how-card {
          padding: 22px;
          background: white;
          border: 1px solid #e3eaee;
          border-radius: 18px;
        }

        .how-card > div {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #ecfdf5;
          color: #047857;
          font-weight: 900;
        }

        .how-card h3 {
          margin: 15px 0 7px;
          font-size: 15px;
        }

        .how-card p {
          margin: 0;
          color: #71808b;
          font-size: 12px;
          line-height: 1.6;
        }

        .footer {
          padding: 32px 6%;
          display: flex;
          justify-content: space-between;
          gap: 30px;
          background: #122b28;
          color: white;
        }

        .footer strong {
          color: white;
        }

        .footer p {
          margin: 6px 0 0;
          color: #abc0bb;
          font-size: 11px;
        }

        .footer-right {
          text-align: right;
        }

        .urdu-mode {
          font-family:
            "Noto Nastaliq Urdu",
            "Noto Sans Arabic",
            "Segoe UI",
            sans-serif;
        }

        @media (max-width: 900px) {
          .department-grid {
            grid-template-columns: 1fr;
          }

          .service-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .how-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 650px) {
          .top-nav {
            align-items: flex-start;
            flex-direction: column;
          }

          .language-switch {
            width: 100%;
          }

          .language-button {
            flex: 1;
          }

          .hero {
            padding-top: 48px;
          }

          .hero h1 {
            font-size: 45px;
          }

          .hero p {
            font-size: 15px;
          }

          .service-grid {
            grid-template-columns: 1fr;
          }

          .ask-section,
          .answer-section {
            padding: 20px;
          }

          .ask-header {
            flex-direction: column;
          }

          .selected-service-badge {
            width: 100%;
          }

          .ask-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .ask-button {
            width: 100%;
          }

          .source-card {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .source-button {
            width: 100%;
            margin-left: 0;
            text-align: center;
          }

          .how-grid {
            grid-template-columns: 1fr;
          }

          .footer {
            flex-direction: column;
          }

          .footer-right {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}
