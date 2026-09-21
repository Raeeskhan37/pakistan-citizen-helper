import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = "openai/gpt-oss-120b";

type VerifiedRecord = {
  id?: number; service_name?: string|null; category?: string|null; title?: string|null; content?: string|null;
  service_name_urdu?: string|null; province?: string|null; title_urdu?: string|null; content_urdu?: string|null;
  official_department?: string|null; official_source_title?: string|null; official_source_url?: string|null;
  last_verified?: string|null; active?: boolean|null;
};

function normalize(v:unknown):string{return String(v??"").toLowerCase().normalize("NFKC").replace(/\s+/g," ").trim();}
function isUrdu(text:string):boolean{return /[\u0600-\u06FF]/.test(text);}

const STOP=new Set(["the","is","are","was","were","how","what","where","when","which","can","may","for","from","with","about","please","tell","me","give","get","my","i","do","does","a","an","of","to","in","on","and","or","کے","کی","کا","کو","میں","سے","اور","ہے","ہیں","کیا","کہاں","کیسے","مجھے","لیے","بارے","میرا","میری"]);
const TOPICS:Record<string,string[]>={
 age_dob:["age","date of birth","dob","birth date","year of birth","عمر","تاریخ پیدائش","پیدائش کی تاریخ"],name:["full name","name","نام"],father_name:["father name","father's name","fathers name","father","والد کا نام","والد"],mother_name:["mother name","mother's name","mothers name","mother","والدہ کا نام","والدہ"],address:["address","residential address","address change","change address","change of address","پتہ","رہائشی پتہ","پتہ تبدیل","پتہ کی تبدیلی"],fee:["fee","fees","cost","charges","price","smart nic fee","smart nic fees","snic fee","snic fees","فیس","چارجز"],processing_time:["processing time","how long","working days","delivery time","processing","کتنے دن","کتنا وقت","مدت","پروسیسنگ"],documents:["documents","document","required documents","requirements","papers","کاغذات","دستاویزات","ضروری دستاویزات"],procedure:["procedure","process","apply","application","how to","طریقہ","درخواست"],eligibility:["eligible","eligibility","who can","اہلیت","کون درخواست دے سکتا"],online:["online","pakid","app","website","آن لائن","پاک آئی ڈی"],office:["office","center","centre","location","کہاں","دفتر","مرکز"],renewal:["renew","renewal","تجدید"],lost:["lost","stolen","damaged","گم","چوری","خراب"],status:["status","track","tracking","اسٹیٹس","ٹریک"],parent_information:["parent information","parent details","parents information","parents details","father information","mother information","father details","mother details","parent","parents","والدین کی معلومات","والدین کی تفصیلات","والد کی معلومات","والدہ کی معلومات"]};
const SERVICES:Record<string,string[]>={
 "CNIC / NADRA":["cnic","nic","smart nic","smart nic card","snic","identity card","nadra","شناختی کارڈ","نادرا"],"Passport":["passport","پاسپورٹ"],"Driving Licence":["driving licence","driving license","driving","license","licence","ڈرائیونگ لائسنس","لائسنس"],"Domicile":["domicile","ڈومیسائل"],"Scholarships":["scholarship","scholarships","stipend","financial aid","وظیفہ","اسکالرشپ"],"Protector of Emigrants":["protector","protector of emigrants","emigration","emigrant","overseas employment","work visa","employment visa","پروٹیکٹر","ایمیگریشن","بیرون ملک ملازمت"],"Other Services":["birth certificate","death certificate","marriage certificate","divorce certificate","police verification","vehicle registration","token tax","income tax","fbr","tax","crc","form b","fard","پیدائش","وفات","شادی","طلاق","پولیس ویریفکیشن","گاڑی رجسٹریشن","ٹیکس"],"Government Jobs":["government job","government jobs","job","jobs","career","careers","employment","سرکاری نوکری","سرکاری نوکریاں","ملازمت","روزگار"]};

