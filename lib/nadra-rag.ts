const ENGLISH_METADATA_URL = "https://raw.githubusercontent.com/Raeeskhan37/NADRA-Policy-Assistant/main/nadra_registration_policy_metadata.json";
const ENGLISH_CONFIG_URL = "https://raw.githubusercontent.com/Raeeskhan37/NADRA-Policy-Assistant/main/nadra_registration_policy_config.json";
const URDU_TEXT_URL = "https://raw.githubusercontent.com/Raeeskhan37/NADRA-Policy-Assistant/main/urdu/nadra_urdu_6_0_2_v2_clean.txt";

type EnglishChunk = {
  faiss_index?: number;
  chunk_id?: string;
  page?: number;
  major_section?: string;
  subsection?: string;
  text?: string;
};

type PolicyConfig = {
  document?: {
    organization?: string;
    document?: string;
    version?: string;
    identifier?: string;
    status?: string;
    issue_date?: string;
    effective_date?: string;
    total_pages?: number;
  };
};

let englishCache: EnglishChunk[] | null = null;
let policyConfigCache: PolicyConfig | null = null;
let urduCache: string[] | null = null;
let urduRawCache: string | null = null;

const URDU_ALIASES = ["شناختی کارڈ","شناختی","نیا شناختی","نئے شناختی","کاغذات","دستاویزات","ضروری","والد","والدین","خون","رشتہ دار","پیدائش","بائیومیٹرک","گواہ","سرٹیفکیٹ","یونین کونسل","شہریت"];

const STOP = new Set([
  "the","is","are","was","were","how","what","where","when","which","can","could",
  "for","from","with","about","please","tell","me","give","get","my","i","do","does",
  "a","an","of","to","in","on","and","or","this","that",
  "ہے","ہیں","کیا","کہاں","کیسے","مجھے","کے","کی","کا","کو","میں","سے","اور"
]);

function normalize(text: string) {
  return text.toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();
}

function terms(question: string) {
  return normalize(question)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function qnSafe(question: string, alias: string) { return normalize(question).includes(normalize(alias)); }

function score(text: string, queryTerms: string[]) {
  const n = normalize(text);
  let value = 0;

  for (const term of queryTerms) {
    if (n.includes(term)) {
      value += term.length >= 6 ? 4 : 2;
    }
  }

  return value;
}

async function getPolicyConfig(): Promise<PolicyConfig> {
  if (policyConfigCache) return policyConfigCache;

  const res = await fetch(ENGLISH_CONFIG_URL, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error("Unable to load NADRA policy configuration.");
  }

  policyConfigCache = await res.json();
  return policyConfigCache!;
}

async function getEnglishChunks(): Promise<EnglishChunk[]> {
  if (englishCache) return englishCache;

  const res = await fetch(ENGLISH_METADATA_URL, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error("Unable to load NADRA policy metadata.");
  }

  const data = await res.json();
  englishCache = Array.isArray(data)
    ? data
    : Array.isArray(data?.chunks)
      ? data.chunks
      : [];

  return englishCache!;
}

async function getUrduText(): Promise<string> {
  if (urduRawCache) return urduRawCache;

  const res = await fetch(URDU_TEXT_URL, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error("Unable to load NADRA Urdu policy text.");
  }

  urduRawCache = await res.text();
  return urduRawCache;
}

async function getUrduChunks(): Promise<string[]> {
  if (urduCache) return urduCache;

  const text = await getUrduText();
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  const size = 750;
  const overlap = 100;

  for (let i = 0; i < words.length; i += size - overlap) {
    const chunk = words.slice(i, i + size).join(" ").trim();
    if (chunk) chunks.push(chunk);
  }

  urduCache = chunks;
  return chunks;
}

function isAdultFreshCnicQuestion(question: string) {
  const q = normalize(question);

  const cnic =
    q.includes("cnic") ||
    q.includes("smart cnic") ||
    q.includes("national identity card") ||
    q.includes("identity card") ||
    q.includes("شناختی");

  const fresh =
    /\bfresh\b|\bnew\b|\bregistration\b|\bfirst[- ]?time\b/.test(q) ||
    q.includes("new registration") ||
    q.includes("نیا") ||
    q.includes("نئے") ||
    q.includes("اندراج");

  const adult =
    /\b18\b|18\+|\badult\b|above 18|18 years or above|18 years and above/.test(q) ||
    q.includes("اٹھارہ") ||
    q.includes("بالغ");

  const docs =
    /\bdocument(s)?\b|\brequirement(s)?\b|\brequired\b/.test(q) ||
    q.includes("what documents") ||
    q.includes("documents required") ||
    q.includes("دستاویز") ||
    q.includes("کاغذات") ||
    q.includes("تقاضا");

  return cnic && fresh && adult && docs;
}

function getTargetedEnglishAdultCnicChunks(chunks: EnglishChunk[]) {
  const exact = chunks.filter((item) => {
    const haystack = normalize(
      [item.chunk_id, item.subsection, item.major_section, item.text].filter(Boolean).join(" ")
    );

    return (
      /requirements.*fresh.*new registration.*18 years or above/.test(haystack) ||
      /fresh.*new registration.*18 years or above.*cnic/.test(haystack) ||
      item.chunk_id === "CHUNK-0015"
    );
  });

  const fallback = chunks.filter((item) => {
    const haystack = normalize(
      [item.subsection, item.major_section, item.text].filter(Boolean).join(" ")
    );

    return (
      /fresh.*new registration/.test(haystack) &&
      /18 years or above/.test(haystack) &&
      /cnic|smart cnic/.test(haystack)
    );
  });

  return exact
    .concat(fallback)
    .filter((item, index, arr) =>
      arr.findIndex((x) => x.chunk_id === item.chunk_id && x.text === item.text) === index
    )
    .slice(0, 2);
}

function getTargetedUrduAdultCnicEvidence(text: string) {
  const markers = [
    "اٹھارہ سال اور اس سے زائد عمر کے شہریو ں کا اندارج",
    "اٹھارہ سال اور اس سے زائد عمر کے شہریوں کا اندارج"
  ];

  let start = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index >= 0 && (start < 0 || index < start)) start = index;
  }

  if (start < 0) return "";

  const end = Math.min(text.length, start + 9000);
  return text.slice(start, end).trim();
}

