"use client";

import { useMemo, useState } from "react";

type Service = { id: string; name: string; icon: string; description: string; question: string };
type Department = { id: string; name: string; urdu: string; icon: string; description: string; services: Service[] };
type SourceInfo = { department?: string; title?: string; url?: string; lastVerified?: string; liveVerified?: boolean; checkedAt?: string; province?: string };
type ApiResponse = { answer?: string; source?: SourceInfo | null; error?: string };

const departments: Department[] = [
  { id: "nadra", name: "NADRA Services", urdu: "نادرا کی خدمات", icon: "🪪", description: "CNIC, family certificates and identity services", services: [
    { id: "cnic", name: "CNIC / Smart CNIC", icon: "🪪", description: "New CNIC and general information", question: "How can I apply for a new CNIC?" },
    { id: "cnic-renewal", name: "CNIC Renewal", icon: "🔄", description: "Renew an existing CNIC", question: "How can I renew my CNIC?" },
    { id: "cnic-modification", name: "CNIC Modification", icon: "✏️", description: "Correct or update CNIC information", question: "How can I modify my CNIC information?" },
    { id: "cnic-reprint", name: "CNIC Reprint / Lost", icon: "♻️", description: "Lost or damaged CNIC", question: "How can I get a reprint of my lost CNIC?" },
    { id: "crc", name: "CRC / B-Form", icon: "👶", description: "Child Registration Certificate", question: "How can I apply for a CRC / B-Form?" },
    { id: "juvenile", name: "Juvenile Card", icon: "🧒", description: "Identity document for children", question: "How can I apply for a Juvenile Card?" },
    { id: "frc", name: "Family Registration Certificate", icon: "👨‍👩‍👧‍👦", description: "Family composition certificate", question: "How can I obtain an FRC?" },
    { id: "nicop", name: "NICOP", icon: "🌍", description: "For overseas Pakistanis", question: "How can I apply for NICOP?" },
    { id: "poc", name: "POC", icon: "🌐", description: "Pakistan Origin Card", question: "How can I apply for a POC?" },
    { id: "cancellation", name: "Cancellation Certificate", icon: "📄", description: "NADRA cancellation services", question: "How can I apply for a Cancellation Certificate?" },
    { id: "pakid", name: "PakID Services", icon: "📱", description: "NADRA online services", question: "What services are available through PakID?" },
    { id: "fees", name: "NADRA Fees & Processing", icon: "💰", description: "Current fees and timelines", question: "What are the current NADRA fees and processing times?" },
  ]},
  { id: "union-council", name: "Union Council / Local Government", urdu: "یونین کونسل / بلدیاتی خدمات", icon: "🏛️", description: "Civil registration and local services", services: [
    { id: "birth", name: "Birth Certificate", icon: "👶", description: "Birth registration", question: "How can I obtain a birth certificate?" },
    { id: "death", name: "Death Certificate", icon: "📜", description: "Death registration", question: "How can I obtain a death certificate?" },
    { id: "marriage", name: "Marriage Certificate", icon: "💍", description: "Marriage registration", question: "How can I obtain a marriage certificate?" },
    { id: "divorce", name: "Divorce Certificate", icon: "📄", description: "Divorce registration", question: "How can I obtain a divorce certificate?" },
    { id: "civil", name: "Civil Registration", icon: "📝", description: "Local civil registration", question: "What civil registration services are available?" },
  ]},
  { id: "excise", name: "Excise & Taxation", urdu: "ایکسائز اینڈ ٹیکسیشن", icon: "🚗", description: "Vehicle registration and taxation", services: [
    { id: "registration", name: "Motor Vehicle Registration", icon: "🚗", description: "Register a vehicle", question: "How can I register a motor vehicle?" },
    { id: "transfer", name: "Vehicle Ownership Transfer", icon: "🔁", description: "Transfer ownership", question: "How can I transfer vehicle ownership?" },
    { id: "token", name: "Vehicle Token Tax", icon: "💰", description: "Vehicle tax payment", question: "How can I pay vehicle token tax?" },
    { id: "verification", name: "Vehicle Verification", icon: "🔎", description: "Verify vehicle information", question: "How can I verify a vehicle?" },
    { id: "renewal", name: "Vehicle Registration Renewal", icon: "🔄", description: "Renew registration", question: "How can I renew vehicle registration?" },
    { id: "plate", name: "Number Plate", icon: "🔢", description: "Number plate information", question: "How can I obtain or replace a number plate?" },
  ]},
  { id: "police", name: "Police Services", urdu: "پولیس کی خدمات", icon: "👮", description: "Verification and police facilitation", services: [
    { id: "clearance", name: "Police Clearance Certificate", icon: "📜", description: "Police clearance", question: "How can I obtain a Police Clearance Certificate?" },
    { id: "character", name: "Police Character Certificate", icon: "📄", description: "Character certificate", question: "How can I obtain a Police Character Certificate?" },
    { id: "verification", name: "Police Verification", icon: "🔎", description: "Police verification", question: "How can I apply for police verification?" },
    { id: "tenant", name: "Tenant Verification", icon: "🏠", description: "Tenant verification", question: "How can I get tenant verification?" },
    { id: "employee", name: "Employee Verification", icon: "👤", description: "Employee verification", question: "How can I apply for employee verification?" },
    { id: "fir", name: "FIR / Police Complaint", icon: "🚨", description: "Complaint and FIR information", question: "How can I register a police complaint or FIR?" },
  ]},
  { id: "passport", name: "Passport & Immigration", urdu: "پاسپورٹ اور امیگریشن", icon: "🛂", description: "Passport and immigration information", services: [
    { id: "passport", name: "Passport", icon: "🛂", description: "New passport", question: "How can I apply for a passport?" },
    { id: "renewal", name: "Passport Renewal", icon: "🔄", description: "Renew a passport", question: "How can I renew my passport?" },
    { id: "modification", name: "Passport Modification", icon: "✏️", description: "Modify passport information", question: "How can I modify my passport information?" },
    { id: "lost", name: "Lost Passport", icon: "⚠️", description: "Lost passport procedure", question: "What should I do if my passport is lost?" },
    { id: "immigration", name: "Immigration Information", icon: "🌍", description: "General immigration information", question: "What immigration procedures are available?" },
  ]},
  { id: "protector", name: "Protector & Overseas Employment", urdu: "پروٹیکٹر اور بیرون ملک ملازمت", icon: "✈️", description: "Overseas employment services", services: [
    { id: "protector", name: "Protector of Emigrants", icon: "🛡️", description: "Protector registration", question: "How can I obtain Protector of Emigrants registration?" },
    { id: "overseas", name: "Overseas Employment", icon: "✈️", description: "Employment abroad", question: "What is the process for going abroad for employment?" },
    { id: "fees", name: "Protector Fees", icon: "💰", description: "Current fees", question: "What are the current Protector fees?" },
    { id: "promoters", name: "Licensed Employment Promoters", icon: "🏢", description: "Verify licensed promoters", question: "How can I verify a licensed employment promoter?" },
  ]},
  { id: "education", name: "Education & Scholarships", urdu: "تعلیم اور وظائف", icon: "🎓", description: "Scholarships and education", services: [
    { id: "hec", name: "HEC Scholarships", icon: "🎓", description: "HEC scholarship information", question: "What HEC scholarships are available?" },
    { id: "eligibility", name: "Scholarship Eligibility", icon: "✅", description: "Eligibility criteria", question: "How can I check scholarship eligibility?" },
    { id: "application", name: "Scholarship Application", icon: "📝", description: "How to apply", question: "How can I apply for a government scholarship?" },
    { id: "directory", name: "Scholarship Directory", icon: "📚", description: "Official opportunities", question: "Where can I find official scholarship opportunities?" },
  ]},
  { id: "land", name: "Land & Revenue", urdu: "اراضی اور ریونیو", icon: "🏠", description: "Land records and revenue", services: [
    { id: "fard", name: "Fard / Land Record", icon: "📜", description: "Land ownership record", question: "How can I obtain a Fard or land record?" },
    { id: "mutation", name: "Mutation / Intiqal", icon: "🔄", description: "Land mutation", question: "How can I apply for land mutation or Intiqal?" },
    { id: "land-verification", name: "Land Record Verification", icon: "🔎", description: "Verify land records", question: "How can I verify a land record?" },
  ]},
  { id: "fbr", name: "FBR / Taxation", urdu: "ایف بی آر / ٹیکس", icon: "💰", description: "Federal tax services", services: [
    { id: "ntn", name: "Income Tax / NTN", icon: "🧾", description: "Tax registration", question: "How can I register for income tax and obtain an NTN?" },
    { id: "return", name: "Income Tax Return", icon: "📑", description: "Tax return filing", question: "How can I file my income tax return?" },
    { id: "taxpayer", name: "Taxpayer Verification", icon: "🔎", description: "Verify taxpayer status", question: "How can I verify my taxpayer status?" },
    { id: "atl", name: "Active Taxpayer List", icon: "📋", description: "ATL / filer status", question: "How can I check my Active Taxpayer List status?" },
    { id: "iris", name: "FBR IRIS", icon: "💻", description: "FBR online portal", question: "What services are available through FBR IRIS?" },
  ]},
  { id: "domicile", name: "Domicile", urdu: "ڈومیسائل", icon: "📍", description: "Domicile and permanent residence", services: [
    { id: "new", name: "New Domicile", icon: "📍", description: "Apply for domicile", question: "How can I apply for a domicile certificate?" },
    { id: "documents", name: "Required Documents", icon: "📄", description: "Domicile documents", question: "What documents are required for domicile?" },
    { id: "fee", name: "Domicile Fee", icon: "💰", description: "Fees and charges", question: "What is the domicile fee?" },
    { id: "verification", name: "Domicile Verification", icon: "🔎", description: "Verify domicile", question: "How can I verify a domicile certificate?" },
    { id: "status", name: "Application Status", icon: "📊", description: "Check application status", question: "How can I check my domicile application status?" },
  ]},
  { id: "jobs", name: "Government Jobs", urdu: "سرکاری ملازمتیں", icon: "💼", description: "Official government recruitment", services: [
    { id: "federal", name: "Federal Government Jobs", icon: "🇵🇰", description: "Federal vacancies", question: "Where can I find official federal government jobs?" },
    { id: "provincial", name: "Provincial Government Jobs", icon: "🏛️", description: "Provincial vacancies", question: "Where can I find official provincial government jobs?" },
    { id: "application", name: "How to Apply", icon: "📝", description: "Application guidance", question: "How can I apply for a government job?" },
  ]},
];

