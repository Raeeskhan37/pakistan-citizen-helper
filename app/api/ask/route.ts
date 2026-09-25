import { NextRequest, NextResponse } from "next/server";
import { retrieveNadraEvidence } from "../../../lib/nadra-rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = "openai/gpt-oss-20b";
const GROQ_FALLBACK_MODEL = "openai/gpt-oss-120b";

type VerifiedRecord = {
  id?: number; service_name?: string|null; category?: string|null; title?: string|null; content?: string|null;
  service_name_urdu?: string|null; province?: string|null; title_urdu?: string|null; content_urdu?: string|null;
  official_department?: string|null; official_source_title?: string|null; official_source_url?: string|null;
  last_verified?: string|null; active?: boolean|null;
};

function normalize(v:unknown):string{return String(v??"").toLowerCase().normalize("NFKC").replace(/\s+/g," ").trim();}
function isUrdu(text:string):boolean{return /[\u0600-\u06FF]/.test(text);}
function canonicalDepartment(v:string):string{
 const x=normalize(v);
 const map:Record<string,string>={
  "cnic / nadra":"NADRA Services","nadra services":"NADRA Services","nadra":"NADRA Services",
  "passport":"Passport Services","passport services":"Passport Services","passport & immigration":"Passport Services","passport & immigration services":"Passport Services",
  "union council":"Union Council","union council / local government":"Union Council","local government":"Union Council",
  "domicile":"Domicile","driving licence":"Driving Licence","police services":"Police Services",
  "protector & overseas employment":"Protector & Overseas Employment","protector of emigrants":"Protector & Overseas Employment",
  "excise & taxation":"Excise & Taxation","education & scholarships":"Education & Scholarships",
  "land & revenue":"Land & Revenue","fbr / taxation":"FBR / Taxation","government jobs":"Government Jobs"
 };
 return map[x]||v;
}

const STOP=new Set(["the","is","are","was","were","how","what","where","when","which","can","may","for","from","with","about","please","tell","me","give","get","my","i","do","does","a","an","of","to","in","on","and","or","کے","کی","کا","کو","میں","سے","اور","ہے","ہیں","کیا","کہاں","کیسے","مجھے","لیے","بارے","میرا","میری"]);
const TOPICS:Record<string,string[]>={
 age_dob:["age","date of birth","dob","birth date","year of birth","عمر","تاریخ پیدائش","پیدائش کی تاریخ"],name:["full name","name","نام"],father_name:["father name","father's name","fathers name","father","والد کا نام","والد"],mother_name:["mother name","mother's name","mothers name","mother","والدہ کا نام","والدہ"],address:["address","residential address","address change","change address","change of address","پتہ","رہائشی پتہ","پتہ تبدیل","پتہ کی تبدیلی"],fee:["fee","fees","cost","charges","price","smart nic fee","smart nic fees","snic fee","snic fees","فیس","چارجز"],processing_time:["processing time","how long","working days","delivery time","processing","کتنے دن","کتنا وقت","مدت","پروسیسنگ"],documents:["documents","document","required documents","requirements","papers","کاغذات","دستاویزات","ضروری دستاویزات"],procedure:["procedure","process","apply","application","how to","طریقہ","درخواست"],eligibility:["eligible","eligibility","who can","اہلیت","کون درخواست دے سکتا"],online:["online","pakid","app","website","آن لائن","پاک آئی ڈی"],office:["office","center","centre","location","کہاں","دفتر","مرکز"],renewal:["renew","renewal","تجدید"],lost:["lost","stolen","damaged","گم","چوری","خراب"],status:["status","track","tracking","اسٹیٹس","ٹریک"],parent_information:["parent information","parent details","parents information","parents details","father information","mother information","father details","mother details","parent","parents","والدین کی معلومات","والدین کی تفصیلات","والد کی معلومات","والدہ کی معلومات"]};
