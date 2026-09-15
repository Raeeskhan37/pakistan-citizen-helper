"use client";

import { useEffect, useRef, useState } from "react";

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
  liveVerified?: boolean;
  checkedAt?: string;
  province?: string;
};

type ApiResponse = {
  answer?: string;
  source?: SourceInfo | null;
  error?: string;
};

type Profile = {
  name: string;
  province: string;
  language: "English" | "Urdu";
  district?: string;
  email?: string;
  mobile?: string;
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
  { id: "English" as const, label: "English", icon: "🇬🇧" },
  { id: "Urdu" as const, label: "اردو", icon: "🇵🇰" },
];

const PROVINCES = [
  "Punjab",
  "Khyber Pakhtunkhwa",
  "Sindh",
  "Balochistan",
  "Islamabad Capital Territory",
  "Azad Jammu & Kashmir",
  "Gilgit-Baltistan",
];

const PROFILE_KEY = "pakistan_citizen_helper_profile_v2";

export default function Home() {
  const firstService = departments[0].services[0];
  const [selectedDepartment, setSelectedDepartment] = useState<Department>(departments[0]);
  const [selectedService, setSelectedService] = useState<Service>(firstService);
  const [question, setQuestion] = useState(firstService.question);
  const [language, setLanguage] = useState<"English" | "Urdu">("English");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [draftProfile, setDraftProfile] = useState<Profile>({
    name: "",
    province: "",
    language: "English",
  });
  const [answer, setAnswer] = useState("");
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");
  const questionRef = useRef<HTMLTextAreaElement | null>(null);
  const askRef = useRef<HTMLElement | null>(null);
  const servicesRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PROFILE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Profile;
        if (parsed.name && parsed.province && parsed.language) {
          setProfile(parsed);
          setLanguage(parsed.language);
          return;
        }
      }
    } catch {
      // Ignore malformed local storage and show profile form.
    }
    setProfileOpen(true);
  }, []);

  useEffect(() => {
    if (profile?.language) setLanguage(profile.language);
  }, [profile]);

  function saveProfile() {
    const name = draftProfile.name.trim();
    const province = draftProfile.province.trim();
    if (!name || !province) return;

    const saved: Profile = {
      ...draftProfile,
      name,
      province,
      language,
    };
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(saved));
    setProfile(saved);
    setLanguage(saved.language);
    setProfileOpen(false);
  }

  function editProfile() {
    setDraftProfile(profile || { name: "", province: "", language });
    setProfileOpen(true);
  }

  function changeLanguage(next: "English" | "Urdu") {
    setLanguage(next);
    setProfile((current) => {
      if (!current) return current;
      const updated = { ...current, language: next };
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  function chooseDepartment(department: Department) {
    setSelectedDepartment(department);
    const first = department.services[0];
    setSelectedService(first);
    setQuestion(first.question);
    setAnswer("");
    setSource(null);
    setError("");
    setSelectionNotice(`${department.name} selected. Now choose a specific service.`);
    requestAnimationFrame(() => {
      servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function chooseService(service: Service) {
    setSelectedService(service);
    setQuestion(service.question);
    setAnswer("");
    setSource(null);
    setError("");
    setSelectionNotice(
      language === "Urdu"
        ? `آپ نے ${service.name} منتخب کیا ہے۔ اب اپنا سوال پوچھیں۔`
        : `You selected ${service.name}. What would you like to know?`
    );
    requestAnimationFrame(() => {
      askRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => questionRef.current?.focus(), 500);
    });
  }

  async function askQuestion() {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError(language === "Urdu" ? "براہ کرم سوال درج کریں۔" : "Please enter a question.");
      questionRef.current?.focus();
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");
    setSource(null);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          service: selectedService.name,
          language,
          profile: profile
            ? { name: profile.name, province: profile.province, district: profile.district || "" }
            : null,
        }),
      });

      const data: ApiResponse = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to process your question.");
      setAnswer(data.answer || "No answer was returned.");
      setSource(data.source || null);
      requestAnimationFrame(() => {
        document.getElementById("answer-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleQuestionKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askQuestion();
    }
  }

  return (
    <main className={language === "Urdu" ? "urdu-mode" : ""}>
      <nav className="top-nav">
        <div className="brand">
          <div className="brand-icon">🇵🇰</div>
          <div>
            <div className="brand-title">Pakistan Citizen Helper</div>
            <div className="brand-subtitle">Government Services Information Assistant</div>
          </div>
        </div>

        <div className="nav-actions">
          <div className="language-switch">
            {languageOptions.map((item) => (
              <button
                key={item.id}
                className={language === item.id ? "language-button active" : "language-button"}
                onClick={() => changeLanguage(item.id)}
              >
                {item.icon} {item.label}
              </button>
            ))}
          </div>
          <button className="profile-button" onClick={editProfile}>
            👤 {profile?.name || "Profile"}
          </button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="hero-badge">🇵🇰 CITIZEN INFORMATION ASSISTANT</div>
          <h1>Government services, <span>made easier.</span></h1>
          <p>
            Find clear, practical information about Pakistani government services,
            requirements, documents, fees and procedures — with official sources.
          </p>
          <div className="trust-row">
            <span>✓ Official sources</span>
            <span>✓ Verified records</span>
            <span>✓ English & Urdu</span>
            <span>✓ Service-specific guidance</span>
          </div>
        </div>

        <div className="hero-panel">
          <div className="hero-panel-top">
            <span className="live-dot"></span>
            <strong>How to use it</strong>
          </div>
          <div className="mini-step"><b>1</b><span>Choose a department</span></div>
          <div className="mini-step"><b>2</b><span>Select your service</span></div>
          <div className="mini-step"><b>3</b><span>Ask your question</span></div>
          <div className="mini-step"><b>4</b><span>Check the official source</span></div>
        </div>
      </section>

      {profile && (
        <section className="profile-strip">
          <div>
            <span className="eyebrow">YOUR PROFILE</span>
            <strong>Welcome, {profile.name}</strong>
            <small>
              {profile.province} · Your province is used only when a service requires provincial or local jurisdiction.
            </small>
          </div>
          <button onClick={editProfile}>Edit profile</button>
        </section>
      )}

      <section className="department-section content-section">
        <div className="section-heading">
          <div>
            <span className="step-pill">STEP 1</span>
            <h2>Choose a government department</h2>
            <p>Start with the area that matches the service you need.</p>
          </div>
        </div>

        <div className="department-grid">
          {departments.map((department) => (
            <button
              key={department.id}
              className={selectedDepartment.id === department.id ? "department-card selected" : "department-card"}
              onClick={() => chooseDepartment(department)}
            >
              <div className="department-icon">{department.icon}</div>
              <div className="department-content">
                <h3>{department.name}</h3>
                <p>{department.description}</p>
                <span>{department.services.length} services</span>
              </div>
              <div className="arrow">→</div>
            </button>
          ))}
        </div>
      </section>

      <section ref={servicesRef} className="service-section content-section" id="services">
        <div className="section-heading">
          <div>
            <span className="step-pill">STEP 2</span>
            <h2>{selectedDepartment.icon} {selectedDepartment.name}</h2>
            <p>Select the specific service. We will take you directly to the question box.</p>
          </div>
          <div className="service-location">Selected department</div>
        </div>

        <div className="service-grid">
          {selectedDepartment.services.map((service) => (
            <button
              key={service.id}
              className={selectedService.id === service.id ? "service-card selected" : "service-card"}
              onClick={() => chooseService(service)}
            >
              <div className="service-icon">{service.icon}</div>
              <div className="service-card-content">
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <strong>Ask about this →</strong>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectionNotice && (
        <div className="selection-notice" role="status">
          <span>✓</span>
          <div>{selectionNotice}</div>
        </div>
      )}

      <section ref={askRef} className="ask-section content-section" id="ask">
        <div className="ask-header">
          <div>
            <span className="step-pill dark">STEP 3</span>
            <h2>What would you like to know?</h2>
            <p>
              Ask about <strong>{selectedService.name}</strong>. If the service
              needs province or district information, we use it only for that purpose.
            </p>
          </div>
          <div className="selected-service-badge">
            {selectedService.icon} {selectedService.name}
          </div>
        </div>

        <div className="question-label">Your question</div>
        <textarea
          ref={questionRef}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleQuestionKeyDown}
          placeholder={language === "Urdu" ? "اپنا سوال یہاں لکھیں..." : "For example: What documents do I need and how much does it cost?"}
          rows={5}
          className="question-box"
          dir={language === "Urdu" ? "rtl" : "ltr"}
        />

        <div className="example-row">
          <span>Try:</span>
          <button onClick={() => setQuestion(selectedService.question)}>Use a common question</button>
          <button onClick={() => setQuestion(language === "Urdu" ? "اس سروس کے لیے ضروری دستاویزات کیا ہیں؟" : "What documents are required?")}>Required documents</button>
          <button onClick={() => setQuestion(language === "Urdu" ? "فیس اور پراسیسنگ کا وقت کیا ہے؟" : "What is the fee and processing time?")}>Fee & time</button>
        </div>

        <div className="ask-actions">
          <div className="hint">Enter to ask · Shift + Enter for a new line</div>
          <button className="ask-button" onClick={askQuestion} disabled={loading}>
            {loading ? "⏳ Checking official information..." : "✨ Get verified answer"}
          </button>
        </div>

        {error && <div className="error-box">⚠️ {error}</div>}
      </section>

      {loading && (
        <section className="loading-section content-section">
          <div className="loading-spinner"></div>
          <div>
            <h3>Checking trusted information…</h3>
            <p>Searching approved official sources and your verified information.</p>
          </div>
        </section>
      )}

      {!loading && answer && (
        <section id="answer-section" className="answer-section content-section">
          <div className="answer-header">
            <div>
              <span className="step-pill">RESULT</span>
              <h2>Your answer</h2>
            </div>
            <div className={source?.liveVerified ? "verified-badge live" : "verified-badge"}>
              {source?.liveVerified ? "✓ Live verified" : "✓ Verified record"}
            </div>
          </div>

          <div className="answer-content" dir={language === "Urdu" ? "rtl" : "ltr"}>
            {answer.split("\n").map((line, index) => (
              <p key={index}>{line || "\u00A0"}</p>
            ))}
          </div>

          {source && (
            <div className="source-card">
              <div className="source-icon">🔗</div>
              <div className="source-info">
                <span>{source.liveVerified ? "LIVE OFFICIAL SOURCE" : "VERIFIED OFFICIAL SOURCE"}</span>
                <strong>{source.title || source.department || "Official Government Source"}</strong>
                {source.department && <small>{source.department}</small>}
                {source.lastVerified && <small>Database verified: {source.lastVerified}</small>}
                {source.liveVerified && source.checkedAt && <small>Live check: {source.checkedAt}</small>}
              </div>
              {source.url && (
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="source-button">
                  Visit official source ↗
                </a>
              )}
            </div>
          )}

          <div className="answer-warning">
            <strong>Important:</strong> Government information can change. Use the official source link for final confirmation before making an important application or payment.
          </div>
        </section>
      )}

      <section className="how-section content-section">
        <div className="section-heading centered">
          <span className="step-pill">SIMPLE PROCESS</span>
          <h2>Clear information, without the confusion</h2>
          <p>Pakistan Citizen Helper separates service selection from the actual question so you always know where you are.</p>
        </div>
        <div className="how-grid">
          <div className="how-card"><b>1</b><h3>Choose</h3><p>Select the government department.</p></div>
          <div className="how-card"><b>2</b><h3>Select</h3><p>Choose the exact service you need.</p></div>
          <div className="how-card"><b>3</b><h3>Ask</h3><p>Your screen moves directly to the question box.</p></div>
          <div className="how-card"><b>4</b><h3>Verify</h3><p>Review the official source before acting.</p></div>
        </div>
      </section>

      <footer className="footer">
        <div>
          <strong>🇵🇰 Pakistan Citizen Helper</strong>
          <p>Citizen-focused information for Pakistani government services.</p>
        </div>
        <div className="footer-right">
          <p>Developed by <strong>Raees Khan</strong></p>
          <p>Assistant Director, NADRA</p>
        </div>
      </footer>

      {profileOpen && (
        <div className="modal-backdrop">
          <div className="profile-modal">
            <div className="modal-icon">🇵🇰</div>
            <span className="eyebrow">QUICK PROFILE</span>
            <h2>Let's personalize your experience</h2>
            <p>
              We only need three things to start. Your province will <strong>not</strong> restrict federal services such as CNIC or passport.
            </p>

            <label>Name *</label>
            <input
              value={draftProfile.name}
              onChange={(e) => setDraftProfile({ ...draftProfile, name: e.target.value })}
              placeholder="Your name"
              autoFocus
            />

            <label>Province / region *</label>
            <select
              value={draftProfile.province}
              onChange={(e) => setDraftProfile({ ...draftProfile, province: e.target.value })}
            >
              <option value="">Select province / region</option>
              {PROVINCES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <label>Preferred language *</label>
            <div className="modal-language">
              {languageOptions.map((item) => (
                <button
                  key={item.id}
                  className={language === item.id ? "modal-lang active" : "modal-lang"}
                  onClick={() => {
                    setLanguage(item.id);
                    setDraftProfile({ ...draftProfile, language: item.id });
                  }}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>

            <button
              className="save-profile"
              disabled={!draftProfile.name.trim() || !draftProfile.province}
              onClick={saveProfile}
            >
              Save profile & continue →
            </button>
            {profile && <button className="cancel-profile" onClick={() => setProfileOpen(false)}>Cancel</button>}
            <small className="privacy-note">Your profile is saved in this browser on this device. It is not required for every service.</small>
          </div>
        </div>
      )}
    </main>
  );
}