function expandQuestion(question: string) {
  const q = normalize(question);
  const additions: string[] = [];

  if (
    /\b(crc|b-form|b form)\b/.test(q) ||
    q.includes("child registration") ||
    q.includes("ب فارم") ||
    q.includes("چائلڈ رجسٹریشن")
  ) {
    additions.push(
      "CRC Child Registration Certificate B-Form child registration minor under 18 juvenile requirements documents birth certificate"
    );
  }

  if (q.includes("cnic") || q.includes("شناختی")) {
    additions.push("CNIC Smart CNIC new registration renewal modification reprint");
  }

  if (q.includes("fee") || q.includes("فیس")) {
    additions.push("fee fees charges schedule");
  }

  if (
    q.includes("document") ||
    q.includes("دستاویز") ||
    q.includes("کاغذات")
  ) {
    additions.push("required documents requirements");
  }

  return question + " " + additions.join(" ");
}


function nadraQ(question: string, patterns: RegExp[]): boolean { return patterns.some((p) => p.test(normalize(question))); }
function nadraField(question: string): string | null {
  const q=normalize(question);
  if(/date of birth|dob|birth date|age|تاریخ پیدائش|عمر/.test(q)) return "Date of Birth";
  if(/address|residential address|پتہ|رہائشی پتہ/.test(q)) return "Address";
  if(/father.?s? name|father name|والد/.test(q)) return "Father's Name";
  if(/mother.?s? name|mother name|والدہ/.test(q)) return "Mother's Name";
  if(/name|نام/.test(q)) return "Name";
  if(/marital|marriage|divorce|widow|marital status|ازدواجی|شادی|طلاق|بیوہ/.test(q)) return "Marital Status";
  if(/religion|مذہب/.test(q)) return "Religion";
  if(/gender|جنس/.test(q)) return "Gender";
  if(/place of birth|birthplace|مقام پیدائش/.test(q)) return "Place of Birth";
  return null;
}
export async function getDirectNadraAnswer(question: string, language: "English"|"Urdu"): Promise<string|null> {
  const q=normalize(question);
  const hasCnic=/cnic|smart cnic|smart nic|snic|شناختی کارڈ|شناختی/.test(q);
  const hasCrc=/\bcrc\b|b-form|b form|child registration|juvenile|چائلڈ رجسٹریشن|ب فارم|جووینائل/.test(q);
  const hasNicop=/\bnicop\b|smart nicop/.test(q);
  const hasPoc=/\bpoc\b|pakistan origin card|pakistani origin card|پاکستان اوریجن کارڈ/.test(q);
  const isModify=/modify|modification|change|correct|correction|update|revise|alter|تبدیل|ترمیم|درست|تصحیح/.test(q);
  const isDocs=/document|documents|requirement|requirements|required|کاغذات|دستاویز|تقاضے/.test(q);
  const isApply=/apply|application|how to|obtain|get|register|registration|درخواست|حاصل|بنوانے|رجسٹریشن|اندراج/.test(q);
  const isLost=/lost|stolen|damaged|duplicate|reprint|replacement|گم|چوری|خراب|ڈپلیکیٹ|دوبارہ/.test(q);
  const out=(title:string,body:string)=> language==="Urdu" ? "## "+title+"\n\n"+body+"\n\n**پالیسی:** NADRA Registration Policy RP-6.0.2 — مؤثر 21 ستمبر 2026۔" : "## "+title+"\n\n"+body+"\n\n**Policy:** NADRA Registration Policy RP-6.0.2 — effective 21 September 2026.";
  try {
    const chunks=await getEnglishChunks();
    const byId=(id:string)=>chunks.find(x=>x.chunk_id===id)?.text||"";
    if(hasCnic && isModify && nadraQ(question,[/date of birth|dob|birth date|age|تاریخ پیدائش|عمر/])) {
      const body=language==="Urdu" ? "**تاریخِ پیدائش کی تبدیلی:**\n\n1. درخواست گزار کی درخواست ضروری ہے۔\n2. اگر تبدیلی **5 سال تک** ہے تو verified computerized Birth Certificate (UC / Municipal Committee / Cantonment) یا پالیسی میں درج قابلِ اطلاق سرکاری ثبوت، مثلاً Matric/Equivalent، 9th/10th marksheet، valid Pakistani/foreign passport، verified government/semi-government service record with NOC، registered marriage certificate، SLC یا verified Domicile/Local Certificate درکار ہو سکتا ہے۔\n3. **5 سال سے زیادہ** کی تبدیلی کے لیے بنیادی دستاویزی تقاضوں کے ساتھ DG Ops / HOD IOOD یا Regional DG approval درکار ہے۔\n4. اگر Birth Certificate NADRA/CRMS میں موجود ہے تو پہلے Birth Certificate درست کرنا ہوگا۔\n5. دوسری مرتبہ age change بھی Birth Certificate کی بنیاد پر، متعلقہ approval کے ساتھ ممکن ہے۔\n6. 10 سال یا اس سے زیادہ کی غیر معمولی age change کے لیے DG approval اور وجہ/دستاویزات درکار ہو سکتی ہیں۔" : "**Date of birth change:**\n\n1. Submit an application.\n2. For a change of **up to 5 years**, provide a verified computerized Birth Certificate from the UC / Municipal Committee / Cantonment or an applicable government-issued proof listed in the policy, such as Matric/Equivalent, 9th/10th marksheet, valid Pakistani/foreign passport, verified government/semi-government service record with NOC, registered marriage certificate, SLC or verified domicile/local certificate.\n3. For a change of **more than 5 years**, the basic documentary requirements plus approval from DG Ops / HOD IOOD or the Regional DG apply.\n4. If a Birth Certificate already exists in NADRA/CRMS, it must be corrected first.\n5. A second age change is allowed where the required verified Birth Certificate is available, subject to the stated approval.\n6. An unrealistic age change of **10 years or more** requires DG approval with reasoning/justification and documents, if any."; return out(language==="Urdu"?"CNIC — تاریخِ پیدائش کی تبدیلی":"CNIC — Change of Date of Birth",body);
    }
    if(hasCnic && isModify && nadraQ(question,[/address|residential address|پتہ|رہائشی پتہ/])) {
      const body=language==="Urdu" ? "**پتے کی تبدیلی:**\n\n1. درخواست گزار کی درخواست۔\n2. عارضی پتے کے لیے self/blood relative/spouse کی ID پر پتہ، computerized electricity/gas/water bill، residential property document، verified Local/Domicile/PRC، notarized affidavit/rent deed یا Society/Government allotment letter جیسے ثبوت policy میں درج ہیں۔\n3. مستقل پتے کے لیے blood relative/spouse کی ID پر وہی پتہ، utility bill، property document، verified Local/Domicile/PRC، کم از کم 3 سال پرانا allotment letter، یا house owner کا affidavit بمع ID/property document جیسے ثبوت درج ہیں۔\n4. Non-resident applicants کے لیے applicable passport/residence/work permit/travel document یا attested Undertaking A کا تقاضا ہے۔\n5. **Foreign address change کے لیے کوئی document required نہیں۔**" : "**Address change:**\n\n1. Submit an application.\n2. For a **temporary address**, the policy lists evidence such as the self/blood-relative/spouse ID showing the address, a computerized electricity/gas/water bill, residential property document, verified Local/Domicile/PRC, notarized affidavit/rent deed, or Society/Government allotment letter.\n3. For a **permanent address**, the policy lists evidence such as a blood-relative/spouse ID with the same address, utility bill, residential property document, verified Local/Domicile/PRC, a Society/Government allotment letter allotted at least 3 years earlier, or an affidavit with the house owner's ID and original property document.\n4. Non-resident applicants have the applicable passport/residence/work permit/travel document or attested Undertaking A requirement.\n5. **No document is required for changing a foreign address.**"; return out(language==="Urdu"?"CNIC — پتے کی تبدیلی":"CNIC — Change of Address",body);
    }
    if((hasCnic||/smart card/.test(q)) && isApply && /smart cnic|smart nic|smart card|snic/.test(q)) {
      const body=language==="Urdu" ? "**18 سال یا اس سے زیادہ:** fresh registration میں National Identity Card **CNIC یا SMART CNIC** کی شکل میں جاری ہو سکتا ہے۔ پہلے normal CNIC بنوانا لازم نہیں۔\n\n**18 سال سے کم:** CNIC جاری نہیں ہوتا، لیکن **CRC یا Juvenile Card** کا راستہ موجود ہے۔ CRC holder کے لیے Juvenile Card / SNIC conversion بھی policy میں موجود ہے؛ پہلے adult CNIC بنوانا ضروری نہیں۔" : "**Age 18 or above:** Fresh registration issues the National Identity Card in the form of **CNIC or SMART CNIC**. A first-time applicant does not have to obtain a normal CNIC first.\n\n**Under 18:** A CNIC is not issued to a minor, but **CRC or Juvenile Card** options exist. The policy also provides conversion from CRC to Juvenile Card / SNIC, so a CRC holder does not need an adult CNIC first."; return out(language==="Urdu"?"SMART CNIC / Juvenile Card — درست طریقہ":"SMART CNIC / Juvenile Card — Correct Application Path",body);
    }
    if((hasCnic||hasNicop||hasCrc) && isLost) {
      const body=language==="Urdu" ? "**Resident applicant:**\n1. درخواست۔\n2. CNIC/NICOP/CRC/Juvenile Card number۔\n3. **کوئی دوسرا document required نہیں** اور attestation required نہیں۔\n4. اگر اصل card گم ہے اور available نہیں تو **system-generated undertaking with signature** جمع کی جاتی ہے۔\n5. Applicable biometrics capture/update کیے جاتے ہیں۔\n\nاصل گم شدہ card کو punch کرنا ممکن نہیں؛ policy اسی صورت میں undertaking دیتی ہے جب original available نہ ہو۔" : "**Resident applicant:**\n1. Submit the application.\n2. Provide the CNIC/NICOP/CRC/Juvenile Card number.\n3. **No other document is required** and attestation is not required.\n4. If the original card is unavailable because it was lost, submit the **system-generated undertaking with signature**.\n5. Applicable biometrics are captured/updated.\n\nA lost original cannot be punched and returned; the policy specifically provides the undertaking when the original is unavailable."; return out(language==="Urdu"?"گم شدہ CNIC / Smart Card — Reprint":"Lost CNIC / Smart CNIC — Reprint",body);
    }
    if(hasCrc) {
      if(isModify && !/name|نام/.test(q) && !nadraQ(question,[/date of birth|dob|age|address|father|mother|والد|والدہ|پتہ|تاریخ پیدائش/])) return out(language==="Urdu"?"CRC میں ترمیم":"CRC Modification",language==="Urdu"?"آپ CRC میں کس معلومات کو تبدیل کرنا چاہتے ہیں؟ مثلاً بچے کا نام، تاریخِ پیدائش، والد/والدہ کا نام یا پتہ۔ مخصوص field بتائیں۔":"What information do you want to modify on the CRC? For example: the child's name, date of birth, father's/mother's name or address. Tell me the specific field.");
      if(nadraQ(question,[/correct.*name|change.*name|name.*crc|child.?s name|نام.*ب فارم|ب فارم.*نام|نام.*crc/])) { const body=language==="Urdu"?"بچے کے نام کی تبدیلی کے لیے **C1 Undertaking for Name Change — Form-B / Juvenile Card / NICOP (citizens less than 18 years)** موجود ہے۔ مقررہ notarized undertaking میں موجودہ/نیا نام، وجہ، والدین/guardian کی معلومات اور witnesses شامل ہوتے ہیں۔ اگر Birth Certificate NADRA/CRMS میں موجود ہے تو پہلے Birth Certificate میں نام درست کرنا ہوگا۔":"For a child's name change, NADRA policy provides **C1 Undertaking for Name Change — Form-B / Juvenile Card / NICOP (citizens under 18)**. The prescribed notarized undertaking records the old/new name, reason, parent/guardian details and witnesses. If the Birth Certificate exists in NADRA/CRMS, the name must first be corrected in the Birth Certificate."; return out(language==="Urdu"?"CRC / B-Form — بچے کے نام کی تبدیلی":"CRC / B-Form — Child Name Change",body); }
      if(isDocs||isApply) { const body=language==="Urdu"?"**CRC / B-Form کے بنیادی تقاضے:**\n1. والدین میں سے کسی ایک یا guardian کی application، identity-card number کے ساتھ۔\n2. UC / Municipal Committee / Cantonment کا verified computerized Birth Certificate، یا applicable overseas category میں foreign detailed Birth Certificate / S1 Form / Citizenship or Naturalization Certificate۔\n3. Parent/guardian biometric verification جہاں applicable ہو۔\n4. **3 سال سے زیادہ عمر کے minor کی موجودگی لازمی ہے۔**":"**CRC / B-Form requirements:**\n1. Application by one parent or guardian, with the parent/guardian identity-card number.\n2. A verified computerized Birth Certificate from the UC / Municipal Committee / Cantonment, or the applicable foreign detailed Birth Certificate / S1 Form / Citizenship or Naturalization Certificate for the overseas category.\n3. Parent/guardian biometric verification where applicable.\n4. **Presence of a minor above 3 years is mandatory.**"; return out(language==="Urdu"?"CRC / B-Form — Registration / Documents":"CRC / B-Form — Registration / Required Documents",body); }
    }
    if(hasNicop) {
      if(isModify) { const field=nadraField(question); if(!field) return out(language==="Urdu"?"NICOP میں ترمیم":"NICOP Modification",language==="Urdu"?"آپ NICOP میں کس معلومات کو تبدیل کرنا چاہتے ہیں؟ مثلاً نام، تاریخِ پیدائش، والد/والدہ کا نام، پتہ یا marital status۔ مخصوص field بتائیں۔":"What information do you want to modify on the NICOP? For example: name, date of birth, father's/mother's name, address or marital status. Tell me the specific field."); if(field==="Date of Birth"||field==="Address") return getDirectNadraAnswer(question.replace(/NICOP/ig,"CNIC"),language); return out(language==="Urdu"?"NICOP — مخصوص ترمیم":"NICOP — Specific Modification",language==="Urdu"?"آپ نے "+field+" کی تبدیلی پوچھی ہے۔ NADRA identity-document change standards اسی field پر لاگو ہوتے ہیں۔":"You asked to change "+field+". NADRA's identity-document change standards apply to that field."); }
      if(isLost) { const body=language==="Urdu"?"Resident applicant: NICOP number کے ساتھ درخواست دیں؛ اصل card unavailable ہو تو system-generated undertaking with signature استعمال ہوگی۔ Non-resident applicant کے لیے NICOP number کے ساتھ applicable Pakistani/Foreign passport، residence permit، travel document یا attested Undertaking A درکار ہے۔":"Resident applicant: apply with the NICOP number; if the original card is unavailable, the policy provides a system-generated undertaking with signature. Non-resident applicants require the NICOP number plus the applicable Pakistani/foreign passport, residence permit, travel document or attested Undertaking A."; return out(language==="Urdu"?"گم شدہ NICOP — Reprint":"Lost NICOP — Reprint",body); }
      if(isDocs||isApply) { const body=language==="Urdu"?"NICOP/SMART NICOP کے fresh-registration تقاضے عمر اور residency category کے مطابق ہیں۔\n\n**18+ Non-Resident:** application؛ parent/blood-relative ID number یا System Independent case میں two ID holders + Undertaking B؛ foreign detailed/manual Birth Certificate، S1 Form یا Citizenship/Naturalization Certificate؛ Pakistani/foreign passport، residence permit، travel document یا attested Undertaking A؛ اور applicable biometric/attestation۔\n\n**Under 18:** minor کی طرف سے/اس کی جانب سے application، parent/guardian ID number؛ applicable Birth Certificate/S1/Citizenship/Naturalization proof؛ non-resident category میں passport/residence permit/travel document/attested Undertaking A؛ اور parent/guardian biometric verification یا applicable attestation۔":"NICOP/SMART NICOP fresh-registration requirements depend on age and residency category.\n\n**18+ — Non-resident:** application; parent/blood-relative ID number or, for a System Independent case, two ID holders with Undertaking B; foreign detailed/manual Birth Certificate, S1 Form or Citizenship/Naturalization Certificate; Pakistani/foreign passport, residence permit, travel document or attested Undertaking A; and applicable biometric/attestation.\n\n**Under 18:** application by/on behalf of the minor, parent/guardian ID number; applicable Birth Certificate/S1/Citizenship/Naturalization proof; for the non-resident category, passport/residence permit/travel document/attested Undertaking A; and parent/guardian biometric verification or applicable attestation."; return out(language==="Urdu"?"NICOP / SMART NICOP — Documents":"NICOP / SMART NICOP — Required Documents",body); }
    }
    if(hasPoc) {
      if(isModify && !/renew|renewal|reprint|duplicate/.test(q)) return out(language==="Urdu"?"POC میں ترمیم":"POC Modification",language==="Urdu"?"POC میں کس معلومات کو تبدیل کرنا ہے؟ مثلاً نام، تاریخِ پیدائش، nationality، gender، passport number، address یا marital status بتائیں۔":"What information do you want to modify on the POC? For example: name, date of birth, nationality, gender, passport number, address or marital status. Tell me the field.");
      if(/renew|renewal|reprint|duplicate/.test(q)) { const body=language==="Urdu"?"**POC Renewal / Reprint:** application by applicant + POC + valid Foreign Passport؛ spouse-based case میں Undertaking F۔ 2008 سے پہلے کے POC میں additional origin/eligibility documents policy کے مطابق درکار ہو سکتے ہیں۔ Original POC unavailable ہو تو system-generated undertaking with signature کا راستہ موجود ہے۔":"**POC renewal / reprint:** application by applicant + POC + valid Foreign Passport; Undertaking F for spouse-based cases. For POCs issued before 2008, additional origin/eligibility documents may apply under the policy. If the original POC is unavailable, the policy provides a system-generated undertaking with signature."; return out(language==="Urdu"?"POC — Renewal / Reprint":"POC — Renewal / Reprint",body); }
      if(isDocs||isApply) { const body=language==="Urdu"?"POC fresh application category پر منحصر ہے: Ex-Pakistani کے لیے Pakistani-origin proof + valid Foreign Passport؛ Pakistani-origin parent/grandparent/FPO family کے لیے foreign passport + applicant/parent linkage proof + Pakistani-origin relative proof + applicable Undertaking E؛ foreign spouse کے لیے foreign passport + birth certificate + spouse CNIC/NICOP/POC + marriage certificate + Undertaking F؛ foreign-spouse child کے لیے foreign passport + birth certificate with parents' names + parents' marriage certificate + Undertaking H۔":"POC fresh-application requirements depend on category: Ex-Pakistani requires applicable Pakistani-origin proof plus valid Foreign Passport; Pakistani-origin parent/grandparent/FPO family requires foreign passport, applicant/parent linkage proof, Pakistani-origin relative proof and applicable Undertaking E; a foreign spouse requires foreign passport, birth certificate, spouse CNIC/NICOP/POC, marriage certificate and Undertaking F; a foreign-spouse child requires foreign passport, birth certificate with parents' names, parents' marriage certificate and Undertaking H."; return out(language==="Urdu"?"POC — Application / Required Documents":"POC — Application / Required Documents",body); }
    }
    if((hasCnic||hasNicop||hasPoc) && /cancel|cancellation|surrender|renounce|death|وفات|منسوخ|منسوخی|دستبردار|قومیت/.test(q)) { const body=language==="Urdu"?"**وفات کی وجہ سے:** blood relative/spouse درخواست دے سکتا ہے؛ deceased کا original CNIC/NICOP/POC/CRC/Juvenile Card اگر available ہو اور verified computerized Death Certificate درکار ہے۔ CRMS نہ ہونے کی صورت میں manual Death Certificate accepted ہے۔\n\n**شہریت ترک کرنے کی وجہ سے:** applicant کی application، original CNIC/NICOP/CRC/Juvenile Card اگر available ہو، اور applicable surrender/lost proof، single/dual-national-country passport، verified Renunciation Certificate یا Undertaking D کے مطابق evidence درکار ہے۔":"**Due to death:** a blood relative/spouse may apply; the deceased's original CNIC/NICOP/POC/CRC/Juvenile Card, if available, and a verified computerized Death Certificate are required. Where CRMS is unavailable, a manual Death Certificate is accepted.\n\n**Due to nationality surrender/renunciation:** the applicant applies and provides the original CNIC/NICOP/CRC/Juvenile Card if available, plus the applicable surrender/lost proof and the relevant single/dual-national-country passport, verified Renunciation Certificate or Undertaking D evidence."; return out(language==="Urdu"?"NADRA — CNIC / NICOP Cancellation":"NADRA — CNIC / NICOP Cancellation",body); }
    if(nadraQ(question,[/family registration certificate|\bfrc\b|family registration|خاندانی رجسٹریشن/])) { const body=language==="Urdu"?"**FRC:** blood relative، spouse یا guardian application دے سکتا ہے۔ اگر minor کا CRC بغیر photo کے جاری ہوا تھا تو photo capture کے لیے minor کی موجودگی لازمی ہے۔ CRC بغیر biometrics ہو تو FRC کے بعد CRC بھی process ہوگا۔ Pak-ID/DAU میں unregistered family member add کرنے کے لیے متعلقہ option موجود ہے۔ CRC/Juvenile/NICOP under 18 holder FRC کے لیے اسی وقت apply کر سکتا ہے جب اس کے biometrics NADRA کے پاس available ہوں۔":"**FRC:** an application may be made by a blood relative, spouse or guardian. If a minor has a CRC issued without a photo, the minor must be present for photo capture. If the CRC was issued without biometrics, the CRC is also processed after the FRC. The Pak-ID/DAU option is used to add an unregistered family member. A CRC/Juvenile/NICOP under-18 holder can apply for FRC if the required biometrics are available with NADRA."; return out(language==="Urdu"?"Family Registration Certificate (FRC)":"Family Registration Certificate (FRC)",body); }
    if(nadraQ(question,[/family registration information|parent information|parents information|parent details|والدین کی معلومات|والدین کی تفصیلات/])) { const body=language==="Urdu"?"اگر مراد NADRA record میں **والد/والدہ کی معلومات کی correction** ہے تو application، متعلقہ parent کا ID number، اور policy کے مطابق parent/sibling biometric witnesses درکار ہوتے ہیں۔ اگر witness biometrics ممکن نہ ہوں تو attested/notarized undertaking یا irrefutable evidence (مثلاً verified Birth Certificate، old B-Form، old Passport، CNICF یا verified Matric/equivalent) applicable ہو سکتا ہے۔ Parent information correction صرف ایک مرتبہ کی جا سکتی ہے۔ اگر Birth Certificate NADRA/CRMS میں موجود ہے تو پہلے Birth Certificate درست کرنا ہوگا۔ اگر مراد FRC میں family member add/remove کرنا ہے تو وہ الگ process ہے۔":"If you mean **correction of parent information in NADRA records**, the application, relevant parent ID number and the policy's parent/sibling biometric-witness requirements apply. If witness biometrics cannot be captured, an attested/notarized undertaking or applicable irrefutable evidence such as a verified Birth Certificate, old B-Form, old Passport, CNICF or verified Matric/equivalent may be used. Parent-information correction is allowed only once. If a Birth Certificate exists in NADRA/CRMS, it must be corrected first. If you mean adding/removing a family member in FRC, that is a different process."; return out(language==="Urdu"?"NADRA — Parent / Family Information Correction":"NADRA — Parent / Family Information Correction",body); }
    if(nadraQ(question,[/birth[- ]related.*nadra|nadra.*birth.*record|birth record.*nadra|پیدائش.*نادرا|نادرا.*پیدائش/])) { const body=language==="Urdu"?"NADRA policy میں Birth Certificate کو fresh/new registration کا **primary/breeder document** قرار دیا گیا ہے۔ اگر existing NADRA record میں DOB، parent information یا دوسرے particulars بدلنے ہیں اور Birth Certificate NADRA/CRMS میں موجود ہے تو پہلے Birth Certificate درست کرنا ہوگا۔ اگر آپ نیا Birth Certificate بنوانے کی بات کر رہے ہیں تو وہ Union Council / Municipal Committee / Cantonment کی civil-registration service ہے، NADRA CNIC service نہیں۔":"NADRA policy makes the Birth Certificate the **primary/breeder document** for fresh/new registration. If you are changing DOB, parent information or another identity particular and the Birth Certificate exists in NADRA/CRMS, the Birth Certificate must be corrected first. If you mean obtaining a new Birth Certificate, that is a Union Council / Municipal Committee / Cantonment civil-registration service, not a NADRA CNIC service."; return out(language==="Urdu"?"NADRA — Birth Record / Birth Certificate":"NADRA — Birth Record / Birth Certificate",body); }
  } catch(error) { console.error("Direct NADRA resolver failed:",error); }
  return null;
}

