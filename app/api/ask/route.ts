import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = "openai/gpt-oss-120b";

type VerifiedRecord = {
  id?: number;
  service_name?: string | null;
  category?: string | null;
  title?: string | null;
  content?: string | null;
  service_name_urdu?: string | null;
  province?: string | null;
  title_urdu?: string | null;
  content_urdu?: string | null;
  official_department?: string | null;
  official_source_title?: string | null;
  official_source_url?: string | null;
  last_verified?: string | null;
  active?: boolean | null;
};

function normalize(v: unknown): string {
  return String(v ?? "").toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim();
}

function isUrdu(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

const STOP = new Set(["the","is","are","was","were","how","what","where","when","which","can","may","for","from","with","about","please","tell","me","give","get","my","i","do","does","a","an","of","to","in","on","and","or","کے","کی","کا","کو","میں","سے","اور","ہے","ہیں","کیا","کہاں","کیسے","مجھے","لیے","بارے","میرا","میری"]);

const TOPICS: Record<string,string[]> = {
  age_dob:["age","date of birth","dob","birth date","year of birth","عمر","تاریخ پیدائش","پیدائش کی تاریخ"],
  name:["full name","name","نام"],
  father_name:["father name","father's name","fathers name","father","والد کا نام","والد"],
  mother_name:["mother name","mother's name","mothers name","mother","والدہ کا نام","والدہ"],
  address:["address","residential address","پتہ","رہائشی پتہ"],
  fee:["fee","fees","cost","charges","price","فیس","چارجز"],
  processing_time:["processing time","how long","working days","delivery time","processing","کتنے دن","کتنا وقت","مدت","پروسیسنگ"],
  documents:["documents","document","required documents","requirements","papers","کاغذات","دستاویزات","ضروری دستاویزات"],
  procedure:["procedure","process","apply","application","how to","طریقہ","درخواست"],
  eligibility:["eligible","eligibility","who can","اہلیت","کون درخواست دے سکتا"],
  online:["online","pakid","app","website","آن لائن","پاک آئی ڈی"],
  office:["office","center","centre","location","کہاں","دفتر","مرکز"],
  renewal:["renew","renewal","تجدید"],
  lost:["lost","stolen","damaged","گم","چوری","خراب"],
  status:["status","track","tracking","اسٹیٹس","ٹریک"]
};

const SERVICES: Record<string,string[]> = {
  "CNIC / NADRA":["cnic","nic","identity card","nadra","شناختی کارڈ","نادرا"],
  "Passport":["passport","پاسپورٹ"],
  "Driving Licence":["driving licence","driving license","driving","license","licence","ڈرائیونگ لائسنس","لائسنس"],
  "Domicile":["domicile","ڈومیسائل"],
  "Scholarships":["scholarship","scholarships","stipend","financial aid","وظیفہ","اسکالرشپ"],
  "Protector of Emigrants":["protector","protector of emigrants","emigration","emigrant","overseas employment","work visa","employment visa","پروٹیکٹر","ایمیگریشن","بیرون ملک ملازمت"],
  "Other Services":["birth certificate","death certificate","marriage certificate","divorce certificate","police verification","vehicle registration","token tax","income tax","fbr","tax","crc","form b","fard","پیدائش","وفات","شادی","طلاق","پولیس ویریفکیشن","گاڑی رجسٹریشن","ٹیکس"]
};

function detectTopic(q:string):string|null {
  const text=normalize(q); let best:string|null=null; let score=0;
  for(const [topic,aliases] of Object.entries(TOPICS)) { let s=0; for(const a of aliases) if(text.includes(normalize(a))) s += a.length>=8?12:7; if(s>score){score=s;best=topic;} }
  return score>=7?best:null;
}

function detectService(q:string, requested:string):string|null {
  const text=normalize(q); let best=requested||null; let score=requested?5:0;
  for(const [service,aliases] of Object.entries(SERVICES)) { let s=0; for(const a of aliases) if(text.includes(normalize(a))) s += a.length>=8?15:10; if(s>score){score=s;best=service;} }
  return best;
}

function detectJurisdiction(q:string):string|null {
  const text=normalize(q);
  const data: Array<[string,string[]]> = [
    ["Punjab",["punjab","پنجاب"]],["Sindh",["sindh","sind","سندھ"]],["Khyber Pakhtunkhwa",["khyber pakhtunkhwa","kpk","kp","خیبر پختونخوا","خیبرپختونخوا"]],["Islamabad Capital Territory",["islamabad","ict","اسلام آباد","اسلامباد"]],["Balochistan",["balochistan","بلوچستان"]],["Azad Jammu and Kashmir",["ajk","azad kashmir","آزاد کشمیر","آزاد جموں و کشمیر"]],["Gilgit-Baltistan",["gilgit","gilgit baltistan","گلگت","گلگت بلتستان"]]
  ];
  for(const [name,terms] of data) for(const t of terms) if(text.includes(normalize(t))) return name;
  return null;
}

function topicScore(topic:string|null,r:VerifiedRecord):number {
  if(!topic)return 0;
  const title=normalize(r.title), cat=normalize(r.category), content=normalize(`${r.content||""} ${r.content_urdu||""}`); let s=0;
  for(const a of TOPICS[topic]||[]){const x=normalize(a);if(title.includes(x))s+=30;else if(cat.includes(x))s+=20;else if(content.includes(x))s+=8;}
  return s;
}

function generalScore(q:string,r:VerifiedRecord):number {
  const text=normalize(`${r.category||""} ${r.title||""} ${r.content||""} ${r.content_urdu||""}`), title=normalize(r.title); let s=0;
  for(const token of normalize(q).split(/\s+/).filter(x=>x.length>=2&&!STOP.has(x))){if(text.includes(token))s+=2;if(title.includes(token))s+=6;}
  return s;
}

function serviceMatch(r:VerifiedRecord,service:string):boolean {
  const db=normalize(r.service_name), wanted=normalize(service); if(!db)return false;
  if(db===wanted||db.includes(wanted)||wanted.includes(db))return true;
  return (SERVICES[service]||[]).some(a=>db.includes(normalize(a)));
}

function selectRecords(q:string,requested:string,records:VerifiedRecord[]) {
  const topic=detectTopic(q), service=detectService(q,requested), jurisdiction=detectJurisdiction(q); let work=[...records];
  if(service){const x=work.filter(r=>serviceMatch(r,service));if(x.length)work=x;}
  if(jurisdiction){const j=normalize(jurisdiction);const x=work.filter(r=>{const p=normalize(r.province);return p==="pakistan"||p.includes(j)||j.includes(p);});if(x.length)work=x;}
  const scored=work.map(r=>({r,s:topicScore(topic,r)*10+generalScore(q,r)})).sort((a,b)=>b.s-a.s);
  const topicMatches=topic?scored.filter(x=>topicScore(topic,x.r)>0):[];
  return {records:(topicMatches.length?topicMatches:scored).slice(0,8).map(x=>x.r),topic,service,jurisdiction};
}

function context(records:VerifiedRecord[],language:"English"|"Urdu"):string {
  return records.map((r,i)=>`RECORD ${i+1}\nService: ${language==="Urdu"?(r.service_name_urdu||r.service_name||""):(r.service_name||"")}\nCategory: ${r.category||""}\nJurisdiction: ${r.province||""}\nTitle: ${language==="Urdu"?(r.title_urdu||r.title||""):(r.title||"")}\nVerified Information: ${language==="Urdu"?(r.content_urdu||r.content||""):(r.content||r.content_urdu||"")}\nOfficial Department: ${r.official_department||""}\nOfficial Source: ${r.official_source_title||""}\nOfficial URL: ${r.official_source_url||""}\nLast Verified: ${r.last_verified||""}`).join("\n\n");
}

function noInfo(language:"English"|"Urdu"){return language==="Urdu"?"معذرت، اس مخصوص سوال کے لیے ہمارے تصدیق شدہ سرکاری ریکارڈ میں کافی معلومات موجود نہیں ہیں۔":"Sorry, sufficient verified government information is not currently available for this specific question.";}

function ageProcedureAnswer(language:"English"|"Urdu"):string {
  if(language==="Urdu") {
    return "نادرا کی سرکاری CNIC معلومات میں **Update / Modify** سروس موجود ہے، اور اسی صفحے پر CNIC میں غلط تاریخِ پیدائش کی صورت میں طریقہ کار سے متعلق مخصوص FAQ بھی درج ہے۔ ہمارے موجودہ verified database میں اس FAQ کا مکمل جواب/تفصیلی مرحلہ وار طریقہ محفوظ نہیں ہے، اس لیے میں کوئی غیر مصدقہ طریقہ یا مطلوبہ دستاویزات نہیں گھڑوں گا۔\n\nالبتہ نادرا کے موجودہ سرکاری Fee Structure میں Age Modification کی الگ فیس درج ہے:\n• ایک سال تک: Rs. 1,000\n• ایک سال سے زیادہ اور دو سال تک: Rs. 2,000\n• دو سال سے زیادہ اور تین سال تک: Rs. 3,000\n• تین سال سے زیادہ: Rs. 5,000\n• دوسری مرتبہ عمر کی تبدیلی: Rs. 10,000";
  }
  return "NADRA's official CNIC page provides an **Update / Modify** service and lists a specific FAQ for a citizen who identifies an incorrect date of birth on the CNIC. Our current verified database does not yet contain the full answer to that FAQ or a sufficiently detailed step-by-step procedure, so I will not invent the required procedure or documents.\n\nThe current official NADRA Fee Structure does provide the separate Age Modification fees:\n• Up to 1 year: Rs. 1,000\n• More than 1 year and up to 2 years: Rs. 2,000\n• More than 2 years and up to 3 years: Rs. 3,000\n• More than 3 years: Rs. 5,000\n• Second-time age change: Rs. 10,000";
}

export async function POST(request:NextRequest){
  try{
    if(!SUPABASE_URL||!SUPABASE_ANON_KEY||!GROQ_API_KEY)return NextResponse.json({error:"Server configuration is incomplete. Check the Vercel environment variables."},{status:500});
    const body=await request.json(); const question=String(body.question??"").trim(); const requested=String(body.service??"").trim(); const langInput=String(body.language??"").trim();
    if(!question)return NextResponse.json({error:"Please enter a question."},{status:400});
    const language: "English"|"Urdu" = langInput.toLowerCase()==="urdu"||isUrdu(question)?"Urdu":"English";

    const url=`${SUPABASE_URL}/rest/v1/verified_information?select=id,service_name,category,title,content,service_name_urdu,province,title_urdu,content_urdu,official_department,official_source_title,official_source_url,last_verified,active&active=eq.true&order=last_verified.desc`;
    const db=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`},cache:"no-store"});
    if(!db.ok){console.error(await db.text());return NextResponse.json({error:"Unable to retrieve verified information from Supabase."},{status:500});}

    const all=(await db.json()) as VerifiedRecord[];
    if(!all.length)return NextResponse.json({answer:noInfo(language),source:null});

    const selected=selectRecords(question,requested,all);
    if(!selected.records.length)return NextResponse.json({answer:noInfo(language),source:null});

    const sourceRecord=selected.records.find(r=>r.official_source_url)||selected.records[0];
    const source={department:sourceRecord.official_department||"",title:sourceRecord.official_source_title||sourceRecord.title||"Official Government Source",url:sourceRecord.official_source_url||"",lastVerified:sourceRecord.last_verified||"",province:sourceRecord.province||""};

    // The UI sends "CNIC Modification", while the database uses "CNIC / NADRA".
    // Therefore use both the selected service and the actual selected records when
    // deciding whether this is the high-value age/DOB case.
    const isCnicAgeQuestion = selected.topic==="age_dob" &&
      (normalize(selected.service).includes("cnic") || normalize(requested).includes("cnic") ||
       selected.records.some(r=>normalize(r.service_name).includes("cnic")));

    if(isCnicAgeQuestion && !normalize(question).includes("fee") && !normalize(question).includes("fees")) {
      return NextResponse.json({answer:ageProcedureAnswer(language),source});
    }

    const system=`You are Pakistan Citizen Helper. Answer ONLY from the VERIFIED RECORDS below. Never invent or guess facts. Use the actual information contained in the records. Keep the answer focused on the exact question. Detected topic: ${selected.topic||"general"}. If the question asks for a procedure and the record contains a procedure, explain that procedure clearly. If the question asks for a fee and the record contains fees, give the applicable fees. If the exact requested detail is absent, say so clearly. Never claim a fee is unavailable if a supplied record contains a fee. If the question is about age/date of birth, prioritize the Age / Date of Birth record over a generic CNIC record. Use simple Pakistani Urdu when language is Urdu.\n\nVERIFIED RECORDS:\n${context(selected.records,language)}`;

    const ai=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${GROQ_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:GROQ_MODEL,temperature:0,max_tokens:1200,messages:[{role:"system",content:system},{role:"user",content:`Question: ${question}\nSelected service: ${selected.service||requested||"not specified"}\nJurisdiction: ${selected.jurisdiction||"not specified"}\nLanguage: ${language}`}]})});
    if(!ai.ok){console.error(await ai.text());return NextResponse.json({error:"AI service is temporarily unavailable. Please try again."},{status:500});}

    const data=await ai.json();
    const answer=data?.choices?.[0]?.message?.content?.trim()||noInfo(language);
    return NextResponse.json({answer,source});
  }catch(error){
    console.error("API /api/ask error:",error);
    return NextResponse.json({error:"An unexpected error occurred. Please try again."},{status:500});
  }
}