const OFFICIAL_SOURCES=[
 {keys:["nadra","cnic","identity card","nic","شناختی کارڈ","نادرا"],url:"https://www.nadra.gov.pk/identityDocument/cnic",title:"NADRA CNIC Services",department:"NADRA"},
 {keys:["passport","پاسپورٹ"],url:"https://dgip.gov.pk/passport/ordinary-passport.php",title:"DGI&P Ordinary Passport",department:"Directorate General of Immigration & Passports"},
 {keys:["driving licence","driving license","driving","license","licence","ڈرائیونگ لائسنس","لائسنس"],url:"https://dlims.punjab.gov.pk/",title:"DLIMS Punjab Driving Licence Services",department:"Government of Punjab – Driving License Information Management System"},
 {keys:["police","character certificate","police verification","fir","complaint","پولیس","ویریفکیشن","ایف آئی آر"],url:"https://punjabpolice.gov.pk/",title:"Punjab Police Citizen Services",department:"Punjab Police"},
 {keys:["excise","vehicle registration","token tax","vehicle","موٹر گاڑی","گاڑی رجسٹریشن","ٹوکن ٹیکس"],url:"https://excise.punjab.gov.pk/services",title:"Punjab Excise & Taxation Services",department:"Excise, Taxation & Narcotics Control Department Punjab"},
 {keys:["birth certificate","death certificate","marriage certificate","divorce certificate","union council","local government","نکاح","شادی","وفات","پیدائش","یونین کونسل"],url:"https://lgcd.punjab.gov.pk/faq",title:"Punjab Local Government FAQ",department:"Local Government & Community Development Punjab"},
 {keys:["fard","mutation","land","property","revenue","زمین","فرد","انتقال"],url:"https://www.punjab-zameen.gov.pk/",title:"Punjab Land Records Authority",department:"Punjab Land Records Authority"},
 {keys:["fbr","income tax","ntn","tax return","sales tax","iris","انکم ٹیکس","ٹیکس"],url:"https://www.fbr.gov.pk/categ/income-tax/51148/30846/71150",title:"FBR Income Tax Registration",department:"Federal Board of Revenue"},
 {keys:["scholarship","scholarships","hec","stipend","اسکالرشپ","وظیفہ"],url:"https://www.hec.gov.pk/site/scholarships",title:"HEC Scholarships",department:"Higher Education Commission"},
 {keys:["government job","government jobs","job","jobs","سرکاری نوکری","ملازمت"],url:"https://njp.gov.pk/jobs",title:"National Jobs Portal",department:"National Jobs Portal, Government of Pakistan"},
 {keys:["domicile","ڈومیسائل"],url:"https://pmru.kp.gov.pk/kp-citizen-portal.php",title:"KP Citizen Portal",department:"Government of Khyber Pakhtunkhwa"},
 {keys:["protector","emigrant","emigration","overseas employment","work visa","پروٹیکٹر","امیگریشن"],url:"https://beoe.gov.pk/",title:"Bureau of Emigration & Overseas Employment",department:"Bureau of Emigration & Overseas Employment"}
];