const DEPARTMENT_ALIASES:Record<string,string[]>={
 "NADRA Services":["nadra services","nadra","cnic","nic","smart nic","crc","b-form","juvenile card","frc","nicop","poc","pakid","cancellation certificate","شناختی کارڈ","نادرا"],
 "Passport Services":["passport","passport services","passport & immigration","immigration","passport renewal","lost passport","passport modification","پاسپورٹ","امیگریشن"],
 "Union Council":["union council","local government","birth certificate","death certificate","marriage certificate","divorce certificate","civil registration","یونین کونسل","بلدیاتی"],
 "Domicile":["domicile","ڈومیسائل"],
 "Driving Licence":["driving licence","driving license","learner licence","permanent driving licence","licence renewal","duplicate licence","driving test","ڈرائیونگ لائسنس"],
 "Police Services":["police services","police","police clearance","character certificate","police verification","tenant verification","employee verification","fir","پولیس","ایف آئی آر"],
 "Protector & Overseas Employment":["protector","protector of emigrants","overseas employment","emigration","emigrant","employment abroad","پروٹیکٹر","بیرون ملک ملازمت"],
 "Excise & Taxation":["excise","taxation","vehicle registration","ownership transfer","token tax","vehicle verification","number plate","ایکسائز","ٹوکن ٹیکس"],
 "Education & Scholarships":["education","scholarship","scholarships","hec","stipend","financial aid","scholarship eligibility","تعلیم","وظیفہ","اسکالرشپ"],
 "Land & Revenue":["land","revenue","fard","mutation","intiqal","land record","property","زمین","ریونیو","فرد","انتقال"],
 "FBR / Taxation":["fbr","taxation","income tax","ntn","tax return","taxpayer","atl","iris","ٹیکس","ایف بی آر"],
 "Government Jobs":["government jobs","government job","jobs","job","career","employment","federal government jobs","provincial government jobs","سرکاری ملازمت","سرکاری نوکری"]
};