export default function Home() {
  const [language, setLanguage] = useState<"English" | "Urdu">("English");
  const [department, setDepartment] = useState<Department | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const isUrdu = language === "Urdu";
  const suggestions = useMemo(() => service ? [service.question, "What documents are required?", "What is the fee?", "What is the processing time?"] : [], [service]);

  const goHome = () => { setDepartment(null); setService(null); setAnswer(null); setQuestion(""); };
  const goDepartment = () => { setService(null); setAnswer(null); setQuestion(""); };
  const ask = async () => {
    if (!question.trim() || !service) return;
    setLoading(true); setAnswer(null);
    try {
      const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: question.trim(), service: service.name, language, department: department?.name }) });
      const data = await res.json();
      setAnswer(data);
    } catch {
      setAnswer({ error: "Unable to connect to the verified information service. Please try again." });
    } finally { setLoading(false); }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="Home"><span className="flag">🇵🇰</span><span><strong>Pakistan Citizen Helper</strong><small>Verified government information</small></span></button>
        <div className="top-actions"><button className={`lang ${!isUrdu ? "active" : ""}`} onClick={() => setLanguage("English")}>English</button><button className={`lang ${isUrdu ? "active" : ""}`} onClick={() => setLanguage("Urdu")}>اردو</button></div>
      </header>

      <section className="content">
        {!department && !service && (
          <>
            <section className="hero"><div className="hero-badge">🇵🇰 Pakistan</div><h1>{isUrdu ? "سرکاری خدمات، آسان طریقے سے" : "Government services, made easier."}</h1><p>{isUrdu ? "مصدقہ سرکاری معلومات تلاش کریں، سوال پوچھیں اور متعلقہ سرکاری ذریعہ دیکھیں۔" : "Find verified government information, ask a question, and see the official source."}</p></section>
            <div className="welcome"><div><span className="eyebrow">WELCOME, RAEES KHAN</span><h2>{isUrdu ? "آپ کو کس سروس کی معلومات چاہیے؟" : "What government service do you need?"}</h2></div><span className="shield">✓</span></div>
            <div className="section-head"><div><h2>{isUrdu ? "محکمے" : "Government departments"}</h2><p>{isUrdu ? "محکمہ منتخب کریں" : "Select a department to continue"}</p></div><span>{departments.length}</span></div>
            <div className="department-grid">{departments.map(d => <button key={d.id} className="department-card" onClick={() => setDepartment(d)}><span className="card-icon">{d.icon}</span><span className="card-text"><strong>{isUrdu ? d.urdu : d.name}</strong><small>{d.description}</small></span><span className="arrow">›</span></button>)}</div>
          </>
        )}

        {department && !service && (
          <section className="view"><button className="back" onClick={goHome}>← {isUrdu ? "محکموں پر واپس" : "All departments"}</button><div className="view-title"><span className="big-icon">{department.icon}</span><div><div className="eyebrow">DEPARTMENT</div><h1>{isUrdu ? department.urdu : department.name}</h1><p>{department.description}</p></div></div><div className="service-grid">{department.services.map(s => <button key={s.id} className="service-card" onClick={() => { setService(s); setQuestion(""); setAnswer(null); }}><span className="service-icon">{s.icon}</span><span><strong>{s.name}</strong><small>{s.description}</small></span><span className="arrow">›</span></button>)}</div></section>
        )}

        {department && service && (
          <section className="view question-view">
            <button className="back" onClick={goDepartment}>← {isUrdu ? "سروسز پر واپس" : "Back to services"}</button>
            <div className="service-banner"><span>{service.icon}</span><div><div className="eyebrow">{department.name}</div><h1>{service.name}</h1></div></div>
            {!answer && <><div className="question-card"><label>{isUrdu ? "اپنا سوال لکھیں" : "What would you like to know?"}</label><textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder={isUrdu ? "مثلاً: فیس کتنی ہے؟ کون سے کاغذات درکار ہیں؟" : "For example: What is the fee? What documents are required?"} rows={5} /><button className="primary" onClick={ask} disabled={loading || !question.trim()}>{loading ? "Checking verified information…" : isUrdu ? "مصدقہ جواب حاصل کریں" : "Get verified answer"}</button></div><div className="suggestions"><span>{isUrdu ? "عام سوالات" : "Common questions"}</span>{suggestions.map((q,i) => <button key={i} onClick={() => setQuestion(q)}>{q}</button>)}</div></>}
            {answer && <div className="answer-area"><div className="answer-card">{answer.error ? <><div className="status-icon warning">!</div><h2>{isUrdu ? "معلومات دستیاب نہیں" : "Information unavailable"}</h2><p>{answer.error}</p></> : <><div className="status-icon">✓</div><div className="verified-label">VERIFIED INFORMATION</div><div className="answer-text">{answer.answer}</div></>} </div>{answer.source && <div className="source-card"><div><span className="source-icon">✓</span><div><strong>{answer.source.title || "Official government source"}</strong><small>{answer.source.department || department.name}{answer.source.lastVerified ? ` · Verified ${answer.source.lastVerified}` : ""}</small></div></div>{answer.source.url && <a href={answer.source.url} target="_blank" rel="noreferrer">Visit official source ↗</a>}</div>}<button className="secondary" onClick={() => { setAnswer(null); setQuestion(""); }}>Ask another question</button></div>}
          </section>
        )}
      </section>
      <footer>Developed by <strong>Raees Khan</strong> · Assistant Director, NADRA</footer>
    </main>
  );
}