export async function getDirectAdultFreshCnicAnswer(
  question: string,
  language: "English" | "Urdu"
): Promise<string | null> {
  if (!isAdultFreshCnicQuestion(question)) return null;

  try {
    if (language === "English") {
      const chunks = await getEnglishChunks();
      const targeted = getTargetedEnglishAdultCnicChunks(chunks);
      const main = targeted[0]?.text || "";
      if (!main) return null;

      return [
        "## New CNIC / Smart CNIC — Fresh Registration (Age 18+)",
        "",
        "According to NADRA Registration Policy RP-6.0.2, the requirements differ depending on whether the resident citizen has a blood relative.",
        "",
        "### Resident citizen — having a blood relative",
        "1. Application by the applicant.",
        "2. Identity card number of the parent(s) or blood relative(s).",
        "3. A verified computerized birth certificate issued by the Union Council, Municipal Committee or Cantonment, **or** the applicable foreign detailed birth certificate / S1 form issued by a Pakistan Embassy or Mission, **or** a Citizenship / Naturalization Certificate.",
        "4. Biometric verification by a parent or sibling (above 18), **or** attestation of the CNICF in accordance with NADRA Regulation 9 (a–h).",
        "",
        "### Resident citizen — having no blood relative",
        "1. Application by the applicant.",
        "2. A verified computerized birth certificate issued by the Union Council, Municipal Committee or Cantonment, **or** a Citizenship / Naturalization Certificate.",
        "3. Biometric witness by two ID holders above 18, together with Affidavit “B” (as per the prescribed format).",
        "4. Attestation of the CNICF in accordance with NADRA Regulation 9 (a–h).",
        "5. Any other document, if applicable.",
        "",
        "**Important:** The no-blood-relative case may require additional verification/scrutiny and more processing time. The policy also specifies a priority order for witnesses.",
        "",
        "**Policy:** NADRA Registration Policy RP-6.0.2 — issued 18 September 2026; effective 21 September 2026.",
        "**Evidence:** Fresh / New Registration of 18 years or above (CNIC or SMART CNIC), page 10, CHUNK-0015."
      ].join("\n");
    }

    const targeted = getTargetedUrduAdultCnicEvidence(await getUrduText());
    if (!targeted) return null;

    return [
      "## نیا شناختی کارڈ / اسمارٹ شناختی کارڈ — 18 سال یا اس سے زائد عمر",
      "",
      "نادرا رجسٹریشن پالیسی RP-6.0.2 کے مطابق اندرونِ ملک مقیم شہری کے لیے تقاضے اس بات کے مطابق مختلف ہیں کہ خون کا رشتہ دار موجود ہے یا نہیں۔",
      "",
      "### خون کے رشتے دار کے ساتھ",
      "1. درخواست گزار کی جانب سے درخواست۔",
      "2. والدین یا خون کے رشتے دار کا شناختی کارڈ نمبر۔",
      "3. یونین کونسل، میونسپل کمیٹی یا کنٹونمنٹ بورڈ سے جاری کردہ تصدیق شدہ کمپیوٹرائزڈ پیدائشی سرٹیفکیٹ، **یا** قابلِ اطلاق غیر ملکی تفصیلی پیدائشی سرٹیفکیٹ / پاکستان سفارت خانہ یا مشن سے جاری کردہ S1 فارم، **یا** شہریت / Naturalization Certificate۔",
      "4. والدین یا 18 سال سے زائد عمر کے بہن/بھائی کی جانب سے بایومیٹرک تصدیق، **یا** نادرا ریگولیشن 9 (A-H) کے مطابق تصدیق کنندہ سے درخواست فارم کی تصدیق۔",
      "",
      "### خون کے رشتے دار کے بغیر",
      "1. درخواست گزار کی جانب سے درخواست۔",
      "2. یونین کونسل، میونسپل کمیٹی یا کنٹونمنٹ بورڈ سے جاری کردہ تصدیق شدہ کمپیوٹرائزڈ پیدائشی سرٹیفکیٹ، **یا** شہریت / Naturalization Certificate۔",
      "3. دو 18 سال سے زائد عمر کے شناختی کارڈ ہولڈرز کی بایومیٹرک گواہی، حلف “B” (نادرا کے وضع کردہ مقررہ فارمیٹ) کے ساتھ۔",
      "4. نادرا ریگولیشن 9 (A-H) کے مطابق درخواست فارم کی تصدیق۔",
      "5. کوئی اور دستاویز، اگر ہو۔",
      "",
      "**اہم نوٹ:** خون کے رشتے دار کے بغیر درخواست میں اضافی تصدیق/جانچ پڑتال اور زیادہ وقت درکار ہو سکتا ہے۔ پالیسی گواہوں کی ترجیح بھی بیان کرتی ہے۔",
      "",
      "**پالیسی:** NADRA Registration Policy RP-6.0.2 — اجرا 18 ستمبر 2026؛ مؤثر 21 ستمبر 2026۔",
      "**ثبوت:** 18 سال یا اس سے زائد عمر کے شہریوں کا نیا اندراج، صفحہ 11، اردو پالیسی متن۔"
    ].join("\n");
  } catch (error) {
    console.error("Direct NADRA adult CNIC answer failed:", error);
    return null;
  }
}