function detectTopic(q:string):string|null{const text=normalize(q);let best:string|null=null,score=0;for(const [topic,aliases] of Object.entries(TOPICS)){let s=0;for(const a of aliases)if(text.includes(normalize(a)))s+=a.length>=8?12:7;if(s>score){score=s;best=topic;}}return score>=7?best:null;}
function detectService(q:string,requested:string):string|null{const text=normalize(q);const departmentOnly=/^(nadra services|passport services|union council|domicile|driving licence|police services|protector & overseas employment|excise & taxation|education & scholarships|land & revenue|fbr \/ taxation|government jobs)$/i.test(requested.trim());let best=departmentOnly?null:(requested||null),score=departmentOnly?0:(requested?5:0);for(const [service,aliases] of Object.entries(SERVICES)){let s=0;for(const a of aliases)if(text.includes(normalize(a)))s+=a.length>=8?15:10;if(s>score){score=s;best=service;}}return best;}
function detectJurisdiction(q:string):string|null{const text=normalize(q);const data:Array<[string,string[]]>=[["Punjab",["punjab","پنجاب"]],["Sindh",["sindh","sind","سندھ"]],["Khyber Pakhtunkhwa",["khyber pakhtunkhwa","kpk","kp","خیبر پختونخوا","خیبرپختونخوا"]],["Islamabad Capital Territory",["islamabad","ict","اسلام آباد","اسلامباد"]],["Balochistan",["balochistan","بلوچستان"]],["Azad Jammu and Kashmir",["ajk","azad kashmir","آزاد کشمیر","آزاد جموں و کشمیر"]],["Gilgit-Baltistan",["gilgit","gilgit baltistan","گلگت","گلگت بلتستان"]]];for(const [name,terms] of data)for(const t of terms)if(text.includes(normalize(t)))return name;return null;}
function topicScore(topic:string|null,r:VerifiedRecord):number{if(!topic)return 0;const title=normalize(r.title),cat=normalize(r.category),content=normalize(`${r.content||""} ${r.content_urdu||""}`);let s=0;for(const a of TOPICS[topic]||[]){const x=normalize(a);if(title.includes(x))s+=30;else if(cat.includes(x))s+=20;else if(content.includes(x))s+=8;}return s;}
function generalScore(q:string,r:VerifiedRecord):number{const text=normalize(`${r.category||""} ${r.title||""} ${r.content||""} ${r.content_urdu||""}`),title=normalize(r.title);let s=0;for(const token of normalize(q).split(/\s+/).filter(x=>x.length>=2&&!STOP.has(x))){if(text.includes(token))s+=2;if(title.includes(token))s+=6;}return s;}
function serviceMatch(r:VerifiedRecord,service:string):boolean{const db=normalize(r.service_name),wanted=normalize(service);if(!db)return false;if(db===wanted||db.includes(wanted)||wanted.includes(db))return true;return(SERVICES[service]||[]).some(a=>db.includes(normalize(a)));}
function selectRecords(q:string,requested:string,records:VerifiedRecord[]){const topic=detectTopic(q),service=detectService(q,requested),jurisdiction=detectJurisdiction(q);let work=[...records];if(service){const x=work.filter(r=>serviceMatch(r,service));if(x.length)work=x;}if(jurisdiction){const j=normalize(jurisdiction);const x=work.filter(r=>{const p=normalize(r.province);return p==="pakistan"||p.includes(j)||j.includes(p);});if(x.length)work=x;}const scored=work.map(r=>({r,s:topicScore(topic,r)*10+generalScore(q,r)})).sort((a,b)=>b.s-a.s);const topicMatches=topic?scored.filter(x=>topicScore(topic,x.r)>0):[];const finalRecords=topic?(topicMatches.length?topicMatches:[]):scored;return{records:finalRecords.slice(0,8).map(x=>x.r),topic,service,jurisdiction};}
function context(records:VerifiedRecord[],language:"English"|"Urdu"):string{return records.map((r,i)=>`RECORD ${i+1}\nService: ${language==="Urdu"?(r.service_name_urdu||r.service_name||""):(r.service_name||"")}\nCategory: ${r.category||""}\nJurisdiction: ${r.province||""}\nTitle: ${language==="Urdu"?(r.title_urdu||r.title||""):(r.title||"")}\nVerified Information: ${language==="Urdu"?(r.content_urdu||r.content||""):(r.content||r.content_urdu||"")}\nOfficial Department: ${r.official_department||""}\nOfficial Source: ${r.official_source_title||""}\nOfficial URL: ${r.official_source_url||""}\nLast Verified: ${r.last_verified||""}`).join("\n\n");}
function noInfo(language:"English"|"Urdu"){return language==="Urdu"?"معذرت، اس مخصوص سوال کے لیے ہمارے تصدیق شدہ سرکاری ریکارڈ یا دستیاب سرکاری ماخذ میں کافی معلومات موجود نہیں ہیں۔ میں غیر مصدقہ طریقہ یا فیس نہیں بتاؤں گا۔":"Sorry, sufficient verified government information is not currently available for this specific question. I will not invent a procedure, document requirement, fee, or deadline.";}
function sourceForQuestion(question:string,service:string|null,jurisdiction:string|null,requested:string=""){
 const text=normalize(question+" "+(service||"")+" "+requested);
 const req=normalize(requested);
 const sourceByDepartment:Record<string,typeof OFFICIAL_SOURCES[number]>= {
   "nadra services":OFFICIAL_SOURCES[0],
   "passport services":OFFICIAL_SOURCES[1],
   "driving licence":OFFICIAL_SOURCES[2],
   "police services":OFFICIAL_SOURCES[3],
   "excise & taxation":OFFICIAL_SOURCES[4],
   "union council":OFFICIAL_SOURCES[5],
   "land & revenue":OFFICIAL_SOURCES[6],
   "fbr / taxation":OFFICIAL_SOURCES[7],
   "education & scholarships":OFFICIAL_SOURCES[8],
   "government jobs":OFFICIAL_SOURCES[9],
   "domicile":OFFICIAL_SOURCES[10],
   "protector & overseas employment":OFFICIAL_SOURCES[11]
 };
 if(sourceByDepartment[req])return sourceByDepartment[req];
 let candidates=OFFICIAL_SOURCES.filter(s=>s.keys.some(k=>text.includes(normalize(k))));
 if(jurisdiction==="Khyber Pakhtunkhwa"){
   if(text.includes("driving")||text.includes("license")||text.includes("licence")||text.includes("ڈرائیونگ"))candidates=[{keys:[],url:"https://www.kppolice.gov.pk/",title:"KP Police E-Driving License Services",department:"Khyber Pakhtunkhwa Police"},...candidates];
   if(text.includes("police")||text.includes("character")||text.includes("verification"))candidates=[{keys:[],url:"https://apipsm.kppolice.gov.pk/psm/VideoTutorial",title:"KP Police Sahulat Markaz",department:"Khyber Pakhtunkhwa Police"},...candidates];
   if(text.includes("birth")||text.includes("death")||text.includes("marriage")||text.includes("divorce")||text.includes("union council"))candidates=[{keys:[],url:"https://lgkp.gov.pk/page/registration-bdmd",title:"KP Local Government Birth, Death, Marriage & Divorce Registration",department:"Local Government, Elections & Rural Development Department KP"},...candidates];
   if(text.includes("excise")||text.includes("vehicle")||text.includes("token"))candidates=[{keys:[],url:"https://cfc.kp.gov.pk/Home/",title:"KP Citizens Facilitation Portal",department:"Government of Khyber Pakhtunkhwa"},...candidates];
 }
 if(jurisdiction==="Islamabad Capital Territory"&&(text.includes("driving")||text.includes("license")||text.includes("licence")))candidates=[{keys:[],url:"https://dlims.islamabadpolice.gov.pk/",title:"ITP DLIMS Driving Licence Services",department:"Islamabad Traffic Police"},...candidates];
 if(jurisdiction==="Sindh"&&(text.includes("driving")||text.includes("license")||text.includes("licence")))candidates=[{keys:[],url:"https://dls.gos.pk/",title:"Driving License Sindh",department:"Sindh Police – Driving License Unit"},...candidates];
 return candidates[0]||null;
}
async function fetchOfficialPage(url:string):Promise<string>{try{const res=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 Pakistan Citizen Helper"},cache:"no-store"});if(!res.ok)return "";const html=await res.text();return html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<noscript[\s\S]*?<\/noscript>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim().slice(0,28000);}catch{return "";}}

function webSearchDomains(question:string,service:string,jurisdiction:string|null):string[]{
  const text=normalize(`${question} ${service} ${jurisdiction||""}`);
  const domains=new Set<string>();
  if(text.includes("nadra services")||text.includes("nadra"))domains.add("nadra.gov.pk");
  if(text.includes("nadra")||text.includes("cnic")||text.includes("smart nic")||text.includes("crc")||text.includes("b-form")||text.includes("شناختی")||text.includes("نادرا")||text.includes("چائلڈ رجسٹریشن"))domains.add("nadra.gov.pk");
  if(text.includes("passport")||text.includes("پاسپورٹ"))domains.add("dgip.gov.pk");
  if(text.includes("driving")||text.includes("licence")||text.includes("license")||text.includes("ڈرائیونگ")||text.includes("لائسنس")){
    if(jurisdiction==="Punjab")domains.add("dlims.punjab.gov.pk");
    else if(jurisdiction==="Sindh")domains.add("dls.gos.pk");
    else if(jurisdiction==="Islamabad Capital Territory")domains.add("dlims.islamabadpolice.gov.pk");
    else if(jurisdiction==="Khyber Pakhtunkhwa")domains.add("kppolice.gov.pk");
    else { domains.add("dlims.punjab.gov.pk"); domains.add("dls.gos.pk"); }
  }
  if(text.includes("police")||text.includes("fir")||text.includes("character")||text.includes("verification")||text.includes("پولیس"))domains.add(jurisdiction==="Khyber Pakhtunkhwa"?"kppolice.gov.pk":"punjabpolice.gov.pk");
  if(text.includes("excise")||text.includes("vehicle")||text.includes("token")||text.includes("گاڑی"))domains.add(jurisdiction==="Khyber Pakhtunkhwa"?"kp.gov.pk":"excise.punjab.gov.pk");
  if(text.includes("fbr")||text.includes("tax")||text.includes("ntn")||text.includes("iris")||text.includes("ٹیکس"))domains.add("fbr.gov.pk");
  if(text.includes("scholarship")||text.includes("hec")||text.includes("وظیفہ")||text.includes("اسکالر"))domains.add("hec.gov.pk");
  if(text.includes("job")||text.includes("jobs")||text.includes("نوکری")||text.includes("ملازمت"))domains.add("njp.gov.pk");
  if(text.includes("protector")||text.includes("emigrant")||text.includes("overseas employment")||text.includes("پروٹیکٹر"))domains.add("beoe.gov.pk");
  if(text.includes("domicile")||text.includes("ڈومیسائل"))domains.add(jurisdiction==="Khyber Pakhtunkhwa"?"kp.gov.pk":"gov.pk");
  if(domains.size===0)domains.add("gov.pk");
  return Array.from(domains);
}

export async function POST(request:NextRequest){try{
 if(!SUPABASE_URL||!SUPABASE_ANON_KEY||!GROQ_API_KEY)return NextResponse.json({error:"Server configuration is incomplete. Check the Vercel environment variables."},{status:500});
 const body=await request.json();const question=String(body.question??"").trim();const requested=String(body.service??"").trim();const langInput=String(body.language??"").trim();if(!question)return NextResponse.json({error:"Please enter a question."},{status:400});const language:"English"|"Urdu"=langInput.toLowerCase()==="urdu"||isUrdu(question)?"Urdu":"English";
 const url=`${SUPABASE_URL}/rest/v1/verified_information?select=id,service_name,category,title,content,service_name_urdu,province,title_urdu,content_urdu,official_department,official_source_title,official_source_url,last_verified,active&active=eq.true&order=last_verified.desc`;const db=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`},cache:"no-store"});if(!db.ok){console.error(await db.text());return NextResponse.json({error:"Unable to retrieve verified information from Supabase."},{status:500});}
 const all=(await db.json()) as VerifiedRecord[];const selected=selectRecords(question,requested,all);const registrySource=sourceForQuestion(question,selected.service,selected.jurisdiction,requested);const recordSource=selected.records.find(r=>r.official_source_url)?.official_source_url||"";const sourceUrl=recordSource||registrySource?.url||"";const sourceMeta=registrySource||{url:sourceUrl,title:selected.records[0]?.official_source_title||"Official Government Source",department:selected.records[0]?.official_department||"Government of Pakistan"};
const jurisdictionSourceHints:Record<string,string[]>={
 "Driving Licence":["kppolice.gov.pk","kprts.gov.pk","transport.kp.gov.pk","ptpkp.gov.pk"],
 "Domicile":["kp.gov.pk","cfc.kp.gov.pk"],
 "Passport & Immigration":["dgip.gov.pk"],
 "NADRA Services":["nadra.gov.pk"],
 "Police Services":["kppolice.gov.pk"],
 "Excise & Taxation":["kp.gov.pk"],
 "Land & Revenue":["revenue.kp.gov.pk"],
 "Education & Scholarships":["kpese.gov.pk","hed.gkp.pk"],
 "FBR / Taxation":["fbr.gov.pk"],
 "Protector & Overseas Employment":["beoe.gov.pk"],
 "Union Council":["lgkp.gov.pk"],
 "Government Jobs":["njp.gov.pk","kp.gov.pk"]
};
const allowedHints=jurisdictionSourceHints[requested]||[];const officialText=sourceUrl?await fetchOfficialPage(sourceUrl):"";const dbContext=selected.records.length?context(selected.records,language):"No matching verified database record was found.";if(!selected.records.length&&!officialText)return NextResponse.json({answer:noInfo(language),source:null});
 const system=`You are the verified government Q&A assistant inside Pakistan Citizen Helper.

Answer the citizen's EXACT question first. Keep the answer short, direct, and easy to read.

Rules:
- Use the verified database records as the primary evidence. Use official government source text only when it directly supports the answer.
- Every factual claim in your answer must be directly supported by the supplied verified record or official source text, or by a result returned by the browser search.
- If the supplied evidence does not contain the answer, use official government source retrieval for the selected department. The source must match the selected department and, when jurisdiction is known, the relevant provincial/federal authority.
- Never use an unrelated department's source just because it contains matching keywords.
- For department-specific questions, prefer the department's own official domain (for example NADRA → nadra.gov.pk, Passport → dgip.gov.pk, KP Driving Licence → kppolice.gov.pk/kprts.gov.pk/transport.kp.gov.pk).
- For parent/father/mother information questions, you MUST verify against NADRA's official website before answering.
- Never fill missing information from memory, general knowledge, assumptions, or patterns. Never invent or guess government facts, fees, documents, eligibility, deadlines, procedures, office locations, or processing times.
- If the exact requested topic is not supported by verified evidence, say that verified information for that specific topic is unavailable.
- Do NOT give a general workflow or a long explanation unless the citizen asks for it.
- If the question is about a fee, give only the relevant fee and processing information.
- If the question is about address change, give only the address-change information.
- If the question is about Smart NIC/SNIC, use Smart NIC/SNIC information, not generic CNIC information.
- Do not mix unrelated services or requirements into the answer.
- If the question is ambiguous, ask ONE short clarifying question.
- If verified information is unavailable, say so clearly.
- If sources conflict, state the conflict briefly instead of guessing.
- Use simple Pakistani Urdu when the requested language is Urdu.
- When supported by the browser search, include the official source citation/link.

Selected department/service: ${requested||"not specified"}
Requested language: ${language}
`;
 const hasVerifiedRecords=selected.records.length>0;
 const messages=[{role:"system",content:system},{role:"user",content:`Goal: ${question}
Selected department/service: ${selected.service||requested||"not specified"}
Jurisdiction: ${selected.jurisdiction||"not specified"}
Language: ${language}

VERIFIED DATABASE RECORDS:
${dbContext}

OFFICIAL SOURCE TEXT:
${officialText||"No official source text was retrieved."}

IMPORTANT: Answer ONLY from the verified records and official source text above. If they do not contain the answer, say that verified information for this specific question is unavailable. Never invent or infer government facts.`}];
 const makeAiBody=(model:string)=>({model,temperature:1,reasoning_effort:"low",max_completion_tokens:2048,messages});
 let ai=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${GROQ_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify(makeAiBody("openai/gpt-oss-120b"))});
 if(!ai.ok){
   console.error("Primary Groq model failed:",await ai.text());
   ai=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${GROQ_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify(makeAiBody("openai/gpt-oss-20b"))});
 }
 if(!ai.ok){console.error(await ai.text());return NextResponse.json({error:"AI service request failed. Please try again.", errorType:"ai_service_error"},{status:502});}const data=await ai.json();const answer=data?.choices?.[0]?.message?.content?.trim()||noInfo(language);return NextResponse.json({answer,source:{department:sourceMeta.department,title:sourceMeta.title,url:sourceUrl,lastVerified:selected.records[0]?.last_verified||"",province:selected.jurisdiction||selected.records[0]?.province||""},agent:true,goalFocused:true,webSearch:true});
 }catch(error){console.error("API /api/ask error:",error);return NextResponse.json({error:"An unexpected error occurred. Please try again."},{status:500});}}