function belongsToDepartment(service:string,department:string):boolean{
 const s=normalize(service), d=canonicalDepartment(department);
 if(!s||!d)return true;
 if(normalize(d)===normalize(service))return true;
 // Civil-registration services such as birth, death, marriage and divorce certificates
 // belong to Union Council / Local Government, even though they are grouped under
 // "Other Services" in the generic service detector.
 if(d==="Union Council" && ["Other Services","Birth Certificate","Death Certificate","Marriage Certificate","Divorce Certificate"].includes(service)) return true;
 return (DEPARTMENT_ALIASES[d]||[]).some(a=>s===normalize(a)||s.includes(normalize(a))||normalize(a).includes(s));
}

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
function detectService(q:string,requested:string):string|null{
 const text=normalize(q),department=canonicalDepartment(requested);
 const departmentOnly=/^(nadra services|passport services|union council|domicile|driving licence|police services|protector & overseas employment|excise & taxation|education & scholarships|land & revenue|fbr \/ taxation|government jobs)$/i.test(department);
 let best=departmentOnly?null:(department||null),score=departmentOnly?0:(department?5:0);
 for(const [service,aliases] of Object.entries(SERVICES)){
  let s=0;for(const a of aliases)if(text.includes(normalize(a)))s+=a.length>=8?15:10;
  if(s>score){score=s;best=service;}
 }
 return best;
}
function detectJurisdiction(q:string):string|null{const text=normalize(q);const data:Array<[string,string[]]>=[["Punjab",["punjab","پنجاب"]],["Sindh",["sindh","sind","سندھ"]],["Khyber Pakhtunkhwa",["khyber pakhtunkhwa","kpk","kp","خیبر پختونخوا","خیبرپختونخوا"]],["Islamabad Capital Territory",["islamabad","ict","اسلام آباد","اسلامباد"]],["Balochistan",["balochistan","بلوچستان"]],["Azad Jammu and Kashmir",["ajk","azad kashmir","آزاد کشمیر","آزاد جموں و کشمیر"]],["Gilgit-Baltistan",["gilgit","gilgit baltistan","گلگت","گلگت بلتستان"]]];for(const [name,terms] of data)for(const t of terms)if(text.includes(normalize(t)))return name;return null;}
function topicScore(topic:string|null,r:VerifiedRecord):number{if(!topic)return 0;const title=normalize(r.title),cat=normalize(r.category),content=normalize(`${r.content||""} ${r.content_urdu||""}`);let s=0;for(const a of TOPICS[topic]||[]){const x=normalize(a);if(title.includes(x))s+=30;else if(cat.includes(x))s+=20;else if(content.includes(x))s+=8;}return s;}
function generalScore(q:string,r:VerifiedRecord):number{const text=normalize(`${r.category||""} ${r.title||""} ${r.content||""} ${r.content_urdu||""}`),title=normalize(r.title);let s=0;for(const token of normalize(q).split(/\s+/).filter(x=>x.length>=2&&!STOP.has(x))){if(text.includes(token))s+=2;if(title.includes(token))s+=6;}return s;}
function serviceMatch(r:VerifiedRecord,service:string):boolean{
 const db=normalize(r.service_name),wanted=normalize(service);
 if(!db||!wanted)return false;
 if(db===wanted||db.includes(wanted)||wanted.includes(db))return true;
 const aliases=DEPARTMENT_ALIASES[canonicalDepartment(service)]||[];
 return aliases.some(a=>db.includes(normalize(a))||normalize(a).includes(db));
}
function selectRecords(q:string,requested:string,records:VerifiedRecord[]){
 const topic=detectTopic(q),department=canonicalDepartment(requested),requestedService=detectService("",department),questionService=detectService(q,""),jurisdiction=detectJurisdiction(q);
 const service=(requestedService||department) as string;
 let work=[...records];
 if(service){
   work=work.filter(r=>serviceMatch(r,service));
 }
 if(jurisdiction){
   const j=normalize(jurisdiction);
   work=work.filter(r=>{const p=normalize(r.province);return !p||p==="pakistan"||p.includes(j)||j.includes(p);});
 }
 const scored=work.map(r=>({r,s:topicScore(topic,r)*10+generalScore(q,r)})).sort((a,b)=>b.s-a.s);
 const topicMatches=topic?scored.filter(x=>topicScore(topic,x.r)>0):[];
 const finalRecords=topic?(topicMatches.length?topicMatches:[]):scored;
 return{records:finalRecords.slice(0,8).map(x=>x.r),topic,service,jurisdiction,questionService};
}
function context(records:VerifiedRecord[],language:"English"|"Urdu"):string{return records.slice(0,4).map((r,i)=>{const info=language==="Urdu"?(r.content_urdu||r.content||""):(r.content||r.content_urdu||"");return `RECORD ${i+1}\nService: ${language==="Urdu"?(r.service_name_urdu||r.service_name||""):(r.service_name||"")}\nCategory: ${r.category||""}\nJurisdiction: ${r.province||""}\nTitle: ${language==="Urdu"?(r.title_urdu||r.title||""):(r.title||"")}\nVerified Information: ${info.slice(0,2200)}\nOfficial Department: ${r.official_department||""}\nOfficial Source: ${r.official_source_title||""}\nOfficial URL: ${r.official_source_url||""}\nLast Verified: ${r.last_verified||""}`}).join("\n\n");}
function cleanAnswer(text:string):string{
 return text
  .replace(/<br\s*\/?\s*>/gi,"\n")
  .replace(/<\/?(?:p|div|span|table|thead|tbody|tr|th|td|strong|b|em|i|ul|ol|li|blockquote)[^>]*>/gi," ")
  .replace(/<[^>]+>/g,"")
  .replace(/&nbsp;|&#160;|&#xA0;/gi," ")
  .replace(/&amp;/gi,"&")
  .replace(/&lt;/gi,"<")
  .replace(/&gt;/gi,">")
  .replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'")
  .replace(/[\u200B-\u200D\uFEFF]/g,"")
  .replace(/\u00A0/g," ")
  .replace(/[ \t]+\n/g,"\n")
  .replace(/\n{3,}/g,"\n\n")
  .trim();
}
function noInfo(language:"English"|"Urdu"){return language==="Urdu"?"معذرت، اس مخصوص سوال کے لیے ہمارے تصدیق شدہ سرکاری ریکارڈ یا دستیاب سرکاری ماخذ میں کافی معلومات موجود نہیں ہیں۔ میں غیر مصدقہ طریقہ یا فیس نہیں بتاؤں گا۔":"Sorry, sufficient verified government information is not currently available for this specific question. I will not invent a procedure, document requirement, fee, or deadline.";}
function sourceForQuestion(question:string,service:string|null,jurisdiction:string|null,requested:string=""){
 const req=normalize(canonicalDepartment(requested));
 const make=(url:string,title:string,department:string)=>({keys:[],url,title,department});
 if(req==="nadra services")return make("https://www.nadra.gov.pk/identityDocument/cnic","NADRA CNIC Services","NADRA");
 if(req==="passport services")return make("https://dgip.gov.pk/passport/ordinary-passport.php","DGI&P Ordinary Passport","Directorate General of Immigration & Passports");
 if(req==="education & scholarships")return make("https://www.hec.gov.pk/site/scholarships","HEC Scholarships","Higher Education Commission");
 if(req==="government jobs")return make("https://njp.gov.pk/jobs","National Jobs Portal","National Jobs Portal, Government of Pakistan");
 if(req==="protector & overseas employment")return make("https://beoe.gov.pk/","Bureau of Emigration & Overseas Employment","Bureau of Emigration & Overseas Employment");
 if(req==="fbr / taxation")return make("https://www.fbr.gov.pk/categ/income-tax/51148/30846/71150","FBR Income Tax Registration","Federal Board of Revenue");
 if(req==="union council"){
   if(jurisdiction==="Khyber Pakhtunkhwa")return make("https://lgkp.gov.pk/page/registration-bdmd","KP Local Government Registration Services","Local Government, Elections & Rural Development Department KP");
   return make("https://lgcd.punjab.gov.pk/faq","Punjab Local Government FAQ","Local Government & Community Development Punjab");
 }
 if(req==="land & revenue"){
   if(jurisdiction==="Khyber Pakhtunkhwa")return make("https://revenue.kp.gov.pk/","KP Revenue & Estate Department","Revenue & Estate Department, Government of Khyber Pakhtunkhwa");
   return make("https://www.punjab-zameen.gov.pk/","Punjab Land Records Authority","Punjab Land Records Authority");
 }
 if(req==="police services"){
   if(jurisdiction==="Khyber Pakhtunkhwa")return make("https://www.kppolice.gov.pk/","KP Police Citizen Services","Khyber Pakhtunkhwa Police");
   return make("https://punjabpolice.gov.pk/","Punjab Police Citizen Services","Punjab Police");
 }
 if(req==="excise & taxation"){
   if(jurisdiction==="Khyber Pakhtunkhwa")return make("https://www.kpexcise.gov.pk/","KP Excise & Taxation Department","Excise, Taxation & Narcotics Control Department KP");
   return make("https://excise.punjab.gov.pk/services","Punjab Excise & Taxation Services","Excise, Taxation & Narcotics Control Department Punjab");
 }
 if(req==="driving licence"){
   if(jurisdiction==="Khyber Pakhtunkhwa")return make("https://www.kppolice.gov.pk/","KP Driving Licence Services","Khyber Pakhtunkhwa Police");
   if(jurisdiction==="Sindh")return make("https://dls.gos.pk/","Driving License Sindh","Sindh Police – Driving License Unit");
   if(jurisdiction==="Islamabad Capital Territory")return make("https://dlims.islamabadpolice.gov.pk/","ITP DLIMS Driving Licence Services","Islamabad Traffic Police");
   return make("https://dlims.punjab.gov.pk/","DLIMS Punjab Driving Licence Services","Government of Punjab – Driving License Information Management System");
 }
 if(req==="domicile")return make("https://cfc.kp.gov.pk/","KP Citizens Facilitation Portal","Government of Khyber Pakhtunkhwa");
 return null;
}
async function fetchOfficialSearch(query:string,domains:string[]):Promise<string>{
 const results:string[]=[];
 for(const domain of domains){
   const url="https://www.google.com/search?q="+encodeURIComponent("site:"+domain+" "+query);
   const page=await fetchOfficialPage(url);
   if(page)results.push("\nOFFICIAL DOMAIN SEARCH: "+domain+"\n"+page.slice(0,14000));
 }
 return results.join("\n");
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
 const body=await request.json();const question=String(body.question??"").trim();const requested=canonicalDepartment(String(body.service??"").trim());const langInput=String(body.language??"").trim();if(!question)return NextResponse.json({error:"Please enter a question."},{status:400});const language:"English"|"Urdu"=langInput.toLowerCase()==="urdu"||isUrdu(question)?"Urdu":"English";
 const url=`${SUPABASE_URL}/rest/v1/verified_information?select=id,service_name,category,title,content,service_name_urdu,province,title_urdu,content_urdu,official_department,official_source_title,official_source_url,last_verified,active&active=eq.true&order=last_verified.desc`;const db=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`},cache:"no-store"});if(!db.ok){console.error(await db.text());return NextResponse.json({error:"Unable to retrieve verified information from Supabase."},{status:500});}
 const all=(await db.json()) as VerifiedRecord[];const selected=selectRecords(question,requested,all);
 const detectedQuestionService=detectService(question,"");
 if(detectedQuestionService && !belongsToDepartment(detectedQuestionService,requested)){
   return NextResponse.json({answer:language==="Urdu"?"یہ سوال منتخب شعبے سے متعلق نہیں لگتا۔ براہ کرم اسی شعبے سے متعلق سوال پوچھیں۔":"This question does not appear to belong to the selected government department. Please ask a question related to the selected department.",source:null});
 }const isNadra=requested==="NADRA Services";
const registrySource=sourceForQuestion(question,selected.service,selected.jurisdiction,requested);const matchingRecord=selected.records.find(r=>normalize(r.official_department||"").includes(normalize(registrySource?.department||"___no_registry_department___")));const recordSource=matchingRecord?.official_source_url||"";const sourceUrl=registrySource?.url||recordSource||"";const sourceMeta=isNadra?{url:"https://www.nadra.gov.pk/identityDocument/cnic",title:"NADRA Registration Policy 6.0.2 — RAG Evidence",department:"NADRA"}:(registrySource||{url:sourceUrl,title:selected.records[0]?.official_source_title||"Official Government Source",department:selected.records[0]?.official_department||"Government of Pakistan"});
const jurisdictionSourceHints:Record<string,string[]>={
 "Driving Licence":["kppolice.gov.pk","kprts.gov.pk","transport.kp.gov.pk","ptpkp.gov.pk"],
 "Domicile":["kp.gov.pk","cfc.kp.gov.pk"],
 "Passport Services":["dgip.gov.pk"],
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
const allowedHints=jurisdictionSourceHints[requested]||[];const alternateOfficialUrls:string[]=[];
if(requested==="Passport Services"){
 alternateOfficialUrls.push("https://www.dgip.gov.pk/passport/ordinary-passport.php","https://www.dgip.gov.pk/passport/process.php","https://www.dgip.gov.pk/eServices/online-passport.php");
}
if(requested==="Government Jobs"){alternateOfficialUrls.push("https://www.njp.gov.pk/index.php/jobs","https://www.njp.gov.pk/index.php/jobs/live","https://www.njp.gov.pk/index.php/jobs/search");}
if(requested==="Education & Scholarships"){
 if(normalize(question).includes("need based")||normalize(question).includes("financial need")||normalize(question).includes("undergraduate"))
   alternateOfficialUrls.push("https://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/Eligibility-Criteria.aspx","https://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/How-To-Apply.aspx");
 else if(normalize(question).includes("abroad")||normalize(question).includes("foreign")||normalize(question).includes("overseas"))
   alternateOfficialUrls.push("https://www.hec.gov.pk/english/scholarshipsgrants/lao/pages/default.aspx");
 else alternateOfficialUrls.push("https://www.hec.gov.pk/site/scholarships");
}
if(requested==="Land & Revenue" && selected.jurisdiction==="Khyber Pakhtunkhwa"){alternateOfficialUrls.push("https://revenue.kp.gov.pk/","https://revenue.kp.gov.pk/director-land-record/");}
if(requested==="Police Services" && selected.jurisdiction==="Khyber Pakhtunkhwa"){
 alternateOfficialUrls.push("https://www.kppolice.gov.pk/detail.php?pid=52","https://apipsm.kppolice.gov.pk/psm/VideoTutorial");
}
if(requested==="Union Council"){
  // Birth/death/marriage/divorce registration is jurisdiction-specific.
  // Retrieve the strongest available official source for the detected jurisdiction.
  if(selected.jurisdiction==="Khyber Pakhtunkhwa"){
    alternateOfficialUrls.push("https://lgkp.gov.pk/page/crvs","https://lgkp.gov.pk/page/registration-bdmd");
  } else if(selected.jurisdiction==="Islamabad Capital Territory"){
    alternateOfficialUrls.push("https://ictadministration.gov.pk/birth-certificate/","https://ictadministration.gov.pk/death-registration/");
  } else if(selected.jurisdiction==="Sindh"){
    alternateOfficialUrls.push("https://www.sindh.gov.pk/useful-links","https://cm.sindh.gov.pk/news/cm-sindh-presides-over-cabinet-meeting-reviews-57-item-agenda");
  } else if(selected.jurisdiction==="Balochistan"){
    alternateOfficialUrls.push("https://balochistan.gov.pk/");
  } else if(!selected.jurisdiction){
    alternateOfficialUrls.push("https://lgcd.punjab.gov.pk/faq","https://lgcd.punjab.gov.pk/system/files/Notified%20Birth%20Death%20Rules%2C%202025.pdf","https://lgkp.gov.pk/page/crvs","https://lgkp.gov.pk/page/registration-bdmd");
  } else {
    alternateOfficialUrls.push("https://lgcd.punjab.gov.pk/faq","https://lgcd.punjab.gov.pk/system/files/Notified%20Birth%20Death%20Rules%2C%202025.pdf");
  }
}
if(requested==="Protector & Overseas Employment"){alternateOfficialUrls.push("https://beoe.gov.pk/");}
const departmentDomains:Record<string,string[]>={
 "Government Jobs":["njp.gov.pk"],
 "Education & Scholarships":["hec.gov.pk"],
 "Land & Revenue":selected.jurisdiction==="Khyber Pakhtunkhwa"?["revenue.kp.gov.pk"]:["punjab-zameen.gov.pk"],
 "Protector & Overseas Employment":["beoe.gov.pk"],
 "Police Services":selected.jurisdiction==="Khyber Pakhtunkhwa"?["kppolice.gov.pk"]:["punjabpolice.gov.pk"],
 "Excise & Taxation":selected.jurisdiction==="Khyber Pakhtunkhwa"?["kpexcise.gov.pk"]:["excise.punjab.gov.pk"],
 "Driving Licence":selected.jurisdiction==="Khyber Pakhtunkhwa"?["kppolice.gov.pk"]:selected.jurisdiction==="Sindh"?["dls.gos.pk"]:selected.jurisdiction==="Islamabad Capital Territory"?["dlims.islamabadpolice.gov.pk"]:["dlims.punjab.gov.pk"],
 "Domicile":selected.jurisdiction==="Khyber Pakhtunkhwa"?["cfc.kp.gov.pk","kp.gov.pk"]:["gov.pk"],
 "Union Council":selected.jurisdiction==="Khyber Pakhtunkhwa"?["lgkp.gov.pk"]:selected.jurisdiction==="Islamabad Capital Territory"?["ictadministration.gov.pk"]:selected.jurisdiction==="Sindh"?["sindh.gov.pk"]:selected.jurisdiction==="Balochistan"?["balochistan.gov.pk"]:["lgcd.punjab.gov.pk"],
 "FBR / Taxation":["fbr.gov.pk"],
 "Passport Services":["dgip.gov.pk"],
 "NADRA Services":["nadra.gov.pk"]
};
const ragEvidence=requested==="NADRA Services"?await retrieveNadraEvidence(question,language):"";
let civilRegistrationEvidence="";
if(requested==="Union Council"){
  const nq=normalize(question);
  const isBirth=nq.includes("birth")||nq.includes("پیدائش")||nq.includes("پیدائشی");
  const isDeath=nq.includes("death")||nq.includes("وفات")||nq.includes("موت")||nq.includes("ڈیتھ");
  const j=selected.jurisdiction;

  if(isBirth){
    if(j==="Punjab"){
      civilRegistrationEvidence=`OFFICIAL VERIFIED EVIDENCE — PUNJAB BIRTH REGISTRATION
Source: https://lgcd.punjab.gov.pk/faq
For birth registration within 60 days:
1. Copy of parents' NIC/CNIC.
2. Birth certificate/slip issued by the hospital or traditional birth attendant.
3. Union Council-provided form, completed with signature and thumb impression.
Registration is free; PKR 100 is charged for issuance of the NADRA computerized birth registration certificate.`;
    } else if(j==="Khyber Pakhtunkhwa"){
      civilRegistrationEvidence=`OFFICIAL VERIFIED EVIDENCE — KP BIRTH REGISTRATION
Source: https://lgkp.gov.pk/page/crvs
Required:
1. Form-A application supplied by the concerned council, filled with signature and thumb impression.
2. Attested copy of parent(s)' or guardian's CNIC; for a foreigner, passport; for a refugee, residence permit.
3. Birth certificate or immunization card issued by a health facility, or school certificate, if available.`;
    } else if(j){
      civilRegistrationEvidence=`OFFICIAL VERIFIED EVIDENCE — ${j.toUpperCase()} BIRTH REGISTRATION
A sufficiently specific birth-certificate document checklist was not established from the retrieved official evidence for this jurisdiction. Do not invent one.`;
    } else {
      civilRegistrationEvidence=`OFFICIAL VERIFIED EVIDENCE — PUNJAB BIRTH REGISTRATION
Source: https://lgcd.punjab.gov.pk/faq
For birth registration within 60 days:
1. Copy of parents' NIC/CNIC.
2. Birth certificate/slip issued by the hospital or traditional birth attendant.
3. Union Council-provided form, completed with signature and thumb impression.
Registration is free; PKR 100 is charged for issuance of the NADRA computerized birth registration certificate.

OFFICIAL VERIFIED EVIDENCE — KP BIRTH REGISTRATION
Source: https://lgkp.gov.pk/page/crvs
Required:
1. Form-A application supplied by the concerned council, filled with signature and thumb impression.
2. Attested copy of parent(s)' or guardian's CNIC; for a foreigner, passport; for a refugee, residence permit.
3. Birth certificate or immunization card issued by a health facility, or school certificate, if available.

For Sindh, Balochistan, and Islamabad Capital Territory, a sufficiently specific birth-certificate document checklist was not established from the retrieved official evidence.`;
    }
  } else if(isDeath){
    if(j==="Punjab"){
      civilRegistrationEvidence=`OFFICIAL VERIFIED EVIDENCE — PUNJAB DEATH REGISTRATION
Source: https://lgcd.punjab.gov.pk/system/files/Notified%20Birth%20Death%20Rules%2C%202025.pdf
For death reported within one year, the notified rules require Form-B at the concerned registration office with:
1. Copy of CNIC of the applicant and deceased.
2. Hospital death slip showing cause of death, if death occurred in a hospital.
3. Burial slip issued by the graveyard management committee, if available.

For late registration after one year and up to seven years, the rules add:
4. Relative's affidavit on PKR 300 stamp paper, witnessed by two persons present at burial.
5. Copies of CNIC or birth certificate of the deceased and the relative making the application.
6. Hospital death slip where applicable.

Note: the Ghorkan certificate/parchi is documentary evidence referenced in the Punjab FAQ; it should not be presented as a separate mandatory Punjab item unless the official source makes it mandatory.`;
    } else if(j==="Khyber Pakhtunkhwa"){
      civilRegistrationEvidence=`OFFICIAL VERIFIED EVIDENCE — KP DEATH REGISTRATION
Source: https://lgkp.gov.pk/page/crvs
Required/possible evidence:
1. Form-D, filled out, verified, signed and thumb-printed.
2. Applicant's Computerized National Identity Card number.
3. Documentary evidence may be required, including a certificate/parchi issued by the Ghorkan or person in charge of the graveyard where the deceased was buried.
The official source does not state that every listed documentary item is mandatory in every case.`;
    } else if(j==="Islamabad Capital Territory"){
      civilRegistrationEvidence=`OFFICIAL VERIFIED EVIDENCE — ISLAMABAD CAPITAL TERRITORY DEATH REGISTRATION
Source: https://ictadministration.gov.pk/death-registration/
The ICT Administration lists information required for a death certificate:
1. Deceased's name and nationality.
2. Husband/father/mother's name and occupation.
3. Address.
4. Religion, sex and caste.
5. Date, time and cause of death, and age.
6. Name and address of the person making the report.
7. Date of the report.
The page states submission at Citizen Facilitation Center, G-11/4, Islamabad, with a stated processing time of 7 days.
These are listed as information requirements; the source does not separately identify a physical-document checklist.`;
    } else if(j==="Sindh"){
      civilRegistrationEvidence=`OFFICIAL VERIFIED EVIDENCE — SINDH DEATH REGISTRATION
Source: https://www.sindh.gov.pk/
Sindh Government identifies civil registration, including death registration, as a local-council service through the Civil Registration Management System.
No specific death-certificate document checklist was established from the retrieved official source. Do not invent one.`;
    } else if(j==="Balochistan"){
      civilRegistrationEvidence=`OFFICIAL VERIFIED EVIDENCE — BALOCHISTAN DEATH REGISTRATION
Source: https://balochistan.gov.pk/wp-content/uploads/2024/10/Balochistan-Local-Government-Act-2010.pdf
The Balochistan Local Government Act identifies registration/certification of births, marriages and deaths as a Union Council function.
No specific death-certificate document checklist was established from the retrieved official source. Do not invent one.`;
    } else if(j){
      civilRegistrationEvidence=`OFFICIAL VERIFIED EVIDENCE — ${j.toUpperCase()} DEATH REGISTRATION
No specific death-certificate document checklist was established from the retrieved official evidence for this jurisdiction. Do not invent one.`;
    } else {
      civilRegistrationEvidence=`OFFICIAL VERIFIED EVIDENCE — PUNJAB DEATH REGISTRATION
Source: https://lgcd.punjab.gov.pk/system/files/Notified%20Birth%20Death%20Rules%2C%202025.pdf
Within one year:
1. Form-B.
2. Copy of applicant's CNIC and deceased's CNIC.
3. Hospital death slip showing cause of death, if applicable.
4. Burial slip, if available.
Late registration after one year and up to seven years adds a relative's PKR 300 stamp-paper affidavit witnessed by two persons present at burial, copies of CNIC or birth certificate of the deceased and relative, and hospital death slip where applicable.

OFFICIAL VERIFIED EVIDENCE — KHYBER PAKHTUNKHWA DEATH REGISTRATION
Source: https://lgkp.gov.pk/page/crvs
1. Form-D, filled, verified, signed and thumb-printed.
2. Applicant's CNIC number.
3. Documentary evidence may be required, including a graveyard/Ghorkan certificate or parchi.

OFFICIAL VERIFIED EVIDENCE — ISLAMABAD CAPITAL TERRITORY DEATH REGISTRATION
Source: https://ictadministration.gov.pk/death-registration/
The ICT source lists required information: deceased's name/nationality; husband/father/mother and occupation; address; religion/sex/caste; date, time and cause of death; age; reporter's name/address; and date of report. It states submission at Citizen Facilitation Center, G-11/4, Islamabad, with a stated 7-day processing time. This is information required, not a separate physical-document checklist.

OFFICIAL VERIFIED EVIDENCE — SINDH DEATH REGISTRATION
Source: https://www.sindh.gov.pk/
No specific death-certificate document checklist was established from the retrieved official source.

OFFICIAL VERIFIED EVIDENCE — BALOCHISTAN DEATH REGISTRATION
Source: https://balochistan.gov.pk/wp-content/uploads/2024/10/Balochistan-Local-Government-Act-2010.pdf
No specific death-certificate document checklist was established from the retrieved official source.`;
    }
  }
}
const isCivilRegistration=requested==="Union Council" && civilRegistrationEvidence.length>0;
const officialUrls=isNadra?[]:isCivilRegistration?[]:Array.from(new Set([sourceUrl,...alternateOfficialUrls].filter(Boolean)));
let officialText="";
for(const u of officialUrls){const t=await fetchOfficialPage(u);if(t)officialText+=("\n\nOFFICIAL SOURCE PAGE: "+u+"\n"+t);}
const domains=isNadra?[]:(departmentDomains[canonicalDepartment(requested)]||[]);
const skipSearch=isCivilRegistration;
if(domains.length && !skipSearch){
 const searchText=await fetchOfficialSearch(question,domains);
 if(searchText)officialText+=searchText;
}
officialText=officialText.slice(0,10000);
const dbContext=isNadra?"Supabase records intentionally excluded for NADRA answers; use NADRA POLICY RAG EVIDENCE only.":(selected.records.length?context(selected.records,language):"No matching verified database record was found.");
  if(civilRegistrationEvidence) officialText=civilRegistrationEvidence;

 if(isCivilRegistration && language==="English"){
   const civilAnswer=cleanAnswer(
     civilRegistrationEvidence
       .replace(/^OFFICIAL VERIFIED EVIDENCE — /gm,"### ")
       .replace(/^Source: /gm,"**Source:** ")
   );
   return NextResponse.json({
     answer:civilAnswer,
     source:{
       department:sourceMeta.department,
       title:sourceMeta.title,
       url:sourceUrl,
       lastVerified:selected.records[0]?.last_verified||"",
       province:selected.jurisdiction||selected.records[0]?.province||""
     },
     agent:true,
     goalFocused:true,
     webSearch:false
   });
 }

 if(!selected.records.length&&!officialText&&!ragEvidence)return NextResponse.json({answer:noInfo(language),source:null});
 const system=`You are the central verified government information agent inside Pakistan Citizen Helper.

Your primary responsibility is to PROVIDE the citizen with the required answer. Do not send the citizen away to search another government website when the supplied official evidence contains the requested information.

Answer the citizen's EXACT question first. Be direct, practical, concise, and easy to read.

NON-NEGOTIABLE EVIDENCE RULES:
- Every factual claim must be supported by the supplied verified database record, retrieved official-government source text/search result, or NADRA POLICY RAG EVIDENCE.
- For NADRA Services, NADRA POLICY RAG EVIDENCE is the primary and authoritative evidence layer. Do not substitute the Supabase record or live webpage for the policy evidence when the RAG contains the answer.\n- For other departments, the verified database is the primary evidence layer and official government pages are the second evidence layer.\n- Never ignore supplied NADRA POLICY RAG EVIDENCE when answering a NADRA question.
- If the database is insufficient, use the retrieved official source evidence for the selected department and correct jurisdiction.
- Never use an unrelated department, service, or province merely because keywords match.
- Never fill gaps from memory, general knowledge, assumptions, or patterns.
- Never invent or guess fees, documents, eligibility, deadlines, procedures, office locations, processing times, vacancies, qualifications, or legal requirements.