export async function retrieveNadraEvidence(
  question: string,
  language: "English" | "Urdu"
) {
  try {
    const query = expandQuestion(question);
    const config = await getPolicyConfig();
    const policy = config.document || {};

    const effectiveDate =
      policy.effective_date || "21 September 2026";
    const issueDate =
      policy.issue_date || "18 September 2026";

    const queryTerms = terms(query);
    const retrievalTerms = language === "Urdu"
      ? [...queryTerms, ...URDU_ALIASES.filter((x) => qnSafe(question, x))]
      : queryTerms;
    const qn = normalize(question);

    // Policy configuration is authoritative for policy-level metadata questions.
    if (
      /effective date|effective_date|مؤثر ہونے کی تاریخ|نافذ العمل تاریخ|موثر ہونے کی تاریخ/i.test(
        qn
      )
    ) {
      return [
        "SOURCE: NADRA Registration Policy",
        `DOCUMENT: ${policy.document || "Registration Policy"}`,
        `VERSION: ${policy.version || "RP-6.0.2"}`,
        `IDENTIFIER: ${policy.identifier || "NADRA-Reg-Policy-6.0.2"}`,
        `STATUS: ${policy.status || "Approved"}`,
        `ISSUE DATE: ${issueDate}`,
        `EFFECTIVE DATE: ${effectiveDate}`,
        `TOTAL PAGES: ${policy.total_pages || 44}`
      ].join("\n");
    }

    if (language === "Urdu") {
      const chunks = await getUrduChunks();

      if (isAdultFreshCnicQuestion(question)) {
        const targeted = getTargetedUrduAdultCnicEvidence(await getUrduText());
        if (targeted) {
          return [
            "SOURCE: NADRA Registration Policy 6.0.2 (Urdu)",
            "VERSION: RP-6.0.2",
            `ISSUE DATE: \${issueDate}`,
            `EFFECTIVE DATE: \${effectiveDate}`,
            "",
            "[NADRA URDU TARGETED EVIDENCE — FRESH CNIC AGE 18+]",
            targeted
          ].join("\n\n");
        }
      }

      const ranked = chunks
        .map((text, index) => ({
          text,
          index,
          score: score(text, retrievalTerms)
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      if (!ranked.length) return "";

      return [
        "SOURCE: NADRA Registration Policy 6.0.2 (Urdu)",
        "VERSION: RP-6.0.2",
        `ISSUE DATE: \${issueDate}`,
        `EFFECTIVE DATE: \${effectiveDate}`,
        "",
        ...ranked.map(
          (x, i) =>
            `[NADRA URDU EVIDENCE \${i + 1}]\\nChunk: \${x.index + 1}\\nRetrieval score: \${x.score}\\n\\n\${x.text.slice(0, 2400)}`
        )
      ].join("\n\n");
    }

    const chunks = await getEnglishChunks();

    if (isAdultFreshCnicQuestion(question)) {
      const targeted = getTargetedEnglishAdultCnicChunks(chunks);
      if (targeted.length) {
        return [
          "SOURCE: NADRA Registration Policy 6.0.2",
          "VERSION: RP-6.0.2",
          `ISSUE DATE: \${issueDate}`,
          `EFFECTIVE DATE: \${effectiveDate}`,
          "",
          ...targeted.map(
            (item, i) =>
              `[NADRA POLICY TARGETED EVIDENCE \${i + 1}]\\nPage: \${item.page ?? "N/A"}\\nSection: \${item.major_section || item.subsection || ""}\\n\\n\${(item.text || "").slice(0, 4000)}`
          )
        ].join("\n\n");
      }
    }



    const ranked = chunks
      .map((item, index) => ({
        item,
        index,
        score: score(item.text || "", retrievalTerms)
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (!ranked.length) return "";

    return [
      "SOURCE: NADRA Registration Policy 6.0.2",
      "VERSION: RP-6.0.2",
      `ISSUE DATE: ${issueDate}`,
      `EFFECTIVE DATE: ${effectiveDate}`,
      "",
      ...ranked.map(
        (x, i) =>
          `[NADRA POLICY EVIDENCE ${i + 1}]\nPage: ${x.item.page ?? "N/A"}\nSection: ${x.item.major_section || x.item.subsection || ""}\nRetrieval score: ${x.score}\n\n${(x.item.text || "").slice(0, 2400)}`
      )
    ].join("\n\n");
  } catch (error) {
    console.error("NADRA RAG retrieval failed:", error);
    return "";
  }
}
