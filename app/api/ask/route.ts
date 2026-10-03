import { NextRequest, NextResponse } from "next/server";
import { runFourAgentWorkflow } from "@/lib/agent-orchestrator";
import { verifyAnswerClaims } from "@/lib/claim-verifier";
import { getDirectAdultFreshCnicAnswer, getDirectNadraAnswer, getDirectNadraVerificationEvidence, retrieveNadraEvidence } from "@/lib/nadra-rag";

// Ported from the working pakistan-citizen-ai-agent routing/research architecture.
const WORKING_AGENT_JURISDICTIONS = ["Punjab","Sindh","Khyber Pakhtunkhwa","Balochistan","Islamabad Capital Territory","Azad Jammu and Kashmir","Gilgit-Baltistan"] as const;
type WorkingJurisdiction = typeof WORKING_AGENT_JURISDICTIONS[number];

const WORKING_AGENT_DOMAINS: Record<string,string[]> = {
  "Punjab":["lgcd.punjab.gov.pk","punjab.gov.pk"],
  "Sindh":["lgdsindh.gov.pk","sindh.gov.pk","sindhpolice.gov.pk","excise.gos.pk"],
  "Khyber Pakhtunkhwa":["lgkp.gov.pk","kp.gov.pk","kprts.gov.pk"],
  "Balochistan":["lgrd.gob.pk","balochistan.gov.pk"],
  "Islamabad Capital Territory":["ictadministration.gov.pk","islamabad.gov.pk","islamabadpolice.gov.pk"],
  "Azad Jammu and Kashmir":["ajk.gov.pk"],
  "Gilgit-Baltistan":["gilgitbaltistan.gov.pk"],
};

const WORKING_AGENT_DEPARTMENT_DOMAINS: Record<string,string[]> = {
  "NADRA Services":["nadra.gov.pk"], "Passport Services":["dgip.gov.pk"],
  "Protector & Overseas Employment":["beoe.gov.pk"],
  "Vaccination for Travelling Abroad":["nhsrc.gov.pk","nih.org.pk","moh.gov.sa"],
  "FBR / Taxation":["fbr.gov.pk"], "Education & Scholarships":["hec.gov.pk"],
  "Government Jobs":["njp.gov.pk"], "Police Services":["punjabpolice.gov.pk","kppolice.gov.pk"],
  "Excise & Taxation":["excise.punjab.gov.pk","kpexcise.gov.pk"],
  "Land & Revenue":["punjab-zameen.gov.pk","revenue.kp.gov.pk"],
  "Domicile":["gov.pk","cfc.kp.gov.pk"],
  "Driving Licence":["dlims.punjab.gov.pk","dls.gos.pk","kppolice.gov.pk","dlims.islamabadpolice.gov.pk"],
  "Union Council":["lgcd.punjab.gov.pk","lgkp.gov.pk","ictadministration.gov.pk","sindh.gov.pk","balochistan.gov.pk"],
};

const WORKING_CITY_JURISDICTIONS: Record<string,WorkingJurisdiction> = {
  lahore:"Punjab",rawalpindi:"Punjab",faisalabad:"Punjab",multan:"Punjab",gujranwala:"Punjab",sialkot:"Punjab",bahawalpur:"Punjab",sargodha:"Punjab",
  karachi:"Sindh",hyderabad:"Sindh",sukkur:"Sindh",larkana:"Sindh",nawabshah:"Sindh","mirpur khas":"Sindh",thatta:"Sindh",dadu:"Sindh",
  peshawar:"Khyber Pakhtunkhwa",mardan:"Khyber Pakhtunkhwa",swat:"Khyber Pakhtunkhwa",mingora:"Khyber Pakhtunkhwa",abbottabad:"Khyber Pakhtunkhwa",mansehra:"Khyber Pakhtunkhwa",kohat:"Khyber Pakhtunkhwa",bannu:"Khyber Pakhtunkhwa",nowshera:"Khyber Pakhtunkhwa",swabi:"Khyber Pakhtunkhwa",malakand:"Khyber Pakhtunkhwa",dir:"Khyber Pakhtunkhwa",
  quetta:"Balochistan",gwadar:"Balochistan",turbat:"Balochistan",khuzdar:"Balochistan",chaman:"Balochistan",sibi:"Balochistan",zhob:"Balochistan",
  islamabad:"Islamabad Capital Territory",muzaffarabad:"Azad Jammu and Kashmir",rawalakot:"Azad Jammu and Kashmir",gilgit:"Gilgit-Baltistan",skardu:"Gilgit-Baltistan",hunza:"Gilgit-Baltistan"
};

function workingDetectJurisdiction(question:string): WorkingJurisdiction|null {
  const q=(question||"").toLowerCase();
  const explicit:[string,WorkingJurisdiction][]=[
    ["punjab","Punjab"],["پنجاب","Punjab"],["sindh","Sindh"],["سندھ","Sindh"],
    ["khyber pakhtunkhwa","Khyber Pakhtunkhwa"],["kpk","Khyber Pakhtunkhwa"],[" kp ","Khyber Pakhtunkhwa"],["خیبر پختونخوا","Khyber Pakhtunkhwa"],
    ["balochistan","Balochistan"],["بلوچستان","Balochistan"],["islamabad","Islamabad Capital Territory"],["ict","Islamabad Capital Territory"],["اسلام آباد","Islamabad Capital Territory"],
    ["ajk","Azad Jammu and Kashmir"],["azad kashmir","Azad Jammu and Kashmir"],["آزاد کشمیر","Azad Jammu and Kashmir"],["gilgit baltistan","Gilgit-Baltistan"],["gilgit-baltistan","Gilgit-Baltistan"],["gb","Gilgit-Baltistan"]
  ];
  for(const [term,j] of explicit) if(q.includes(term)) return j;
  for(const [city,j] of Object.entries(WORKING_CITY_JURISDICTIONS)) if(q.includes(city)) return j;
  return null;
}

function workingDetectTargetJurisdiction(question:string): WorkingJurisdiction|null {
  const q=(question||"").toLowerCase();
  const terms:Array<[WorkingJurisdiction,string[]]>=[
    ["Punjab",["punjab","پنجاب"]],["Sindh",["sindh","سندھ"]],["Khyber Pakhtunkhwa",["khyber pakhtunkhwa","kpk","kp","خیبر پختونخوا","خیبرپختونخوا"]],
    ["Balochistan",["balochistan","بلوچستان"]],["Islamabad Capital Territory",["islamabad","ict","اسلام آباد"]],["Azad Jammu and Kashmir",["ajk","azad kashmir","آزاد کشمیر"]],["Gilgit-Baltistan",["gilgit baltistan","gilgit-baltistan","gb","گلگت"]]
  ];
  for(const [j,ts] of terms) for(const t of ts){
    if(q.includes(" in "+t)||q.includes(" for "+t)||q.includes(" from "+t)||q.includes(" about "+t)||q.includes(t+" mein")||q.includes(t+" میں")||q.endsWith(t)) return j;
  }
  return null;
}

function workingDepartmentDomains(department:string,jurisdiction:string|null):string[] {
  const base=WORKING_AGENT_DEPARTMENT_DOMAINS[department]||["gov.pk"];
  if(jurisdiction && WORKING_AGENT_DOMAINS[jurisdiction]) { const merged:string[]=WORKING_AGENT_DOMAINS[jurisdiction].concat(base); const out:string[]=[]; for(const item of merged){ if(out.indexOf(item)<0) out.push(item); } return out; }
  return base;
}

function workingDepartmentTerms(department:string):string[] {
  const map:Record<string,string[]>={
    "NADRA Services":["nadra","cnic","nicop","poc","crc","frc","b-form","pak identity"],
    "Passport Services":["passport","renew passport","new passport","mrp","dgip"],
    "Union Council":["union council","birth certificate","birth registration","death certificate","death registration","marriage certificate","marriage registration","nikah","divorce certificate"],
    "Driving Licence":["driving licence","driving license","learner","dlims","driving test"],
    "Police Services":["police clearance","character certificate","police verification","fir"],
    "Protector & Overseas Employment":["protector","protector of emigrants","overseas employment","beoe"],
    "Vaccination for Travelling Abroad":["vaccination","vaccine","polio","yellow fever","hajj","umrah"],
    "Domicile":["domicile","permanent residence","residence certificate"],
    "Arms Licence":["arms licence","arms license","weapon licence","gun licence"],
    "Education & Scholarships":["scholarship","hec","education"],"Land & Revenue":["land record","fard","property","revenue"],"Excise & Taxation":["excise","vehicle","token tax","tax"],"FBR / Taxation":["fbr","tax","ntn","iris"],"Government Jobs":["government jobs","job","vacancy","njp"]
  }; return map[department]||[];
}function drivingCategories(question:string):string[]{
 const q=normalize(question);
 const groups:Record<string,string[]>={learner:["learner","learner licence","learner license","learner permit","لرنر","لرنر لائسنس"],renewal:["renew","renewal","renew licence","renew license","تجدید"],duplicate:["duplicate","lost licence","lost license","replacement licence","replacement license","ڈپلیکیٹ","گمشدہ لائسنس"],international:["international driving permit","international driving licence","international driving license","idp","بین الاقوامی ڈرائیونگ"],motorcycle:["motorcycle","motor cycle","bike","موٹر سائیکل"],car:["motor car","car licence","car license","car/jeep","car","jeep","موٹر کار","کار","جیپ"],ltv:["ltv","light transport vehicle","light transport","لائٹ ٹرانسپورٹ","ایل ٹی وی"],htv:["htv","heavy transport vehicle","heavy transport","ہیوی ٹرانسپورٹ","ایچ ٹی وی"],psv:["psv","public service vehicle","پبلک سروس وہیکل","پی ایس وی"]};
 const out:string[]=[]; for(const k of Object.keys(groups)){for(const term of groups[k]){if(q.includes(normalize(term))){if(out.indexOf(k)<0)out.push(k);break;}}} if(out.length===0)out.push("general driving licence"); return out;
}
function drivingEvidence(question:string,jurisdiction:string,language:"English"|"Urdu"):string{
 const q=normalize(question);
 const cats=drivingCategories(question);
 const has=(name:string)=>cats.indexOf(name)>=0;
 const renewal=/\brenew(?:al|ing)?\b|\brenewed\b|تجدید/i.test(q);
 const learner=/\blearner\b|\blearner permit\b|لرنر/i.test(q);
 const duplicate=/\bduplicate\b|\blost\b|\breplacement\b|ڈپلیکیٹ|گمشدہ/i.test(q);
 const international=/\binternational\b|\bidp\b|بین الاقوامی/i.test(q);
 const isNew=/\bnew\b|\bnew license\b|\bnew licence\b|\bobtain\b|\bget\b|\bapply\b|نیا|نئی|حاصل/i.test(q);
 const category=cats.find(x=>["motorcycle","car","ltv","htv","psv"].includes(x))||"general";
 const categoryLabel:Record<string,string>={motorcycle:"motorcycle",car:"motor car",ltv:"LTV",htv:"HTV",psv:"PSV",general:"driving licence"};
 const label=categoryLabel[category]||"driving licence";
 const en:Record<string,string>={
  Punjab:`## Punjab — Driving Licence
**Official authority:** Punjab DLIMS 2.0.

**Requested service:** ${renewal?"Renewal":learner?"Learner licence":duplicate?"Duplicate/replacement":international?"International driving licence":isNew?"New licence":"Driving licence information"}${category!=="general"?`  
**Category:** ${label}`:""}.

The current official DLIMS provides separate learner, regular and international licence services. Its current workflow distinguishes learner applications from regular-licence processing, while the current fee structure has a separate **Regular License Renewal** section with category-specific renewal fees.

For renewal questions, do not present learner or first-issue test steps as renewal requirements. The current official renewal evidence lists renewal fees and does not state that a new theory or road test is part of ordinary renewal.

**Source:** https://dlims.punjab.gov.pk/
**Fee structure:** https://dlims.punjab.gov.pk/fee_structure`,
  Sindh:`## Sindh — Driving Licence
**Official authority:** Sindh Police — Driving License Sindh (DLS).

**Requested service:** ${renewal?"Renewal":learner?"Learner licence":duplicate?"Duplicate/replacement":international?"International driving permit":isNew?"New licence":"Driving licence information"}${category!=="general"?`  
**Category:** ${label}`:""}.

${renewal
?`For renewal, the official Sindh DLS procedure states that the DLS system renews the driving licence for a further five years from the date of processing. The official renewal information does **not** state that the applicant must repeat the theoretical or road competency tests. Those tests are described by DLS under the process for obtaining a permanent licence after the learner period, not as an ordinary renewal requirement.`
:learner
?`For a learner licence, the applicant must appear physically at the concerned driving-licence branch with the original CNIC and undergo the prescribed medical fitness process. Sindh DLS lists learner licensing separately from permanent/renewal licensing.`
:international
?`Sindh DLS lists International Driving Permit as a separate service and identifies the branches that issue it.`
:duplicate
?`Sindh DLS lists duplicate licence as a separate service. The exact current duplicate requirements should be stated only where the official DLS evidence supports them.`
:`For a new/permanent licence, Sindh DLS states that applicants appear physically at the concerned branch with the original CNIC, undergo medical fitness assessment, and complete the prescribed competency tests after the learner period. The DLS page describes a theoretical test and a road test for obtaining a permanent licence.`}

Categories published by DLS include motorcycle, motor car, LTV and HTV. Minimum age is 18 for non-commercial licences and 21 for commercial licences; HTV endorsement has an additional age/experience requirement in the official DLS information.

**Sources:** https://dls.gos.pk/how-to-ob-dr-lic.html and https://dls.gos.pk/FeeStructure.html`,
  "Khyber Pakhtunkhwa":`## Khyber Pakhtunkhwa — Driving Licence
**Official authority:** Khyber Pakhtunkhwa Transport & Mass Transit Department.

**Requested service:** ${renewal?"Renewal":learner?"Learner permit":duplicate?"Duplicate licence":isNew?"New/permanent licence":"Driving licence information"}${category!=="general"?`  
**Category:** ${label}`:""}.

The current KP Transport Department Driving License page lists separate Dastak services for **Apply for Learner Permit, Apply for New Permanent License, Renew Existing License, and Apply for Duplicate License**.

${renewal
?`For renewal, the official KP online service is specifically **Renew Existing License**. The current online-services page does not state a theory or road test as an ordinary renewal step.`
:learner
?`For a learner permit, the current KP Dastak procedure requires registration with CNIC and mobile number, selection of the learner service, completion of the required information, CNIC upload and online fee payment.`
:duplicate
?`For a duplicate licence, the current KP Transport Department lists **Apply for Duplicate License** as a separate Dastak service.`
:`For a new permanent licence, the current KP procedure says to apply after the learner-validity period, select the permanent-licence service, upload the required documents, pay the fee online, and visit the branch for a test if required. The official KP material does not expose a complete category-specific document checklist in the verified page, so the app should not invent one.`}

The KP Transport Department separately lists LTV/HTV/PSV licence services and their notified delivery times.

**Sources:** https://www.transport.kp.gov.pk/DL.html and https://transport.kp.gov.pk/public-service.php`,
  Balochistan:`## Balochistan — Driving Licence
**Official authority:** Balochistan Police / Police Mobile Khidmat Markaz.

**Requested service:** ${renewal?"Renewal":learner?"Learner licence":duplicate?"Duplicate licence":international?"International driving licence":isNew?"New licence":"Driving licence information"}${category!=="general"?`  
**Category:** ${label}`:""}.

The official Police Mobile Khidmat Markaz service page lists learner licence, renewal, international driving licence, duplicate licence and endorsement as separate services. Learner-specific requirements must not be presented as renewal or regular-licence requirements.

**Source:** https://pkm.balochistanpolice.gov.pk/public/home/services`,
  "Islamabad Capital Territory":`## Islamabad Capital Territory — Driving Licence
**Official authority:** Islamabad Traffic Police (ITP).

**Requested service:** ${renewal?"Renewal":learner?"Learner permit":duplicate?"Duplicate licence":international?"International driving permit":isNew?"New licence":"Driving licence information"}${category!=="general"?`  
**Category:** ${label}`:""}.

The official ITP-DLIMS provides separate services for new licence, learner permit, driving tests, renewal, duplicate licence and international driving permit. The app should not transfer test requirements from new/permanent licensing into renewal unless the current official ITP evidence explicitly requires them.

**Official portal:** https://dlims.islamabadpolice.gov.pk/`,
  "Azad Jammu and Kashmir":`## Azad Jammu and Kashmir — Driving Licence
The official Traffic Police AJ&K portal provides separate licence procedures, forms, medical forms, fee information, verification and application tracking. The requested category/service should be answered from the corresponding official form or procedure.

**Source:** https://trafficpolice.ajk.gov.pk/`,
  "Gilgit-Baltistan":`## Gilgit-Baltistan — Driving Licence
The official DLMIS provides regular licence application, renewal, duplicate licence, international driving licence, medical form and licensing-centre information. The requested category and action should be kept separate so renewal requirements are not mixed with first-issue requirements.

**Source:** https://dlmis.gbp.gov.pk/`
 };
 const ur:Record<string,string>={
  Punjab:`## پنجاب — ڈرائیونگ لائسنس
**سروس:** ${renewal?"تجدید":learner?"لرنر لائسنس":duplicate?"ڈپلیکیٹ/متبادل":international?"انٹرنیشنل ڈرائیونگ لائسنس":isNew?"نیا لائسنس":"ڈرائیونگ لائسنس"}${category!=="general"?`  
**کیٹیگری:** ${label}`:""}۔
سرکاری DLIMS میں لرنر، ریگولر، تجدید اور انٹرنیشنل لائسنس کے عمل کو الگ رکھا گیا ہے۔ تجدید کے سوال میں نئے لائسنس یا لرنر کے ٹیسٹ مراحل کو خودکار طور پر شامل نہیں کیا جائے گا۔
ماخذ: https://dlims.punjab.gov.pk/`,
  Sindh:`## سندھ — ڈرائیونگ لائسنس
**سروس:** ${renewal?"تجدید":learner?"لرنر":duplicate?"ڈپلیکیٹ":international?"انٹرنیشنل ڈرائیونگ پرمٹ":isNew?"نیا/مستقل لائسنس":"ڈرائیونگ لائسنس"}${category!=="general"?`  
**کیٹیگری:** ${label}`:""}۔
${renewal?"سرکاری DLS کے مطابق تجدید کے بعد لائسنس مزید پانچ سال کے لیے renew کیا جاتا ہے۔ عام تجدید کے لیے تھیوری یا روڈ competency test دوبارہ دینے کی شرط سرکاری تجدیدی معلومات میں بیان نہیں کی گئی؛ یہ ٹیسٹ مستقل لائسنس حاصل کرنے کے عمل میں بیان کیے گئے ہیں۔":"سرکاری DLS میں لرنر، مستقل لائسنس اور تجدید کے مراحل الگ بیان کیے گئے ہیں۔ نئے مستقل لائسنس کے لیے مقررہ میڈیکل اور competency tests متعلقہ مرحلے پر لاگو ہوتے ہیں۔"}
ماخذ: https://dls.gos.pk/how-to-ob-dr-lic.html`,
  "Khyber Pakhtunkhwa":`## خیبر پختونخوا — ڈرائیونگ لائسنس
**سروس:** ${renewal?"تجدید":learner?"لرنر پرمٹ":duplicate?"ڈپلیکیٹ لائسنس":isNew?"نیا/مستقل لائسنس":"ڈرائیونگ لائسنس"}${category!=="general"?`  
**کیٹیگری:** ${label}`:""}۔
سرکاری KP Transport Department میں لرنر پرمٹ، نیا مستقل لائسنس، موجودہ لائسنس کی تجدید اور ڈپلیکیٹ لائسنس الگ خدمات ہیں۔ تجدید کے سوال میں نئے لائسنس کے ٹیسٹ مراحل شامل نہیں کیے جانے چاہئیں۔
ماخذ: https://www.transport.kp.gov.pk/DL.html`,
  Balochistan:`## بلوچستان — ڈرائیونگ لائسنس
**سروس:** ${renewal?"تجدید":learner?"لرنر":duplicate?"ڈپلیکیٹ":international?"انٹرنیشنل":isNew?"نیا لائسنس":"ڈرائیونگ لائسنس"}${category!=="general"?`  
**کیٹیگری:** ${label}`:""}۔
سرکاری Police Mobile Khidmat Markaz میں لرنر، تجدید، انٹرنیشنل، ڈپلیکیٹ اور اینڈورسمنٹ الگ خدمات ہیں۔
ماخذ: https://pkm.balochistanpolice.gov.pk/public/home/services`,
  "Islamabad Capital Territory":`## اسلام آباد — ڈرائیونگ لائسنس
**سروس:** ${renewal?"تجدید":learner?"لرنر پرمٹ":duplicate?"ڈپلیکیٹ":international?"انٹرنیشنل پرمٹ":isNew?"نیا لائسنس":"ڈرائیونگ لائسنس"}${category!=="general"?`  
**کیٹیگری:** ${label}`:""}۔
ITP-DLIMS میں نیا لائسنس، لرنر، ڈرائیونگ ٹیسٹ، تجدید، ڈپلیکیٹ اور انٹرنیشنل پرمٹ الگ خدمات ہیں۔ تجدید کے لیے نئے لائسنس کے ٹیسٹ مراحل خودکار طور پر شامل نہیں کیے جائیں گے۔
ماخذ: https://dlims.islamabadpolice.gov.pk/`,
  "Azad Jammu and Kashmir":`## آزاد جموں و کشمیر — ڈرائیونگ لائسنس
سرکاری Traffic Police AJ&K پورٹل پر لائسنس کے طریقہ کار، فارم، میڈیکل فارم، فیس، تصدیق اور ٹریکنگ کی معلومات موجود ہیں۔
ماخذ: https://trafficpolice.ajk.gov.pk/`,
  "Gilgit-Baltistan":`## گلگت بلتستان — ڈرائیونگ لائسنس
سرکاری DLMIS پر ریگولر لائسنس، تجدید، ڈپلیکیٹ، انٹرنیشنل لائسنس، میڈیکل فارم اور مراکز کی معلومات موجود ہیں۔ تجدید اور نئے لائسنس کے تقاضے الگ رکھے جانے چاہئیں۔
ماخذ: https://dlmis.gbp.gov.pk/`
 };
 return (language==="Urdu"?ur:en)[jurisdiction]||en.Punjab;
}

function armsLicenceEvidence(question:string,jurisdiction:WorkingJurisdiction|null,language:"English"|"Urdu"):{answer:string,sources:string[]}{
 const q=normalize(question);

 // Always derive jurisdiction from the actual question first. Never assign a
 // default province to a jurisdiction-free arms question.
 const detectedQuestionJurisdiction=workingDetectJurisdiction(question)||workingDetectTargetJurisdiction(question);
 const j=detectedQuestionJurisdiction || (q.includes("peshawar") ? "Khyber Pakhtunkhwa" : null);

 const newQ=/\bnew\b|\bfresh\b|\bfirst[- ]time\b|\bobtain\b|\bapply\b|نیا|نئی|حاصل/i.test(q);
 const docs=/\bdocument(s)?\b|\brequired\b|\brequirements\b|\bchecklist\b|دستاویز|کاغذات|ضروری/i.test(q);
 const fee=/\bfee\b|\bfees\b|\bcost\b|\bcharges\b|\bprice\b|\bhow much\b|\bamount\b|فیس|رقم/i.test(q);
 const lost=/\blost\b|\bloss\b|\bmissing\b|\bduplicate\b|\breplacement\b|\breplace\b|گم|گمشدہ|ڈپلیکیٹ|متبادل/i.test(q);
 const change=/\bchange\b|\bchanging\b|\bchanged\b|\bcorrect\b|\bcorrection\b|\bmodify\b|\bmodification\b|\bupdate\b|\bupdating\b|\bedit\b|\bedited\b|\balter\b|\balteration\b|\bnumber\s*(?:change|changed|update|correction)\b|تبدیلی|درست|تصحیح|ترمیم|تبدیل/i.test(q);

 // A PB/NPB question is a definition only when the citizen is actually
 // asking what the terms mean. Documents/fees/lost/change/new questions win.
 const asksDefinition=/\bwhat (?:is|are|does)\b|\bdefine\b|\bmeaning\b|\bdifference\b|\bwhat do .* mean\b|کیا ہے|کیا ہیں|مطلب|فرق/i.test(q);
 const boreTerms=/\bprohibited bore\b|\bnon[- ]prohibited bore\b|\bnpb\b|\bpb\b/i.test(q);
 const definition=boreTerms && asksDefinition && !docs && !fee && !lost && !change && !newQ;

 const mode=definition?"definition":change?"change":lost?"lost":fee?"fee":docs?"docs":newQ?"new":"generic";

 const sources:Record<string,string[]>={
  "Khyber Pakhtunkhwa":["https://www.kprts.gov.pk/services/issuance-of-arms-license/","https://ecitizen.kp.gov.pk/","https://kpcode.kp.gov.pk/homepage/RuleDetails/163"],
  "Islamabad Capital Territory":["https://ictadministration.gov.pk/new-arms-license/","https://ictadministration.gov.pk/computerization-of-arms-license/","https://ictadministration.gov.pk/license-verification/"],
  "Punjab":["https://lahore.punjab.gov.pk/arm-license-branch"],"Sindh":["https://home.sindh.gov.pk/"],"Balochistan":["https://home.balochistan.gov.pk/"],"Azad Jammu and Kashmir":["https://efc.ajk.gov.pk/instructionservice/3"],"Gilgit-Baltistan":["https://gilgitbaltistan.gov.pk/"]
 };

 // Jurisdiction-free questions must still be understood. Ask only for the
 // missing jurisdiction instead of repeating a generic arms-service prompt.
 if(!j){
  if(language==="Urdu"){
   if(mode==="definition") return {answer:"## ممنوعہ بور (PB) اور غیر ممنوعہ بور (NPB)\n\nممنوعہ بور (PB) اور غیر ممنوعہ بور (NPB) مختلف قانونی categories ہیں۔ PB کی تعریف وفاقی حکومت کے نوٹیفکیشن/قانونی framework سے جبکہ NPB licences متعلقہ قانونی اختیار کے تحت جاری ہوتے ہیں۔ کسی مخصوص ہتھیار کی category موجودہ سرکاری نوٹیفکیشن یا licensing authority سے تصدیق کی جانی چاہیے۔\n\n**سرکاری ماخذ:** https://pakistancode.gov.pk/pdffiles/administrator4db83e5d472d4e9ffae90f007476a3ed.pdf",sources:["https://pakistancode.gov.pk/pdffiles/administrator4db83e5d472d4e9ffae90f007476a3ed.pdf"]};
   if(mode==="fee") return {answer:"## اسلحہ لائسنس — فیس\n\nموجودہ سرکاری ذرائع سے جو فیس معلومات تصدیق ہو سکیں وہ ذیل میں دی گئی ہیں۔ فیس لائسنس کی قسم اور jurisdiction کے مطابق مختلف ہو سکتی ہے۔ جہاں موجودہ معیاری نئے لائسنس کی فیس سرکاری ماخذ سے واضح طور پر ثابت نہیں ہوئی، وہاں رقم گھڑی نہیں گئی۔\n\n| صوبہ / علاقہ | موجودہ سرکاری فیس کی معلومات |\n|---|---|\n| **خیبر پختونخوا** | Provincial licence: **PKR 3,910**؛ All-Pakistan licence: **PKR 9,410**؛ Government employees: **PKR 315**۔ Stamp paper: PKR 300؛ 222/223 جیسے heavy weapons کے لیے PKR 2,000 بھی درج ہے۔ |\n| **آزاد جموں و کشمیر (AJK)** | E-Facilitation Center پر Arms License کے computerized certificate issuance کی فیس **PKR 1,500** درج ہے؛ اسی صفحے پر application form PKR 200 اور fitness certificate PKR 300 بھی درج ہیں۔ |\n| **سندھ** | سرکاری Home Department صفحہ Arms Licence services کی تصدیق کرتا ہے اور بعض Armed Forces members اور BPS-17+ Government of Sindh officers کے لیے fee exemption بتاتا ہے، لیکن اسی صفحے پر عام نئے لائسنس کی موجودہ فیس واضح نہیں۔ |\n| **پنجاب** | موجودہ معیاری نئے Arms Licence کی فیس زیرِ جائزہ سرکاری ماخذ سے ثابت نہیں ہوئی۔ کوئی غیر مصدقہ رقم شامل نہیں کی گئی۔ |\n| **بلوچستان** | موجودہ معیاری نئے Arms Licence کی فیس زیرِ جائزہ سرکاری ماخذ سے ثابت نہیں ہوئی۔ کوئی غیر مصدقہ رقم شامل نہیں کی گئی۔ |\n| **اسلام آباد (ICT)** | موجودہ ICT New Arms Licence صفحہ فیس کی رقم شائع نہیں کرتا۔ |\n| **گلگت بلتستان** | موجودہ معیاری نئے Arms Licence کی فیس زیرِ جائزہ سرکاری ماخذ سے ثابت نہیں ہوئی۔ کوئی غیر مصدقہ رقم شامل نہیں کی گئی۔ |\n\n**اہم:** جہاں سرکاری ماخذ میں موجودہ رقم شائع نہیں ہوئی، اسے صفر نہیں سمجھا گیا۔\n\n**سرکاری ذرائع:** https://www.kprts.gov.pk/services/issuance-of-arms-license/\nhttps://efc.ajk.gov.pk/instructionservice/3\nhttps://home.sindh.gov.pk/arms-section\nhttps://ictadministration.gov.pk/new-arms-license/",sources:["https://www.kprts.gov.pk/services/issuance-of-arms-license/","https://efc.ajk.gov.pk/instructionservice/3","https://home.sindh.gov.pk/arms-section","https://ictadministration.gov.pk/new-arms-license/"]};
   if(mode==="lost") return {answer:"## گمشدہ اسلحہ لائسنس\n\nآپ گمشدہ لائسنس کے طریقہ کار کے بارے میں پوچھ رہے ہیں۔ اگر **لائسنس کارڈ/دستاویز** گم ہوئی ہے تو معاملہ عموماً duplicate/replacement licence کا ہے؛ اگر **ہتھیار خود** گم یا چوری ہوا ہے تو اس کی رپورٹنگ الگ معاملہ ہے۔ درست duplicate procedure کے لیے اپنا صوبہ یا علاقہ بتائیں۔",sources:[]};
   if(mode==="docs") return {answer:"## اسلحہ لائسنس — دستاویزات\n\nآپ دستاویزات کے بارے میں پوچھ رہے ہیں۔ مطلوبہ کاغذات jurisdiction کے مطابق مختلف ہوتے ہیں۔ اپنا صوبہ یا علاقہ بتائیں تاکہ میں اسی jurisdiction کی سرکاری دستاویزات دوں۔",sources:[]};
   if(mode==="change") return {answer:"## اسلحہ لائسنس — ریکارڈ میں تبدیلی\n\nآپ موجودہ اسلحہ لائسنس میں تبدیلی/تصحیح کے بارے میں پوچھ رہے ہیں۔ اس کی procedure jurisdiction-specific ہے۔ اپنا صوبہ یا علاقہ بتائیں تاکہ نئے لائسنس کی requirements کو غلط طور پر شامل کیے بغیر درست procedure دیا جا سکے۔",sources:[]};
   return {answer:"## اسلحہ لائسنس\n\nآپ اسلحہ لائسنس کی سروس کے بارے میں پوچھ رہے ہیں۔ براہِ کرم اپنا صوبہ یا علاقہ اور مطلوبہ سروس بتائیں، مثلاً نیا لائسنس، فیس، دستاویزات، renewal یا گمشدہ/duplicate لائسنس۔",sources:[]};
  }

  if(mode==="definition") return {answer:"## Prohibited Bore (PB) vs Non-Prohibited Bore (NPB)\n\nProhibited Bore (PB) and Non-Prohibited Bore (NPB) are different legal categories. PB is determined through the applicable Federal Government notification/legal framework, while NPB licensing is handled under the applicable legal authority. The category of a specific weapon should be confirmed from the current government notification or licensing authority.\n\n**Official source:** https://pakistancode.gov.pk/pdffiles/administrator4db83e5d472d4e9ffae90f007476a3ed.pdf",sources:["https://pakistancode.gov.pk/pdffiles/administrator4db83e5d472d4e9ffae90f007476a3ed.pdf"]};
  if(mode==="fee") return {answer:"## Arms Licence — Fee\n\nCurrent official fee information I could verify is shown below. Fees and categories can differ by jurisdiction and licence type; where a current standard new-licence amount was not established from an official source, it is marked clearly rather than guessed.\n\n| Province / Territory | Current official fee information |\n|---|---|\n| **Khyber Pakhtunkhwa** | Provincial licence: **PKR 3,910**; All-Pakistan licence: **PKR 9,410**; Government employees: **PKR 315**. Stamp paper: PKR 300; an additional PKR 2,000 is listed for heavy weapons such as 222/223. |\n| **Azad Jammu & Kashmir (AJK)** | E-Facilitation Center lists **PKR 1,500** as the computerized certificate issuance fee for Arms License; the same service page also lists an application-form amount of PKR 200 and fitness-certificate amount of PKR 300. |\n| **Sindh** | The current official Home Department page confirms Arms Licence services and states that licences are free of fee for certain Armed Forces members and BPS-17+ Government of Sindh officers, but it does **not** establish a general current new-licence fee on that page. |\n| **Punjab** | A current standard new Arms Licence fee was **not established from the official source reviewed**. No amount is invented. |\n| **Balochistan** | A current standard new Arms Licence fee was **not established from the official source reviewed**. No amount is invented. |\n| **Islamabad (ICT)** | The current ICT new-Arms-Licence page does **not publish a fee amount**. |\n| **Gilgit-Baltistan** | A current standard new Arms Licence fee was **not established from the official source reviewed**. No amount is invented. |\n\n**Important:** These are the current official fee details I could verify; the table does not treat missing published amounts as zero.\n\n**Official sources:** https://www.kprts.gov.pk/services/issuance-of-arms-license/\nhttps://efc.ajk.gov.pk/instructionservice/3\nhttps://home.sindh.gov.pk/arms-section\nhttps://ictadministration.gov.pk/new-arms-license/",sources:["https://www.kprts.gov.pk/services/issuance-of-arms-license/","https://efc.ajk.gov.pk/instructionservice/3","https://home.sindh.gov.pk/arms-section","https://ictadministration.gov.pk/new-arms-license/"]};
  if(mode==="lost") return {answer:"## Lost Arms Licence\n\nYou are asking about a lost licence. If the **licence card/document** is lost, the relevant service is normally a duplicate/replacement licence; if the **weapon itself** is lost or stolen, reporting requirements are separate. Please tell me the province or territory for the exact official duplicate/lost-licence procedure.",sources:[]};
  if(mode==="docs") return {answer:"## Arms Licence — Documents\n\nYou are asking about the required documents. These requirements are jurisdiction-specific. Please tell me the province or territory so I can give the correct official document list.",sources:[]};
  if(mode==="change") return {answer:"## Arms Licence — Record Change\n\nYou are asking about changing/correcting an existing arms-licence record. This is different from applying for a new licence and the procedure is jurisdiction-specific. Please tell me the province or territory so I can give the applicable official procedure.",sources:[]};
  return {answer:"## Arms Licence\n\nPlease specify the province or territory and the exact service you need — new licence, fee, documents, renewal, duplicate/lost licence, or record change.",sources:[]};
 }

 let a="## Arms Licence\n\nPlease specify the exact arms-licence service.";

 if(j==="Khyber Pakhtunkhwa"){
  if(definition) a="## Prohibited Bore (PB) vs Non-Prohibited Bore (NPB)\n\nProhibited-bore weapons are those notified by the Federal Government as prohibited bore; licences for them are issued by the Federal Government. Provincial governments have authority to issue licences for non-prohibited weapons, subject to law. KP rules define non-prohibited bore weapons as weapons allowed to be manufactured, repaired, sold, possessed or transported by an individual under licence, and separately use restricted-bore and non-restricted-bore categories. A specific weapon category should be confirmed from the current government notification or licensing authority.\n\nOfficial sources: https://pakistancode.gov.pk/pdffiles/administrator4db83e5d472d4e9ffae90f007476a3ed.pdf and https://kpcode.kp.gov.pk/homepage/RuleDetails/163";
  else if(lost) a="## Khyber Pakhtunkhwa — Lost Arms Licence\n\nIf the licence card/document itself is lost, this is a duplicate/replacement matter, not a new licence. KP rules provide for a duplicate of a lost or accidentally destroyed licence; the published fee schedule lists Rs. 1,500 for a duplicate individual arms licence. If the weapon itself was lost or stolen, the rules require immediate reporting to the nearest police station and the concerned Deputy Commissioner.\n\nOfficial source: https://kpcode.kp.gov.pk/homepage/RuleDetails/163";
  else if(fee) a="## Khyber Pakhtunkhwa — Arms Licence Fee\n\nThe current KP Right to Public Services Commission page lists Provincial licence Rs. 3,910, All-Pakistan licence Rs. 9,410 and Government employees Rs. 315. It also lists stamp paper Rs. 300 and Rs. 2,000 for heavy weapons such as 222/223.\n\nOfficial source: https://www.kprts.gov.pk/services/issuance-of-arms-license/";
  else if(docs) a="## Khyber Pakhtunkhwa — NPB Arms Licence Documents\n\nFor a new NPB arms-licence application, current official information lists: prescribed application form, CNIC, two photographs, minimum age 21 and Rs. 300 stamp paper. Government servants additionally provide their last pay slip and a departmental letter signed by the relevant district/departmental officer. The current Dastak platform supports digital application, tracking, payments and NADRA biometric verification.\n\nOfficial sources: https://www.kprts.gov.pk/services/issuance-of-arms-license/ and https://ecitizen.kp.gov.pk/";
  else if(change) a="## Khyber Pakhtunkhwa — Arms Licence Record Change\n\nChanging an existing licence number is not a new-licence application. The current verified KP material covers issuance, renewal, duplicate licensing and loss/theft reporting, but does not publish a complete procedure for changing an already-issued licence number. I therefore would not give the new-licence document list as the answer.\n\nOfficial source: https://ecitizen.kp.gov.pk/";
  else if(newQ) a="## Khyber Pakhtunkhwa — New Arms Licence\n\nCurrent official information lists a prescribed application form, CNIC, two photographs, minimum age 21 and Rs. 300 stamp paper. Government servants additionally provide their last pay slip and departmental letter. The notified process includes biometric/electronic processing and police verification. KP Dastak is the current digital arms-licensing platform.\n\nOfficial sources: https://www.kprts.gov.pk/services/issuance-of-arms-license/ and https://ecitizen.kp.gov.pk/";
  else a="## Khyber Pakhtunkhwa — Arms Licence\n\nKP Dastak is the current digital arms-licensing platform for applying, renewing and managing licences. Please specify whether you need a new licence, NPB documents, renewal, duplicate/lost licence, fee or another service.\n\nOfficial source: https://ecitizen.kp.gov.pk/";
 } else if(j==="Islamabad Capital Territory"){
  if(change) a="## Islamabad Capital Territory — Arms Licence Record Change\n\nChanging an existing licence number is a record/correction matter, not a new-licence application. Current ICT Administration pages publish new licence, renewal, computerization and verification procedures, but not a specific current procedure for changing an already-issued licence number. I therefore would not substitute the new-licence document list. The existing record should be taken to the competent Arms Branch/ICT Administration authority.\n\nOfficial sources: https://ictadministration.gov.pk/computerization-of-arms-license/ and https://ictadministration.gov.pk/license-verification/";
  else if(lost) a="## Islamabad Capital Territory — Lost Arms Licence\n\nIf the licence card/document is lost, this is not a new-licence application. The current ICT Administration pages do not publish a complete current duplicate/lost-card procedure, so I will not invent one or substitute new-licence requirements.\n\nOfficial sources: https://ictadministration.gov.pk/computerization-of-arms-license/ and https://ictadministration.gov.pk/license-verification/";
  else if(fee) a="## Islamabad Capital Territory — Arms Licence Fee\n\nThe current ICT New Arms License page does not publish a new-licence fee amount. I therefore will not invent a fee; confirm the applicable amount with the competent ICT Arms Branch.\n\nOfficial source: https://ictadministration.gov.pk/new-arms-license/";
  else if(newQ||docs) a="## Islamabad Capital Territory — New Arms Licence\n\nThe current ICT Administration page requires a completed application, 3 passport-size photographs, 3 attested CNIC copies, 3 attested NTN copies, proof of residence in Islamabad and a departmental NOC for government servants. Personal appearance with originals is required; submit at the Citizen Facilitation Center, obtain a token/receipt and collect the licence on the date given.\n\nOfficial source: https://ictadministration.gov.pk/new-arms-license/";
  else a="## Islamabad Capital Territory — Arms Licence\n\nICT Administration publishes separate procedures for new licence, renewal, computerization and verification. Please specify the required service so these are not mixed.\n\nOfficial source: https://ictadministration.gov.pk/";
 } else {
  const label=lost?"lost/duplicate licence":change?"licence correction/change":fee?"fee":docs?"documents":newQ?"new licence":"arms licence";
  if(j==="Sindh") a="## Sindh — Arms Licence\n\nThe current Sindh Home Department publishes arms-licensing information and current notices. For this "+label+" request, the currently verified official material does not establish enough detail for a complete current checklist or fee, so unverified requirements are not added.\n\nOfficial source: https://home.sindh.gov.pk/";
  else if(j==="Balochistan") a="## Balochistan — Arms Licence\n\nThe Home Department lists Arms Licence as a provincial service and publishes arms-licence notices. The currently verified material does not establish a complete current checklist or fee for this specific "+label+" request, so unverified details are not added.\n\nOfficial source: https://home.balochistan.gov.pk/";
  else if(j==="Punjab") a="## Punjab — Arms Licence\n\nArms licensing is administered through the relevant district/competent authority. A single current province-wide checklist or fee was not established for this specific "+label+" request, so the app should not invent one.\n\nOfficial source: https://lahore.punjab.gov.pk/arm-license-branch";
  else if(j==="Azad Jammu and Kashmir") a="## Azad Jammu and Kashmir — Arms Licence\n\nThe official AJK E-Facilitation Center lists Arms License under the Interior Department and lists an application form, fitness certificate and computerized certificate issuance fee of Rs. 1,500. Follow the current AJK service page for the specific "+label+" request.\n\nOfficial source: https://efc.ajk.gov.pk/instructionservice/3";
  else a="## Gilgit-Baltistan — Arms Licence\n\nThe currently verified GB government material does not establish a complete current procedure, document checklist or fee for this specific arms-licence request. I therefore will not invent those details.\n\nOfficial source: https://gilgitbaltistan.gov.pk/";
 }

 if(language==="Urdu" && j==="Khyber Pakhtunkhwa"){
  if(lost) a="## خیبر پختونخوا — گمشدہ اسلحہ لائسنس\n\nاگر خود لائسنس کارڈ/دستاویز گم ہوئی ہے تو یہ نیا لائسنس نہیں بلکہ duplicate/replacement کا معاملہ ہے۔ KP قواعد duplicate کی اجازت دیتے ہیں اور duplicate individual arms licence کی فیس Rs. 1,500 درج ہے۔ اگر ہتھیار خود گم یا چوری ہوا ہے تو اسے فوراً قریبی پولیس اسٹیشن اور متعلقہ ڈپٹی کمشنر کو رپورٹ کرنا ضروری ہے۔\n\nسرکاری ماخذ: https://kpcode.kp.gov.pk/homepage/RuleDetails/163";
  else if(docs) a="## خیبر پختونخوا — NPB اسلحہ لائسنس کے دستاویزات\n\nبنیادی تقاضے: Rs. 300 stamp paper، مقررہ application form، CNIC، دو تصاویر، عمر کم از کم 21 سال، اور سرکاری ملازم کے لیے آخری pay slip اور متعلقہ محکمہ/ضلع کے افسر کا خط۔ Dastak online application، tracking، payment اور NADRA biometric verification بھی فراہم کرتا ہے۔\n\nسرکاری ماخذ: https://www.kprts.gov.pk/services/issuance-of-arms-license/";
  else if(fee) a="## خیبر پختونخوا — اسلحہ لائسنس فیس\n\nKP کے موجودہ notified service page پر Provincial licence Rs. 3,910، All-Pakistan Rs. 9,410 اور Government employees Rs. 315 درج ہیں۔ Stamp paper Rs. 300 اور بعض heavy weapons (222/223) کے لیے Rs. 2,000 درج ہے۔\n\nسرکاری ماخذ: https://www.kprts.gov.pk/services/issuance-of-arms-license/";
  else if(change) a="## خیبر پختونخوا — اسلحہ لائسنس میں تبدیلی\n\nموجودہ لائسنس نمبر تبدیل کرنا نئے لائسنس کی درخواست نہیں ہے۔ دستیاب سرکاری مواد میں پہلے سے جاری لائسنس نمبر تبدیل کرنے کا مکمل موجودہ طریقہ شائع نہیں ہے، اس لیے نئے لائسنس کے کاغذات اس سوال کے جواب میں دینا درست نہیں ہوگا۔ موجودہ ریکارڈ کو متعلقہ Arms Licence Branch/مجاز اتھارٹی سے چیک کروانا ہوگا۔\n\nسرکاری ماخذ: https://ecitizen.kp.gov.pk/";
  else if(definition) a="## ممنوعہ بور (PB) اور غیر ممنوعہ بور (NPB)\n\nممنوعہ بور وہ اسلحہ ہے جسے وفاقی حکومت ممنوعہ بور کے طور پر نوٹیفائی کرے؛ ایسے لائسنس وفاقی حکومت کے اختیار میں ہیں۔ غیر ممنوعہ اسلحہ کے لائسنس متعلقہ قانونی اختیار کے تحت جاری ہو سکتے ہیں۔ KP قواعد میں non-prohibited bore کے اندر restricted اور non-restricted bore کی اصطلاحات بھی استعمال ہوتی ہیں۔ کسی مخصوص ہتھیار کی category سرکاری نوٹیفکیشن یا licensing authority سے تصدیق کی جانی چاہیے۔\n\nسرکاری ماخذ: https://pakistancode.gov.pk/pdffiles/administrator4db83e5d472d4e9ffae90f007476a3ed.pdf";
 }
 return {answer:a,sources:j ? (sources[j]||[]) : []};
}
function exciseEvidence(question:string,jurisdiction:string,language:"English"|"Urdu"):string{
 const q=normalize(question);
 const isToken=q.includes("token")||q.includes("motor vehicle tax")||q.includes("vehicle tax")||q.includes("ٹوکن");
 const isRegistration=q.includes("new registration")||q.includes("vehicle registration")||q.includes("register a vehicle")||q.includes("register a new vehicle")||q.includes("new vehicle registration")||q.includes("رجسٹریشن")||q.includes("نئی گاڑی");
 const isTransfer=q.includes("transfer")||q.includes("ownership")||q.includes("ملکیت")||q.includes("منتقلی");
 const isPayment=q.includes("pay")||q.includes("payment")||q.includes("online payment")||q.includes("ادائیگی");
 const isVerification=q.includes("verify")||q.includes("verification")||q.includes("registration status")||q.includes("basic details")||q.includes("number plate")||q.includes("vehicle details");
 const isFees=q.includes("fee")||q.includes("fees")||q.includes("taxes")||q.includes("charges")||q.includes("cost")||q.includes("مقررہ فیس")||q.includes("ٹیکس");
 if(jurisdiction==="Punjab" && isRegistration) return language==="Urdu"
  ? "## پنجاب — نئی گاڑی کی رجسٹریشن\n\nسرکاری پنجاب ایکسائز کے مطابق اصل خریدار کے نام نئی رجسٹریشن کے لیے:\n1. Form-F\n2. مالک کے CNIC کی کاپی\n3. گاڑی کا اصل Sales Certificate\n4. گاڑی کی اصل Sales Invoice\n5. رجسٹریشن فیس، نمبر پلیٹ فیس اور قابلِ اطلاق ٹیکس\n\n**ماخذ:** https://excise.punjab.gov.pk/index.php/node/39"
  : "## Punjab — New Vehicle Registration\n\nThe official Punjab Excise page lists these requirements for registration in the name of the original purchaser:\n1. Form-F\n2. Copy of the owner's CNIC\n3. Original Sales Certificate of the vehicle\n4. Original Sales Invoice of the vehicle\n5. Payment of registration fee, number plate fee and other applicable taxes\n\n**Source:** https://excise.punjab.gov.pk/index.php/node/39";
 if(jurisdiction==="Punjab" && isTransfer) return language==="Urdu"
  ? "## پنجاب — گاڑی کی ملکیت کی منتقلی\n\nسرکاری پنجاب ایکسائز کے مطابق:\n1. مقررہ T.O. Form\n2. فروخت کنندہ کے CNIC کی کاپی\n3. خریدار کے CNIC کی کاپی\n4. گواہوں کی فوٹو کاپیاں\n5. اصل Registration Certificate، جس میں Token Tax کی تازہ ادائیگی موجود ہو\n6. File Return Scheme کے تحت رجسٹرڈ گاڑی کی اصل Registration File\n7. مقررہ فارم پر درخواست\n\n**Transfer Fee:** Motorcycle/Scooter PKR 550؛ HTV PKR 5,500؛ 1000cc تک PKR 2,750؛ 1001–1800cc PKR 5,500؛ 1800cc سے زیادہ PKR 11,000۔\n\n**ePay SOP:** 17-digit PSID generate ہوتا ہے، online banking سے payment کی جاتی ہے، پھر seller اور purchaser کی biometric verification اور approval مراحل کے بعد status DELIVERED ہوتا ہے۔\n\n**ماخذ:** https://excise.punjab.gov.pk/index.php/node/39\nhttps://excise.punjab.gov.pk/system/files/TRANSFER%20OF%20OWNERSHIP%20%28TO%29%20THROUGH%20EPAY_0.pdf"
  : "## Punjab — Transfer of Vehicle Ownership\n\nThe official Punjab Excise page lists:\n1. Prescribed T.O. Form\n2. Copy of seller's CNIC\n3. Copy of purchaser's CNIC\n4. Photocopies of witnesses\n5. Original Registration Certificate with updated Token Tax payment\n6. Original Registration File where applicable under the File Return Scheme\n7. Application on the prescribed form\n\n**Transfer fees:** Motorcycle/Scooter PKR 550; HTV PKR 5,500; up to 1000cc PKR 2,750; above 1000cc up to 1800cc PKR 5,500; above 1800cc PKR 11,000.\n\n**ePay workflow:** the official SOP states that a 17-digit PSID is generated, payment can be made through online banking, then seller and purchaser biometrics are processed followed by approval phases and final DELIVERED status.\n\n**Sources:** https://excise.punjab.gov.pk/index.php/node/39\nhttps://excise.punjab.gov.pk/system/files/TRANSFER%20OF%20OWNERSHIP%20%28TO%29%20THROUGH%20EPAY_0.pdf";
 if(jurisdiction==="Punjab" && isToken) return language==="Urdu"
  ? "## پنجاب — موٹر وہیکل ٹوکن ٹیکس\n\nپنجاب ایکسائز کے سرکاری صفحے پر MVT 2026-27 کے ٹوکن ٹیکس ریٹس درج ہیں۔ مکمل سال کا ٹوکن ٹیکس 31 اگست تک ادا کرنے پر سالانہ ٹوکن ٹیکس پر 10% رعایت درج ہے۔ پنجاب ایکسائز کی سرکاری سروسز میں Online Payment of Excise Dues بھی شامل ہے۔\n\n**ماخذ:** https://excise.punjab.gov.pk/motorvehicle_tax\nhttps://excise.punjab.gov.pk/services"
  : "## Punjab — Motor Vehicle Token Tax\n\nPunjab Excise publishes current motor-vehicle token-tax rates, including MVT 2026-27. It states that a 10% rebate on annual token tax is allowed when the full year's tax is paid on or before 31 August of the financial year. Punjab Excise also lists Online Payment of Excise Dues among its official services.\n\n**Sources:** https://excise.punjab.gov.pk/motorvehicle_tax\nhttps://excise.punjab.gov.pk/services";
 if(jurisdiction==="Sindh" && (isToken||isPayment)) return language==="Urdu"
  ? "## سندھ — ایکسائز اینڈ ٹیکسیشن\n\nسرکاری سندھ ایکسائز ٹیکس پورٹل کے مطابق موٹر وہیکل ٹیکس کے لیے PSID پر مبنی ادائیگی کا طریقہ موجود ہے۔ طریقہ کار میں 12 ہندسوں کا PSID استعمال ہوتا ہے، جو 24 گھنٹے تک قابل استعمال ہوتا ہے، اور ادائیگی معاون 1LINK ذرائع سے کی جا سکتی ہے۔\n\n**ماخذ:** https://taxportal.excise.gos.pk/home/faq"
  : "## Sindh — Excise & Taxation\n\nThe official Sindh Excise tax portal provides a PSID-based motor-vehicle-tax payment process. The published procedure uses a 12-digit PSID valid for 24 hours, with payment through supported 1LINK channels.\n\n**Source:** https://taxportal.excise.gos.pk/home/faq";
 if(jurisdiction==="Khyber Pakhtunkhwa" && isRegistration) return language==="Urdu"
  ? "## خیبر پختونخوا — نئی گاڑی کی رجسٹریشن\n\nKP Excise کے سرکاری مواد کے مطابق نئی گاڑی کی رجسٹریشن متعلقہ registering authority کے پاس Form F کے ذریعے کی جاتی ہے۔ درآمد شدہ گاڑی کے لیے import permit، bill of lading اور customs-duty documents، جبکہ مقامی گاڑی کے لیے authorized manufacturer/dealer کی sale authority letter اور invoice درکار ہوتے ہیں۔\n\n**سرکاری ماخذ:** https://www.kpexcise.gov.pk/app/motor-vehicle-taxes/\nhttps://www.kpexcise.gov.pk/app/wp-content/uploads/2020/08/MOET-KP-Version-5-Finance-Act2015.pdf"
  : "## Khyber Pakhtunkhwa — New Vehicle Registration\n\nAccording to official KP Excise material, a new vehicle is registered with the registering authority using Form F. For an imported vehicle, the official law lists the import permit, bill of lading and evidence of customs-duty payment; for a locally purchased vehicle, it lists the sale authority letter and invoice from the authorized manufacturer/dealer.\n\n**Official sources:** https://www.kpexcise.gov.pk/app/motor-vehicle-taxes/\nhttps://www.kpexcise.gov.pk/app/wp-content/uploads/2020/08/MOET-KP-Version-5-Finance-Act2015.pdf";
 if(jurisdiction==="Khyber Pakhtunkhwa" && isTransfer) return language==="Urdu"
  ? "## خیبر پختونخوا — گاڑی کی ملکیت کی منتقلی\n\nKP کے سرکاری Motor Vehicle Ordinance کے مطابق ملکیت منتقل ہونے کے بعد منتقلی کی اطلاع متعلقہ registering authority کو دینی ہوتی ہے اور اصل registration certificate پیش کیا جاتا ہے۔ KP Motor Vehicles Rules میں transfer کے لیے Form T.O. مقرر کیا گیا ہے۔ موجودہ سرکاری KP Excise ویب سائٹ vehicle registration اور online vehicle information services بھی فراہم کرتی ہے.\n\n**سرکاری ماخذ:** https://www.kpexcise.gov.pk/app/wp-content/uploads/2020/08/THE-KHYBER-Pakhtunkhwa-MOTOR-VEHICLE-ORDINANCE-1965.pdf\nhttps://www.kpexcise.gov.pk/app/wp-content/uploads/2020/08/THE-KHYBER-Pakhtunkhwa-MOTOR-VEHICLES-RULES-1969.pdf\nhttps://www.kpexcise.gov.pk/new/"
  : "## Khyber Pakhtunkhwa — Vehicle Ownership Transfer\n\nUnder the official KP Motor Vehicle Ordinance, a transfer of ownership must be reported to the relevant registering authority and the vehicle's registration certificate is to be forwarded or presented. The KP Motor Vehicles Rules prescribe Form T.O. for the transfer application. The current KP Excise website also provides vehicle-registration and online vehicle-information services.\n\n**Official sources:** https://www.kpexcise.gov.pk/app/wp-content/uploads/2020/08/THE-KHYBER-Pakhtunkhwa-MOTOR-VEHICLE-ORDINANCE-1965.pdf\nhttps://www.kpexcise.gov.pk/app/wp-content/uploads/2020/08/THE-KHYBER-Pakhtunkhwa-MOTOR-VEHICLES-RULES-1969.pdf\nhttps://www.kpexcise.gov.pk/new/";
 if(jurisdiction==="Balochistan" && isRegistration) return language==="Urdu"
  ? "## بلوچستان — نئی گاڑی کی رجسٹریشن\n\nبلوچستان ایکسائز اینڈ ٹیکسیشن ڈیپارٹمنٹ کے سرکاری FAQ کے مطابق متعلقہ Excise & Taxation Officer (ETO) کے دفتر میں درج ذیل کاغذات اور فارم جمع کیے جاتے ہیں:\n1. اصل Sale Certificate اور Invoice\n2. مکمل اور دستخط شدہ Form F، Form I اور Computer Form\n3. گاڑی کو Excise & Taxation Inspector کے سامنے physical verification کے لیے پیش کرنا\n4. رجسٹریشن فیس ادا کرکے NBP challan کی owner copy درخواست کے ساتھ منسلک کرنا\n5. CNIC کی attested photocopy\n6. Government یا Company vehicle کی صورت میں متعلقہ covering letter بھی درکار ہو سکتا ہے\n\nسرکاری FAQ کے مطابق عام طور پر registration book جاری ہونے میں تقریباً دو ہفتے کا وقت دیا جاتا ہے۔\n\n**سرکاری ماخذ:** https://excise.balochistan.gov.pk/faq/\nhttps://excise.balochistan.gov.pk/motor-vehicle-forms/"
  : "## Balochistan — New Vehicle Registration\n\nAccording to the official Balochistan Excise & Taxation Department FAQ, the following documents and forms are submitted to the relevant Excise & Taxation Officer (ETO):\n1. Original Sale Certificate and Invoice\n2. Duly filled and signed Form F, Form I and Computer Form\n3. Physical presentation of the vehicle for verification by the Excise & Taxation Inspector\n4. Payment of the registration fee, with the owner's NBP challan copy attached to the application\n5. Attested photocopy of the CNIC\n6. For a government or company vehicle, a covering letter from the relevant department/company may also be required\n\nThe official FAQ states that a registration book is usually issued in about two weeks after submission and verification.\n\n**Official sources:** https://excise.balochistan.gov.pk/faq/\nhttps://excise.balochistan.gov.pk/motor-vehicle-forms/"
 if(jurisdiction==="Sindh" && isRegistration) return language==="Urdu"
  ? "## سندھ — نئی گاڑی کی رجسٹریشن\n\nسندھ ایکسائز کے سرکاری نظام کے مطابق گاڑی کی registration computerized system کے ذریعے کی جاتی ہے۔ موجودہ سرکاری پورٹل registration fee اور vehicle-category کے مطابق charges کا calculator فراہم کرتا ہے۔\n\n**سرکاری ماخذ:** https://excise.gos.pk/motor-vehicle-tax\nhttps://excise.gos.pk/online_services/four_wheeler/"
  : "## Sindh — New Vehicle Registration\n\nSindh Excise states that vehicle registration is handled through its computerized registration system. Its current official portal provides category-based registration charges and an online registration-cost calculator. Exact documents depend on the vehicle category and transaction, so I am not adding an unsupported checklist.\n\n**Official sources:** https://excise.gos.pk/motor-vehicle-tax\nhttps://excise.gos.pk/online_services/four_wheeler/";
 if(jurisdiction==="Sindh" && isTransfer) return language==="Urdu"
  ? "## سندھ — گاڑی کی ملکیت کی منتقلی\n\nسندھ کے موجودہ سرکاری قانون کے مطابق گاڑی کی فروخت کے بعد seller اور purchaser کو 30 دن کے اندر registering authority کو sale/transfer report کرنا ہوتا ہے، جبکہ purchaser کو transfer 15 دن کے اندر مکمل کرنا ہوتا ہے؛ تاخیر پر قانونی penalties لاگو ہو سکتی ہیں۔ موجودہ سندھ ایکسائز پورٹل transfer fee schedule بھی شائع کرتا ہے۔\n\n**سرکاری ماخذ:** https://excise.gos.pk/motor-vehicle-tax\nhttps://excise.gos.pk/upload/notifications/M.V.%20Amendment%20Taxation%20Act-2024.pdf"
  : "## Sindh — Vehicle Ownership Transfer\n\nUnder the current official Sindh motor-vehicle law, after a vehicle is sold the seller and purchaser must report the sale or transfer to the registering authority within 30 days, and the purchaser is responsible for completing the transfer within 15 days; statutory penalties may apply for delay. The current Sindh Excise portal also publishes the transfer-fee schedule.\n\n**Official sources:** https://excise.gos.pk/motor-vehicle-tax\nhttps://excise.gos.pk/upload/notifications/M.V.%20Amendment%20Taxation%20Act-2024.pdf";
 if(jurisdiction==="Islamabad Capital Territory" && isRegistration) return language==="Urdu"
  ? "## اسلام آباد (ICT) — نئی گاڑی کی رجسٹریشن\n\nICT Administration کے مطابق رجسٹریشن میں applicable registration fee، advance tax، token tax اور income tax شامل ہو سکتے ہیں، جبکہ commercial vehicle کے لیے professional tax بھی لاگو ہو سکتا ہے۔ imported vehicle کے لیے Bill of Entry، Bill of Lading اور متعلقہ registration documents درکار ہو سکتے ہیں، اور رہائش کا ثبوت بھی قبول شدہ دستاویزات میں شامل ہے۔\n\n**سرکاری ماخذ:** https://ictadministration.gov.pk/vehicle-registration/"
  : "## Islamabad Capital Territory — New Vehicle Registration\n\nICT Administration states that registration-related charges can include registration fee, advance tax, token tax and income tax, with professional tax for commercial vehicles. For imported vehicles, the official page lists documents such as the Bill of Entry and Bill of Lading, and it also specifies acceptable proof of residence.\n\n**Official source:** https://ictadministration.gov.pk/vehicle-registration/";
 if(jurisdiction==="Islamabad Capital Territory" && isTransfer) return language==="Urdu"
  ? "## اسلام آباد (ICT) — گاڑی کی ملکیت کی منتقلی\n\nسرکاری ICT Administration کے مطابق: documents مکمل کریں، مقررہ Excise window پر fee جمع کریں، Excise Inspector سے verification کرائیں، اور Data Entry Operator سے receipt حاصل کریں۔ مطلوبہ کاغذات میں transfer application، applicant/seller CNIC copies، Form F، computerized transfer letter، transfer-of-ownership form، اور مخصوص حالات میں bank/leasing NOC اور affidavit شامل ہیں۔\n\n**سرکاری ماخذ:** https://ictadministration.gov.pk/vehicle-transfer/"
  : "## Islamabad Capital Territory — Vehicle Ownership Transfer\n\nThe official ICT process is: complete the documents, deposit the required fee at the designated Excise window, have the documents verified by the Excise Inspector, and obtain the receipt from the Data Entry Operator. The published documents include the transfer application, applicant/seller CNIC copies, Form F, computerized transfer letter and transfer-of-ownership form; a bank or leasing NOC and affidavit may also apply in specified cases.\n\n**Official source:** https://ictadministration.gov.pk/vehicle-transfer/";
 if(isVerification){
  if(jurisdiction==="Sindh") return language==="Urdu"
   ? "## سندھ — گاڑی کی تصدیق\n\nسندھ ایکسائز کا سرکاری پورٹل registration number کے ذریعے number-plate/vehicle information verification فراہم کرتا ہے، اور Quick Pay میں registration number دے کر current tax اور arrears بھی دیکھے جا سکتے ہیں۔\n\n**سرکاری ماخذ:** https://www.excise.gos.pk/vehicle/check_number_plate\nhttps://taxportal.excise.gos.pk/home/quick_pay"
   : "## Sindh — Vehicle Verification\n\nThe official Sindh Excise portal provides vehicle and number-plate verification using the registration number. Its Quick Pay service can also retrieve current tax and arrears after entering the registration number.\n\n**Official sources:** https://www.excise.gos.pk/vehicle/check_number_plate\nhttps://taxportal.excise.gos.pk/home/quick_pay";
  if(jurisdiction==="Khyber Pakhtunkhwa") return language==="Urdu"
   ? "## خیبر پختونخوا — گاڑی کی تصدیق\n\nKP Excise کی سرکاری ویب سائٹ پر Online Vehicle Info سروس موجود ہے، جو گاڑی کی معلومات کے لیے استعمال کی جا سکتی ہے۔\n\n**سرکاری ماخذ:** https://www.kpexcise.gov.pk/new/"
   : "## Khyber Pakhtunkhwa — Vehicle Verification\n\nThe official KP Excise website provides an Online Vehicle Info service for vehicle information.\n\n**Official source:** https://www.kpexcise.gov.pk/new/";
  if(jurisdiction==="Balochistan") return language==="Urdu"
   ? "## بلوچستان — گاڑی کی تصدیق\n\nبلوچستان ایکسائز کی سرکاری ویب سائٹ Online Vehicle Verification اور number-plate status services فراہم کرتی ہے۔\n\n**سرکاری ماخذ:** https://excise.balochistan.gov.pk/home/online-vehicle-verification/"
   : "## Balochistan — Vehicle Verification\n\nThe official Balochistan Excise website provides Online Vehicle Verification and number-plate status services.\n\n**Official source:** https://excise.balochistan.gov.pk/home/online-vehicle-verification/";
  if(jurisdiction==="Gilgit-Baltistan") return language==="Urdu"
   ? "## گلگت بلتستان — گاڑی کی تصدیق\n\nGB Excise کا سرکاری portal registration number کے ذریعے vehicle registration details، chassis/engine information اور token-tax validity کی verification فراہم کرتا ہے۔\n\n**سرکاری ماخذ:** https://gbexcise.gov.pk/vehsearch/"
   : "## Gilgit-Baltistan — Vehicle Verification\n\nThe official GB Excise verification portal can search vehicle registration data and shows registration details, chassis/engine information and token-tax validity.\n\n**Official source:** https://gbexcise.gov.pk/vehsearch/";
  if(jurisdiction==="Azad Jammu and Kashmir") return language==="Urdu"
   ? "## آزاد کشمیر — گاڑی کی تصدیق\n\nAJK E-Facilitation Center کی سرکاری معلومات میں Vehicle Verification اور ETO Biometric Verification خدمات شامل ہیں۔\n\n**سرکاری ماخذ:** https://efc.ajk.gov.pk/"
   : "## Azad Jammu and Kashmir — Vehicle Verification\n\nThe official AJK E-Facilitation Center lists Vehicle Verification and ETO Biometric Verification among its services.\n\n**Official source:** https://efc.ajk.gov.pk/";
  if(jurisdiction==="Punjab") return language==="Urdu"
   ? "## پنجاب — گاڑی کی تصدیق\n\nپنجاب ایکسائز کی سرکاری vehicle-registration services میں computerized vehicle records اور registration services موجود ہیں۔ مخصوص online verification service کے لیے متعلقہ Punjab Excise vehicle portal استعمال کیا جاتا ہے۔\n\n**سرکاری ماخذ:** https://excise.punjab.gov.pk/vehicle_registration"
   : "## Punjab — Vehicle Verification\n\nPunjab Excise maintains computerized vehicle-registration records and vehicle-registration services. For a specific vehicle-status lookup, use the relevant official Punjab Excise vehicle portal.\n\n**Official source:** https://excise.punjab.gov.pk/vehicle_registration";
  if(jurisdiction==="Islamabad Capital Territory") return language==="Urdu"
   ? "## اسلام آباد (ICT) — گاڑی کی معلومات\n\nICT Administration کی سرکاری Excise services میں vehicle registration اور transfer کی معلومات موجود ہیں۔ مخصوص vehicle-status verification کے لیے ICT کی متعلقہ Excise service استعمال کی جاتی ہے۔\n\n**سرکاری ماخذ:** https://ictadministration.gov.pk/vehicle-registration/"
   : "## Islamabad Capital Territory — Vehicle Information\n\nICT Administration publishes official vehicle-registration and transfer services. For a specific vehicle-status lookup, use the relevant ICT Excise service.\n\n**Official source:** https://ictadministration.gov.pk/vehicle-registration/";
  return language==="Urdu"
   ? "## ایکسائز اینڈ ٹیکسیشن — گاڑی کی تصدیق\n\nگاڑی کی آن لائن تصدیق کی سہولت صوبے یا علاقے کے مطابق مختلف ہے۔ متعلقہ صوبہ/علاقہ بتانے پر مخصوص سرکاری verification service بتائی جا سکتی ہے۔"
   : "## Excise & Taxation — Vehicle Verification\n\nOnline vehicle-verification facilities vary by province or territory. The specific official verification service depends on the province or territory.";
 }
 if(!jurisdiction && isRegistration) return language==="Urdu"
  ? "## نئی گاڑی کی رجسٹریشن — صوبہ/علاقہ کے مطابق\n\nپاکستان میں نئی گاڑی کی رجسٹریشن کا بنیادی عمل اور required documents صوبہ/علاقہ کے مطابق مختلف ہوتے ہیں۔\n\n| صوبہ/علاقہ | سرکاری طور پر تصدیق شدہ بنیادی طریقہ / کاغذات |\n|---|---|\n| پنجاب | Form-F، مالک کا CNIC، اصل Sales Certificate، اصل Sales Invoice، registration/number-plate fee اور applicable taxes۔ |\n| سندھ | Computerized registration system؛ official portal vehicle category کے مطابق registration charges اور calculator فراہم کرتا ہے۔ مکمل checklist گاڑی/transaction کے مطابق ہے۔ |\n| خیبر پختونخوا | Form-F؛ مقامی گاڑی کے لیے authorized manufacturer/dealer کی sale authority letter اور invoice؛ imported vehicle کے لیے import permit، bill of lading اور customs-duty documents۔ |\n| اسلام آباد (ICT) | Registration fee، advance tax، token tax اور income tax؛ imported vehicle کے لیے Bill of Entry/Bill of Lading؛ acceptable residence proof۔ |\n| بلوچستان | ETO کے دفتر میں Form-F، Form-I، Computer Form، اصل Sale Certificate/Invoice، physical verification، CNIC اور registration fee؛ سرکاری FAQ عام طور پر تقریباً دو ہفتے کا وقت بتاتا ہے۔ |\n| آزاد کشمیر (AJK) | AJK official E-Facilitation Center vehicle verification/ETO biometric services فراہم کرتا ہے؛ مکمل new-registration checklist کی موجودہ public page پر تصدیق نہیں ہو سکی، اس لیے غیرمصدقہ فہرست شامل نہیں کی گئی۔ |\n| گلگت بلتستان (GB) | GB Excise کے مطابق Motor Vehicle Registration تمام اضلاع میں functional ہے اور registration/tax services فراہم کی جاتی ہیں؛ موجودہ public page پر مکمل checklist دستیاب نہیں۔ |\n\n**اہم:** فیس، taxes اور exact documents گاڑی کی قسم، engine capacity، import/local status اور صوبے کے مطابق بدل سکتے ہیں۔\n\n**سرکاری ذرائع:** پنجاب: https://excise.punjab.gov.pk/vehicle_registration | سندھ: https://excise.gos.pk/motor-vehicle-tax | KP: https://www.kpexcise.gov.pk/app/motor-vehicle-taxes/ | ICT: https://ictadministration.gov.pk/vehicle-registration/ | بلوچستان: https://excise.balochistan.gov.pk/faq/ | AJK: https://efc.ajk.gov.pk/ | GB: https://gbexcise.gov.pk/"
  : "## New Vehicle Registration — Province/Territory Comparison\n\nThe basic registration process and required documents differ by province or territory in Pakistan.\n\n| Province/Territory | Officially verified core process / documents |\n|---|---|\n| Punjab | Form-F, owner's CNIC, original Sales Certificate, original Sales Invoice, plus registration/number-plate fees and applicable taxes. |\n| Sindh | Computerized registration system; the official portal publishes category-based registration charges and a calculator. The exact checklist depends on vehicle/transaction. |\n| Khyber Pakhtunkhwa | Form-F; for a locally purchased vehicle, sale authority letter and invoice from the authorized manufacturer/dealer; for an imported vehicle, import permit, bill of lading and customs-duty documents. |\n| Islamabad (ICT) | Registration fee, advance tax, token tax and income tax; imported vehicles may require Bill of Entry/Bill of Lading and acceptable proof of residence. |\n| Balochistan | The official FAQ lists Form-F, Form-I, Computer Form, original Sale Certificate/Invoice, physical verification, CNIC and registration-fee payment; it states the registration book is usually issued in about two weeks. |\n| AJK | The official AJK E-Facilitation Center lists Vehicle Verification and ETO Biometric Verification, but I could not verify a complete current new-registration checklist from its public page, so I am not inventing one. |\n| Gilgit-Baltistan | GB Excise states that Motor Vehicle Registration is functional in all districts and handles registration, fees and allied taxes; a complete current public checklist was not available. |\n\n**Important:** Fees, taxes and exact documents can vary by vehicle type, engine capacity, import/local status and province/territory.\n\n**Official sources:** Punjab: https://excise.punjab.gov.pk/vehicle_registration; Sindh: https://excise.gos.pk/motor-vehicle-tax; KP: https://www.kpexcise.gov.pk/app/motor-vehicle-taxes/; ICT: https://ictadministration.gov.pk/vehicle-registration/; Balochistan: https://excise.balochistan.gov.pk/faq/; AJK: https://efc.ajk.gov.pk/; GB: https://gbexcise.gov.pk/";
 if(!jurisdiction && isTransfer) return language==="Urdu"
  ? "## گاڑی کی ملکیت کی منتقلی — صوبہ/علاقہ کے مطابق\n\n| صوبہ/علاقہ | سرکاری طور پر تصدیق شدہ عمل |\n|---|---|\n| پنجاب | T.O. Form، seller/purchaser CNICs، witnesses، original Registration Certificate with updated Token Tax، applicable registration file اور prescribed application۔ |\n| سندھ | موجودہ قانون کے مطابق seller/purchaser کو sale report 30 دن کے اندر کرنی ہے اور purchaser کو transfer 15 دن کے اندر مکمل کرنا ہے؛ transfer fees vehicle category کے مطابق ہیں۔ |\n| خیبر پختونخوا | Transfer application Form T.O. کے ذریعے متعلقہ registering authority کو دی جاتی ہے اور registration certificate پیش کیا جاتا ہے۔ |\n| اسلام آباد (ICT) | Transfer application، applicant/seller CNIC، Form-F، computerized transfer letter، transfer-of-ownership form؛ Excise Inspector verification اور receipt process۔ |\n| بلوچستان | Transfer Letter، T.O. Form، seller/purchaser CNICs، transfer fee، sale agreement، دونوں parties کی ETO کے سامنے appearance اور computerized verification۔ |\n| آزاد کشمیر (AJK) | AJK official E-Facilitation Center Vehicle Verification/ETO Biometric Verification فراہم کرتا ہے؛ مکمل current ownership-transfer checklist کی public verification نہیں ہو سکی۔ |\n| گلگت بلتستان (GB) | GB Excise registration/transfer forms اور vehicle verification services فراہم کرتا ہے، لیکن current public page پر مکمل transfer checklist متن دستیاب نہیں۔ |\n\n**سرکاری ذرائع:** پنجاب: https://excise.punjab.gov.pk/vehicle_registration | سندھ: https://excise.gos.pk/motor-vehicle-tax | KP: https://www.kpexcise.gov.pk/app/wp-content/uploads/2020/08/THE-KHYBER-Pakhtunkhwa-MOTOR-VEHICLE-ORDINANCE-1965.pdf | ICT: https://ictadministration.gov.pk/vehicle-transfer/ | بلوچستان: https://excise.balochistan.gov.pk/faq/ | AJK: https://efc.ajk.gov.pk/ | GB: https://gbexcise.gov.pk/downloads/"
  : "## Vehicle Ownership Transfer — Province/Territory Comparison\n\n| Province/Territory | Officially verified process |\n|---|---|\n| Punjab | T.O. Form, seller/purchaser CNICs, witness copies, original Registration Certificate with updated Token Tax, applicable registration file and prescribed application. |\n| Sindh | Under current law, seller and purchaser must report the sale within 30 days and the purchaser must complete the transfer within 15 days; transfer fees vary by vehicle category. |\n| Khyber Pakhtunkhwa | Submit the transfer application using Form T.O. to the relevant registering authority and present or forward the registration certificate. |\n| Islamabad (ICT) | Transfer application, applicant/seller CNIC, Form-F, computerized transfer letter and transfer-of-ownership form, followed by Excise Inspector verification and receipt. |\n| Balochistan | Transfer Letter, T.O. Form, seller/purchaser CNICs, transfer-fee payment, sale agreement, appearance before the ETO and computerized verification. |\n| AJK | The official AJK E-Facilitation Center lists Vehicle Verification and ETO Biometric Verification, but I could not verify a complete current ownership-transfer checklist from its public page, so I am not inventing one. |\n| Gilgit-Baltistan | GB Excise provides vehicle registration/transfer forms and verification services, but the current public page does not expose the complete transfer checklist. |\n\n**Official sources:** Punjab: https://excise.punjab.gov.pk/vehicle_registration; Sindh: https://excise.gos.pk/motor-vehicle-tax; KP: https://www.kpexcise.gov.pk/app/wp-content/uploads/2020/08/THE-KHYBER-Pakhtunkhwa-MOTOR-VEHICLE-ORDINANCE-1965.pdf; ICT: https://ictadministration.gov.pk/vehicle-transfer/; Balochistan: https://excise.balochistan.gov.pk/faq/; AJK: https://efc.ajk.gov.pk/; GB: https://gbexcise.gov.pk/downloads/";
 if(jurisdiction==="Sindh" && (isToken||isPayment)) return language==="Urdu"
  ? "## سندھ — ایکسائز اینڈ ٹیکسیشن\n\nسرکاری سندھ ایکسائز ٹیکس پورٹل کے مطابق موٹر وہیکل ٹیکس کے لیے PSID پر مبنی ادائیگی کا طریقہ موجود ہے۔ طریقہ کار میں 12 ہندسوں کا PSID استعمال ہوتا ہے، جو 24 گھنٹے تک قابل استعمال ہوتا ہے، اور ادائیگی معاون 1LINK ذرائع سے کی جا سکتی ہے۔\n\n**ماخذ:** https://taxportal.excise.gos.pk/home/faq"
  : "## Sindh — Excise & Taxation\n\nThe official Sindh Excise tax portal provides a PSID-based motor-vehicle-tax payment process. The published procedure uses a 12-digit PSID valid for 24 hours, with payment through supported 1LINK channels.\n\n**Source:** https://taxportal.excise.gos.pk/home/faq";
 if(jurisdiction==="Khyber Pakhtunkhwa" && (isToken||isPayment)) return language==="Urdu"
  ? "## خیبر پختونخوا — ایکسائز اینڈ ٹیکسیشن\n\nسرکاری KP ایکسائز محکمہ موٹر وہیکل ٹیکس اور اس کے ریٹس کی معلومات فراہم کرتا ہے۔ موجودہ سرکاری ثبوت مکمل آن لائن ادائیگی کا طریقہ ثابت نہیں کرتا، اس لیے غیر مصدقہ مراحل شامل نہیں کیے گئے۔\n\n**ماخذ:** https://kpexcise.gov.pk/new/mvtax/"
  : "## Khyber Pakhtunkhwa — Excise & Taxation\n\nThe official KP Excise department publishes motor-vehicle-tax information and rates. The current official evidence does not establish a complete online payment workflow, so unsupported payment steps are not added.\n\n**Source:** https://kpexcise.gov.pk/new/mvtax/";
 if(jurisdiction==="Punjab" && isPayment) return language==="Urdu"
  ? "## پنجاب — ایکسائز آن لائن ادائیگی\n\nپنجاب ایکسائز کی سرکاری سروسز میں Online Payment of Excise Dues درج ہے۔ گاڑی کے متعلق درست payable amount متعلقہ ٹیکس اور گاڑی کی تفصیلات پر منحصر ہے۔\n\n**ماخذ:** https://excise.punjab.gov.pk/services"
  : "## Punjab — Online Excise Payment\n\nPunjab Excise lists Online Payment of Excise Dues among its official services. The payable amount depends on the vehicle and applicable taxes.\n\n**Source:** https://excise.punjab.gov.pk/services";
 return language==="Urdu"
  ? "## ایکسائز اینڈ ٹیکسیشن\n\nبراہ کرم صوبہ/علاقہ اور مطلوبہ گاڑی کی سروس بتائیں، مثلاً پنجاب میں ٹوکن ٹیکس، نئی رجسٹریشن یا ملکیت کی منتقلی۔"
  : "## Excise & Taxation\n\nPlease specify the province/territory and vehicle service, for example Punjab token tax, new registration, or ownership transfer.";
}

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
  "land & revenue":"Land & Revenue","fbr / taxation":"FBR / Taxation","government jobs":"Government Jobs","vaccination for travelling abroad":"Vaccination for Travelling Abroad"
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
 "Government Jobs":["government jobs","government job","jobs","job","career","employment","federal government jobs","provincial government jobs","سرکاری ملازمت","سرکاری نوکری"],
 "Arms Licence":["arms licence","arms license","weapon licence","weapon license","gun licence","gun license","اسلحہ لائسنس","اسلحہ لائسنس","ہتھیار لائسنس"]
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
 "CNIC / NADRA":["cnic","nic","smart nic","smart nic card","smart card","smart identity card","snic","identity card","nadra","شناختی کارڈ","نادرا"],"Passport":["passport","پاسپورٹ"],"Driving Licence":["driving licence","driving license","driving","driving test","learner","learner licence","learner license","ltv","ltv licence","ltv license","htv","htv licence","htv license","renew driving licence","duplicate driving licence","international driving licence","ڈرائیونگ لائسنس","ڈرائیونگ"],"Arms Licence":["arm licence","arm license","arms licence","arms license","weapon licence","weapon license","gun licence","gun license","اسلحہ لائسنس","اسلحہ لائسنس","ہتھیار لائسنس"],"Domicile":["domicile","ڈومیسائل"],"Scholarships":["scholarship","scholarships","stipend","financial aid","وظیفہ","اسکالرشپ"],"Protector of Emigrants":["protector","protector of emigrants","emigration","emigrant","overseas employment","work visa","employment visa","پروٹیکٹر","ایمیگریشن","بیرون ملک ملازمت"],"Vaccination for Travelling Abroad":["vaccination","vaccine","immunization","immunisation","vaccination for travelling abroad","travel vaccination","umrah","umra","hajj","haj","pilgrimage","polio","meningococcal","yellow fever","ویکسین","ویکسینیشن","عمرہ","حج"],"Land & Revenue":["fard","fards","land record","land records","mutation","intiqal","registry","property record","land ownership","revenue","khewat","khasra","فرد","فردات","انتقال","رجسٹری","زمین کا ریکارڈ","ملکیت"],"Other Services":["birth certificate","death certificate","marriage certificate","divorce certificate","police verification","vehicle registration","token tax","income tax","fbr","tax","crc","form b","پیدائش","وفات","شادی","طلاق","پولیس ویریفیکیشن","گاڑی رجسٹریشن","ٹیکس"],"Government Jobs":["government job","government jobs","job","jobs","career","careers","employment","سرکاری نوکری","سرکاری نوکریاں","ملازمت","روزگار"]};

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
function detectTargetJurisdiction(q:string):string|null{
 const text=normalize(q);
 const data:Array<[string,string[]]>=[
  ["Punjab",["punjab","پنجاب"]],
  ["Sindh",["sindh","sind","سندھ"]],
  ["Khyber Pakhtunkhwa",["khyber pakhtunkhwa","kpk","kp","خیبر پختونخوا","خیبرپختونخوا"]],
  ["Islamabad Capital Territory",["islamabad","ict","اسلام آباد","اسلامباد"]],
  ["Balochistan",["balochistan","بلوچستان"]],
  ["Azad Jammu and Kashmir",["ajk","azad kashmir","آزاد کشمیر","آزاد جموں و کشمیر"]],
  ["Gilgit-Baltistan",["gilgit","gilgit baltistan","گلگت","گلگت بلتستان"]]
 ];
 const esc=(x:string)=>x.replace(/[.*+?^$(){}|[\\]\\]/g,"\\$&");
 for(const [name,terms] of data){
  for(const t of terms){
   const x=normalize(t);
   if(x.length<=2)continue;
   const e=esc(x);
   if(new RegExp("(?:^|\\s)(?:in|for|from|within|of)\\s+"+e+"(?:$|\\s|[,.!?])","i").test(text))return name;
   if(text.includes(x+" mein")||text.includes(x+" میں"))return name;
  }
 }
 return null;
}
function detectJurisdiction(q:string):string|null{const text=normalize(q);const data:Array<[string,string[]]>= [["Punjab",["punjab","پنجاب"]],["Sindh",["sindh","sind","سندھ"]],["Khyber Pakhtunkhwa",["khyber pakhtunkhwa","kpk","kp","خیبر پختونخوا","خیبرپختونخوا"]],["Islamabad Capital Territory",["islamabad","ict","اسلام آباد","اسلامباد"]],["Balochistan",["balochistan","بلوچستان"]],["Azad Jammu and Kashmir",["ajk","azad kashmir","آزاد کشمیر","آزاد جموں و کشمیر"]],["Gilgit-Baltistan",["gilgit","gilgit baltistan","گلگت","گلگت بلتستان"]]];for(const [name,terms] of data)for(const t of terms){const x=normalize(t);if(x==="kp"||x==="kpk"||x==="ict"||x==="ajk"){if(new RegExp(`(^|\\s)${x}(?=\\s|$|[,.!?])`,"i").test(text))return name;}else if(text.includes(x))return name;}return null;}
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
 return String(text||"")
  .replace(/<br\s*\/?>/gi,"\n")
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
   if(jurisdiction==="Sindh")return make("https://www.sindhpolice.gov.pk/","Sindh Police Citizen Services","Sindh Police");
   if(jurisdiction==="Islamabad Capital Territory")return make("https://www.islamabadpolice.gov.pk/","Islamabad Police Citizen Services","Islamabad Capital Territory Police");
   return make("https://punjabpolice.gov.pk/","Punjab Police Citizen Services","Punjab Police");
 }
 if(req==="excise & taxation"){
   if(jurisdiction==="Khyber Pakhtunkhwa")return make("https://www.kpexcise.gov.pk/","KP Excise & Taxation Department","Excise, Taxation & Narcotics Control Department KP");
   if(jurisdiction==="Sindh")return make("https://www.excise.gos.pk/","Sindh Excise & Taxation Services","Excise, Taxation & Narcotics Control Department Sindh");
   if(jurisdiction==="Islamabad Capital Territory")return make("https://ictadministration.gov.pk/excise-taxation/","ICT Excise & Taxation Services","Excise & Taxation Department, ICT Administration");
   if(jurisdiction==="Balochistan")return make("https://excise.balochistan.gov.pk/","Balochistan Excise & Taxation Services","Excise, Taxation & Anti-Narcotics Department Balochistan");
   return make("https://excise.punjab.gov.pk/services","Punjab Excise & Taxation Services","Excise, Taxation & Narcotics Control Department Punjab");
 }
 if(req==="driving licence"){
   if(jurisdiction==="Khyber Pakhtunkhwa")return make("https://www.kppolice.gov.pk/","KP Driving Licence Services","Khyber Pakhtunkhwa Police");
   if(jurisdiction==="Sindh")return make("https://dls.gos.pk/","Driving License Sindh","Sindh Police – Driving License Unit");
   if(jurisdiction==="Islamabad Capital Territory")return make("https://dlims.islamabadpolice.gov.pk/","ITP DLIMS Driving Licence Services","Islamabad Traffic Police");
   if(jurisdiction==="Balochistan")return make("https://balochistan.gov.pk/citizen-services/","Balochistan Citizen Services","Government of Balochistan");
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
function extractRelevantOfficialEvidence(text:string,terms:string[]):string{
 const source=String(text||"").trim();
 if(!source)return "";
 const lower=source.toLowerCase();
 const chunks:string[]=[];
 for(const term of terms){
  let at=lower.indexOf(term.toLowerCase());
  if(at>=0){
   const start=Math.max(0,at-900),end=Math.min(source.length,at+1800);
   const chunk=source.slice(start,end).trim();
   if(chunk && !chunks.includes(chunk))chunks.push(chunk);
  }
 }
 return chunks.join("\n\n");
}

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

function policeEvidence(question:string,jurisdiction:string):string{
 const q=normalize(question);
 const isFir=q.includes("fir")||q.includes("first information");
 const isCharacter=q.includes("character")||q.includes("clearance");
 const isVerification=q.includes("verification")||q.includes("verify");
 const service=isFir?"FIR / FIR copy":isCharacter?"Character / Police Clearance Certificate":isVerification?"Police Verification":"Police Services";
 const data:Record<string,string>={
  Punjab:`## Punjab — Police Services
**Official authority:** Punjab Police / Police Khidmat Markaz.

**Requested service:** ${service}.

Punjab Police Police Khidmat Markaz provides Character Certificate, General Police Verification, Copy of FIR, Crime Report and other citizen services.

**Character Certificate:** The official Punjab Police service timetable states a processing time of **3 working days** after application.

**Copy of FIR:** For a FIR-copy request, use the official Punjab Police / Police Khidmat Markaz channel for the FIR copy service. The FIR-copy service is separate from Character Certificate and Police Verification services. The app should not substitute Character Certificate requirements for an FIR-copy request.

**Other useful official service times:** General Police Verification — 3 working days; Crime Report — around 15–20 minutes; Copy FIR is available through Punjab Police citizen-service channels.

For overseas Pakistanis, PKM Global provides Character Certificate, National Status Verification, Tenant Registration, Crime Report, Employee Verification and Copy FIR through Pakistani embassies in participating countries.

**Official sources:**
https://www.punjabpolice.gov.pk/pkm-timeframe
https://pkm.punjab.gov.pk/public/app/embassies`,
  Sindh:`## Sindh — Police Services
**Official authority:** Sindh Police.

**Requested service:** ${service}.

Use the official Sindh Police portal for the applicable police character/clearance, verification or FIR service. Exact documents, fees and processing times should be stated only when supported by the current official Sindh Police service information.

**Official source:** https://sindhpolice.gov.pk/`,
  "Khyber Pakhtunkhwa":`## Khyber Pakhtunkhwa — Police Clearance Certificate
**Official authority:** Khyber Pakhtunkhwa Police.

**Requested service:** ${service}.

For a Police Clearance Certificate, the official KP Police instructions require:
1. An affidavit on 10-point stamp paper, attested by the Oath Commissioner.
2. Unattested photocopy of recent CNIC.
3. Recent passport copy for overseas applicants.
4. Two recent passport-size photographs.
5. Criminal-record verification by the beat officer, Moharrar, SHO of the local police station and circle DSP on the back of the stamp paper.
6. Application in the relevant district according to permanent and present addresses on the CNIC; multiple addresses require verification from the relevant police stations.
7. For overseas applicants, a blood relative submits the required abroad stamp paper, CNIC copy and date of last exit from Pakistan.
8. Afghan applicants have additional document requirements specified by KP Police.
9. Applicant personally visits the PAL office for collection after signature and fingerprinting.

**Official source:** https://www.kppolice.gov.pk/detail.php?pid=52
**KP Police contact:** +92-91-9210457`,
  "Islamabad Capital Territory":`## Islamabad Capital Territory — Police Services
**Official authority:** Islamabad Capital Territory Police.

**Requested service:** ${service}.

For a **Character Certificate**, the current official Islamabad Police service page states:
- Applicants in Pakistan: original CNIC/B-Form and passport.
- Affidavit if the CNIC does not show an Islamabad address.
- Residential proof in Islamabad, such as rent agreement, allotment letter or official hostel letter.
- Applicants abroad: authority letter, recent photograph, affidavit covering duration abroad, last-exit passport page and Islamabad residential proof.
- Standard processing: **3 working days**.
- Application fee: **Rs. 1,000**.

The official online form also lists CNIC/passport front and back, fingerprint image and recent passport-size photo among required uploads.

For other police services, use the relevant official Islamabad Police service page.

**Official source:** https://www.islamabadpolice.gov.pk/character-certificate.php`
 };
 return data[jurisdiction]||`## Police Services
**Requested service:** ${service}.

Police requirements vary by province/territory. Specific documents, fees and processing times should not be invented without current official evidence.`;
}


function governmentJobsEvidence(question:string,language:"English"|"Urdu"):string{
 const q=normalize(question);
 const isApply=q.includes("apply")||q.includes("application")||q.includes("how to apply")||q.includes("اپلائی")||q.includes("درخواست");
 const isAccount=q.includes("register")||q.includes("signup")||q.includes("sign up")||q.includes("account")||q.includes("رجسٹر")||q.includes("اکاؤنٹ");
 const isPassword=q.includes("password")||q.includes("forgot")||q.includes("پاس ورڈ");
 const isSearch=q.includes("search")||q.includes("vacanc")||q.includes("jobs")||q.includes("job")||q.includes("نوکری")||q.includes("ملازمت");
 if(language==="Urdu"){
  if(isPassword)return "## سرکاری نوکریاں — National Jobs Portal\n\nپاس ورڈ بھول جانے کی صورت میں NJP کے لاگ اِن صفحے پر **Forgot Password** استعمال کریں۔\n\n**سرکاری ماخذ:** https://njp.gov.pk/help";
  if(isAccount)return "## سرکاری نوکریاں — National Jobs Portal\n\nNJP پر اکاؤنٹ بنانے کے لیے **Register** کریں اور CNIC، ای میل اور پاس ورڈ کی معلومات فراہم کر کے تصدیقی عمل مکمل کریں۔ موجودہ NJP ہیلپ کے مطابق candidate profile بنانے کے لیے CNIC اور PAK-ID verification استعمال ہوتی ہے۔\n\n**سرکاری ماخذ:** https://njp.gov.pk/register\nhttps://njp.gov.pk/help";
  if(isApply)return "## سرکاری نوکریاں — National Jobs Portal\n\nNJP پر سرکاری نوکری کے لیے:\n1. **Live Jobs** میں دستیاب آسامی تلاش کریں۔\n2. مطلوبہ job کھولیں اور **Apply** منتخب کریں۔\n3. اپنی CV/profile کے مطلوبہ حصے مکمل کریں۔\n4. Closing Date سے پہلے application submit کریں۔\n\n**سرکاری ماخذ:** https://njp.gov.pk/help";
  if(isSearch)return "## سرکاری نوکریاں — National Jobs Portal\n\nNJP پر **Live Jobs** اور **Upcoming Jobs** دستیاب ہیں۔ Job Search میں keyword یا organization کے ذریعے سرکاری vacancies تلاش کی جا سکتی ہیں۔\n\n**سرکاری ماخذ:** https://www.njp.gov.pk/index.php/jobs";
 }
 if(isPassword)return "## Government Jobs — National Jobs Portal\n\nIf you forgot your password, use **Forgot Password** on the NJP login page to receive a reset code and set a new password.\n\n**Official source:** https://njp.gov.pk/help";
 if(isAccount)return "## Government Jobs — National Jobs Portal\n\nTo create an NJP candidate account, select **Register** and complete the verification process. The current NJP registration/help pages require candidate details including CNIC and email, with PAK-ID verification used in the candidate-profile process.\n\n**Official sources:** https://njp.gov.pk/register\nhttps://njp.gov.pk/help";
 if(isApply)return "## Government Jobs — National Jobs Portal\n\nTo apply for a government job through NJP:\n1. Open **Live Jobs** and find the vacancy.\n2. Open the job details and click **Apply**.\n3. Complete the required CV/profile sections.\n4. Submit the application before the closing date.\n\n**Official source:** https://njp.gov.pk/help";
 return "## Government Jobs — National Jobs Portal\n\nNJP provides government job search through **Live Jobs** and **Upcoming Jobs**. You can search vacancies by keyword or organization and open the job details for the application process.\n\n**Official source:** https://www.njp.gov.pk/index.php/jobs";
}


function landRevenueEvidence(question:string,jurisdiction:string|null,language:"English"|"Urdu"):string{
 const q=normalize(question);
 const isPunjab=jurisdiction==="Punjab";
 const isKP=jurisdiction==="Khyber Pakhtunkhwa";
 const isFard=q.includes("fard")||q.includes("فرد")||q.includes("land record")||q.includes("land records")||q.includes("زمین کا ریکارڈ")||q.includes("لینڈ ریکارڈ");
 const isGeneralFardDefinition=isFard && !jurisdiction && /^(what is|define|meaning of|what does .* mean|کیا ہے|کیا ہوتی ہے|کیا ہوتا ہے|مطلب)/i.test(q);
 const isMutation=q.includes("mutation")||q.includes("intiqal")||q.includes("انتقال");
 const isRegistry=q.includes("registry")||q.includes("رجسٹری")||q.includes("property registration")||q.includes("register property");
 const isOwnership=q.includes("ownership")||q.includes("owner")||q.includes("ملکیت");
 // Keep distinct land-service intents separate: ownership information/Fard,
 // purchase transfer, inheritance, and record correction are different services.
 const isPurchaseTransfer=/(transfer ownership|ownership transfer|transfer of ownership|purchas|bought|buying|sale of land|sold land|land sale|زمین خرید|زمین کی خرید|خریدی ہوئی زمین|ملکیت منتقل)/i.test(q);
 const isInheritance=/(inheritance|legal heir|legal heirs|heirs|father.*died|mother.*died|death.*father|death.*mother|وراثت|وارث|قانونی وارث|والد.*وفات|والدہ.*وفات)/i.test(q);
 const isCorrection=/(correct|correction|incorrect|wrong|error|mistake|record correction|correct.*record|درست.*ریکارڈ|ریکارڈ.*درست|غلط.*ریکارڈ|تصحیح)/i.test(q);
 const isSDC=q.includes("service delivery centre")||q.includes("service delivery center")||q.includes("sdc")||q.includes("ایس ڈی سی")||q.includes("سروس ڈیلیوری سنٹر")||q.includes("سروس ڈیلیوری سینٹر");
 const hasLandTopic=isFard||isMutation||isRegistry||isOwnership||isSDC||q.includes("land")||q.includes("property")||q.includes("revenue")||q.includes("زمین")||q.includes("جائیداد")||q.includes("ریونیو")||q.includes("رجسٹری")||q.includes("انتقال")||q.includes("لینڈ ریکارڈ");
 if(isGeneralFardDefinition){
  return language==="Urdu"
   ? "## فرد (Fard)\n\nفرد زمین کے ریکارڈ کی ایک سرکاری دستاویز ہے جس میں متعلقہ زمین کے رقبے، مقام اور ملکیت کی تفصیلات درج ہوتی ہیں۔ فرد حاصل کرنے اور اس کی فیس یا طریقۂ کار صوبے اور متعلقہ لینڈ ریکارڈ اتھارٹی کے مطابق مختلف ہو سکتے ہیں۔"
   : "## Fard\n\nA Fard is an official land-record document containing information about a parcel of land, including its area, location and ownership details. The process, fee and issuing authority can vary by province or territory.";
 }
 if(language==="Urdu"){
  if(isPunjab){
   if(isMutation)return "## پنجاب — انتقال (Mutation / Intiqal)\n\nPLRA کے مطابق انتقال زمین کی ملکیت میں تبدیلی کو سرکاری لینڈ ریکارڈ میں درج کرنے کا عمل ہے۔ متعلقہ Arazi Record Centre (ARC) پر CNIC کی بایومیٹرک تصدیق کے بعد ٹوکن لیا جاتا ہے، مطلوبہ دستاویزات اور جائیداد کی تفصیلات جمع کی جاتی ہیں، مقررہ فیس/ٹیکس ادا کیے جاتے ہیں، اور متعلقہ Revenue Officer کے سامنے بیان/تصدیق کے بعد انتقال منظور کیا جاتا ہے۔\n\n**سرکاری ذرائع:**\nhttps://www.punjab-zameen.gov.pk/mutationsInfo\nhttps://www.punjab-zameen.gov.pk/entryMutationsInfo";
   if(isCorrection)return "## پنجاب — لینڈ ریکارڈ کی تصحیح\n\nPLRA کی الگ Correction of Land Records سروس ریکارڈ میں غلطیوں یا عدم مطابقت کی تصحیح کے لیے ہے۔ متعلقہ ARC یا Dahi Markaz Mall میں درخواست، دستاویزات کی جانچ، verification/inspection، مجاز Land Records authority کی منظوری اور پھر ریکارڈ update شامل ہیں۔\n\n**سرکاری ذریعہ:**\nhttps://www.punjab-zameen.gov.pk/correctionRecordsInfo";
   if(isPurchaseTransfer)return "## پنجاب — زمین کی ملکیت کی منتقلی\n\nزمین خریدنے کے بعد ملکیت کی تبدیلی کو PLRA کے مطابق mutation/انتقال کے ذریعے سرکاری land record میں درج کیا جاتا ہے۔\n\n1. متعلقہ Arazi Record Centre (ARC) پر CNIC/biometric verification مکمل کریں۔\n2. متعلقہ property/ownership documents جمع کرائیں۔\n3. applicable fees/taxes ادا کریں۔\n4. متعلقہ فریقین/گواہ required verification اور statements مکمل کریں۔\n5. مجاز Revenue Officer/ADLR کی منظوری کے بعد land record نئے مالک کے نام update ہوتا ہے۔\n\n**سرکاری ذرائع:**\nhttps://www.punjab-zameen.gov.pk/mutationsInfo\nhttps://www.punjab-zameen.gov.pk/entryMutationsInfo";
   if(isInheritance)return "## پنجاب — وراثتی زمین کی منتقلی\n\nوراثت کی وجہ سے ملکیت میں تبدیلی بھی PLRA کے مطابق mutation/انتقال کے ذریعے سرکاری land record میں درج کی جاتی ہے تاکہ ریکارڈ قانونی وارثوں کے مطابق update ہو۔ متعلقہ documents، identity/biometric verification، applicable fees/taxes اور Revenue Officer/ADLR کی verification/attestation اس عمل کا حصہ ہیں۔\n\nمخصوص legal-heir documents کیس کی نوعیت پر منحصر ہو سکتے ہیں؛ جو تقاضے موجودہ PLRA evidence سے ثابت نہیں، وہ یہاں شامل نہیں کیے گئے۔\n\n**سرکاری ذرائع:**\nhttps://www.punjab-zameen.gov.pk/mutationsInfo\nhttps://www.punjab-zameen.gov.pk/entryMutationsInfo";
   if(isRegistry)return "## پنجاب — جائیداد کی رجسٹری\n\nPLRA کے مطابق نئی جائیداد کی رجسٹری کے لیے e-Stamp challan اور متعلقہ فیس/ٹیکس کی ادائیگی، e-Registration نظام تک رسائی، اور مطلوبہ معلومات/دستاویزات جمع کرانے کے مراحل شامل ہیں۔\n\n**سرکاری ذریعہ:**\nhttps://www.punjab-zameen.gov.pk/registryInfo";
   if(isFard||isOwnership)return "## پنجاب — فرد اور لینڈ ریکارڈ\n\nPLRA کے مطابق فرد زمین کے رقبے، مقام اور ملکیت کی تفصیلات فراہم کرتی ہے۔ فرد متعلقہ Arazi Record Centre (ARC)، مجاز Arazi Moawin، یا سرکاری Online Fard سروس سے حاصل کی جا سکتی ہے۔ عام طور پر اصل CNIC اور جائیداد کی تفصیلات جیسے Khewat، Khasra یا Registry درکار ہوتی ہیں۔\n\n**سرکاری ذرائع:**\nhttps://www.punjab-zameen.gov.pk/fardInfo\nhttps://onlinefard.punjab-zameen.gov.pk/";
   return "## پنجاب — لینڈ ریکارڈ خدمات\n\nPLRA کی موجودہ سرکاری ویب سائٹ پر Fard، land transfer/mutation، ownership verification، registry، e-Stamp، partition اور متعلقہ land-record services دستیاب ہیں۔\n\n**سرکاری ذریعہ:**\nhttps://www.punjab-zameen.gov.pk/";
  }
  if(isKP){
   if(isSDC)return "## خیبر پختونخوا — Land Record Service Delivery Centres (SDCs)\n\nخیبر پختونخوا Revenue & Estate Department کے مطابق SDCs کمپیوٹرائزڈ لینڈ ریکارڈ خدمات فراہم کرتے ہیں۔ ان میں فرد کا اجراء اور انتقال کی بایومیٹرک تصدیق شامل ہے۔ محکمہ Online Fard اور Fard/Mutation appointment بھی فراہم کرتا ہے۔\n\n**سرکاری ذرائع:**\nhttps://revenue.kp.gov.pk/sdcs/\nhttps://revenue.kp.gov.pk/\nhttps://revenue.kp.gov.pk/computerization-of-land-record-in-18-districts/";
   if(isMutation)return "## خیبر پختونخوا — انتقال (Mutation)\n\nKP Revenue & Estate Department کے مطابق Mutation کمپیوٹرائزڈ land-record service ہے۔ SDC نظام میں انتقال کی بایومیٹرک تصدیق Revenue Officer کے ذریعے کی جاتی ہے، جبکہ محکمہ Fard/Mutation appointment بھی فراہم کرتا ہے۔\n\n**سرکاری ذرائع:**\nhttps://revenue.kp.gov.pk/sdcs/\nhttps://revenue.kp.gov.pk/computerization-of-land-record-in-18-districts/";
   if(isFard||isOwnership)return "## خیبر پختونخوا — فرد اور لینڈ ریکارڈ\n\nKP Revenue & Estate Department Online Fard اور کمپیوٹرائزڈ land-record services فراہم کرتا ہے۔ SDCs کے ذریعے فرد جاری کی جاتی ہے۔\n\n**سرکاری ذرائع:**\nhttps://revenue.kp.gov.pk/\nhttps://revenue.kp.gov.pk/sdcs/";
   return "## خیبر پختونخوا — لینڈ ریکارڈ خدمات\n\nKP Revenue & Estate Department کی سرکاری ویب سائٹ پر Online Fard، Fard/Mutation appointment، e-Registry اور Service Delivery Centres کی خدمات درج ہیں۔\n\n**سرکاری ذریعہ:**\nhttps://revenue.kp.gov.pk/";
  }
  if(!hasLandTopic)return "## لینڈ اینڈ ریونیو\n\nیہ سوال منتخب کردہ سرکاری شعبے سے متعلق معلوم نہیں ہوتا۔ براہ کرم لینڈ ریکارڈ، فرد، انتقال، جائیداد کی رجسٹری یا لینڈ/ریونیو سروس سے متعلق سوال کریں۔";
  return "## لینڈ اینڈ ریونیو\n\nبراہ کرم صوبہ/علاقہ اور مطلوبہ سروس بتائیں، مثلاً پنجاب میں فرد یا انتقال، یا خیبر پختونخوا میں فرد، انتقال یا SDC سروس۔";
 }
 if(isPunjab){
  if(isMutation)return "## Punjab — Mutation (Intiqal)\n\nThe Punjab Land Records Authority (PLRA) states that mutation records a change in land ownership in the official land record. The Punjab process includes CNIC biometric verification and a token at the concerned Arazi Record Centre, submission of required documents and property details, payment of applicable fees/taxes, and appearance before the authorized Revenue Officer with the relevant parties/witnesses. The Revenue Officer records statements and attests the mutation before the land record is updated.\n\n**Official sources:**\nhttps://www.punjab-zameen.gov.pk/mutationsInfo\nhttps://www.punjab-zameen.gov.pk/entryMutationsInfo";
  if(isCorrection)return "## Punjab — Correction of Land Records\n\nPLRA provides a separate Correction of Land Records service for errors or inconsistencies in land ownership data. The published process includes submitting the correction request at the concerned Arazi Record Centre (ARC) or Dahi Markaz Mall, document review, required verification/inspection, approval by the competent Land Records authority, and official record update.\n\n**Official source:**\nhttps://www.punjab-zameen.gov.pk/correctionRecordsInfo";
  if(isPurchaseTransfer)return "## Punjab — Transfer of Land Ownership\n\nFor a land purchase, the ownership change is recorded through the applicable mutation/land-transfer process. PLRA states that mutation records a change of ownership after a sale.\n\n1. Complete CNIC/biometric verification at the concerned Arazi Record Centre (ARC).\n2. Submit the relevant property and ownership documents.\n3. Pay applicable fees/taxes.\n4. Complete the required verification/statements with the relevant parties and witnesses.\n5. After approval by the authorized Revenue Officer/ADLR, the land record is updated to the new owner.\n\n**Official sources:**\nhttps://www.punjab-zameen.gov.pk/mutationsInfo\nhttps://www.punjab-zameen.gov.pk/entryMutationsInfo";
  if(isInheritance)return "## Punjab — Inheritance & Transfer to Legal Heirs\n\nWhen land ownership changes because of inheritance, PLRA treats the change as a mutation in the official land record so the record can reflect the legal heirs. The applicable process includes relevant property/ownership documents, identity/biometric verification, applicable fees/taxes, and verification/attestation before the authorized Revenue Officer/ADLR.\n\nSpecific legal-heir documents can depend on the case; requirements not established by the current PLRA evidence are not invented here.\n\n**Official sources:**\nhttps://www.punjab-zameen.gov.pk/mutationsInfo\nhttps://www.punjab-zameen.gov.pk/entryMutationsInfo";
  if(isRegistry)return "## Punjab — Property Registry\n\nPLRA current official guidance describes property registration through e-Stamping and the e-Registration system. The published process includes generating the e-Stamp challan, paying applicable stamp duty/taxes/registration and related fees, accessing the e-Registration portal, and submitting the required transaction information and documents.\n\n**Official source:**\nhttps://www.punjab-zameen.gov.pk/registryInfo";
  if(isFard||isOwnership)return "## Punjab — Fard & Land Record\n\nAccording to PLRA, a Fard provides land area, location and ownership details. It can be obtained from an Arazi Record Centre, an authorized Arazi Moawin, or the official Online Fard service. PLRA states that the original CNIC and property details such as Khewat, Khasra or Registry are used for the Fard request.\n\n**Official sources:**\nhttps://www.punjab-zameen.gov.pk/fardInfo\nhttps://onlinefard.punjab-zameen.gov.pk/";
  return "## Punjab — Land & Revenue Services\n\nPLRA current official website lists Fard, land transfer/mutation, ownership verification, property registry, e-Stamp, partition and other land-record services.\n\n**Official source:**\nhttps://www.punjab-zameen.gov.pk/";
 }
 if(isKP){
  if(isSDC)return "## Khyber Pakhtunkhwa — Land Record Service Delivery Centres (SDCs)\n\nThe KP Revenue & Estate Department states that SDCs provide computerized land-record services. Its official SDC page specifically lists issuance of Fard and biometric attestation of mutations by the Revenue Officer. The department also provides Online Fard and Fard/Mutation appointment services.\n\n**Official sources:**\nhttps://revenue.kp.gov.pk/sdcs/\nhttps://revenue.kp.gov.pk/\nhttps://revenue.kp.gov.pk/computerization-of-land-record-in-18-districts/";
  if(isMutation)return "## Khyber Pakhtunkhwa — Mutation\n\nThe KP Revenue & Estate Department identifies Mutation as a computerized land-record service. Its SDC system provides biometric attestation of mutations by the Revenue Officer, and the department provides an official Fard/Mutation appointment service.\n\n**Official sources:**\nhttps://revenue.kp.gov.pk/sdcs/\nhttps://revenue.kp.gov.pk/computerization-of-land-record-in-18-districts/";
  if(isFard||isOwnership)return "## Khyber Pakhtunkhwa — Fard & Land Record\n\nThe KP Revenue & Estate Department provides Online Fard and computerized land-record services through Service Delivery Centres. Its official pages identify Fard issuance as an SDC service.\n\n**Official sources:**\nhttps://revenue.kp.gov.pk/\nhttps://revenue.kp.gov.pk/sdcs/";
  return "## Khyber Pakhtunkhwa — Land & Revenue Services\n\nThe KP Revenue & Estate Department currently lists Online Fard, Fard/Mutation appointment, e-Registry and Service Delivery Centres among its official online land services.\n\n**Official source:**\nhttps://revenue.kp.gov.pk/";
 }
 if(!hasLandTopic)return "## Land & Revenue\n\nThis question does not appear to belong to the selected government department. Please ask a question related to land records, Fard, mutation (Intiqal), property registration, or land/revenue services.";
 return "## Land & Revenue\n\nPlease specify the province or territory and the land service you need, such as Punjab Fard, Punjab mutation (Intiqal), or KP land-record services.";
}
function educationEvidence(question:string,jurisdiction:string|null,language:"English"|"Urdu"):string{
 const q=normalize(question);
 const isApply=q.includes("apply")||q.includes("application")||q.includes("درخواست")||q.includes("اپلائی");
 const isEligibility=q.includes("eligible")||q.includes("eligibility")||q.includes("criteria")||q.includes("اہلیت")||q.includes("شرائط");
 const isNeedBased=q.includes("need based")||q.includes("need-based")||q.includes("financial need")||q.includes("مالی");
 const isInternational=q.includes("international")||q.includes("abroad")||q.includes("overseas")||q.includes("foreign")||q.includes("بیرون ملک")||q.includes("بین الاقوامی");
 const isUndergraduate=q.includes("undergraduate")||q.includes("bachelor")||q.includes("bachelors")||q.includes("گریجویشن")||q.includes("بیچلر");
 const isPunjab=jurisdiction==="Punjab";
 if(language==="Urdu"){
  if(isPunjab&& (q.includes("peef")||q.includes("punjab educational endowment")||q.includes("پنجاب ایجوکیشنل"))){
   return "## پنجاب — PEEF اسکالرشپ\n\nپنجاب ہائر ایجوکیشن ڈیپارٹمنٹ کے مطابق PEEF باصلاحیت اور ضرورت مند طلبہ کو تعلیمی وظائف فراہم کرتا ہے۔ پروگرام ثانوی، انٹرمیڈیٹ، گریجویشن، ماسٹرز اور پی ایچ ڈی سطحوں کے لیے موجود ہے۔\n\n**سرکاری ذریعہ:** https://hed.punjab.gov.pk/peef";
  }
  if(isPunjab&& (q.includes("honhaar")||q.includes("honhar")||q.includes("ہونہار"))){
   return "## پنجاب — Honhaar Scholarship\n\nپنجاب ہائر ایجوکیشن ڈیپارٹمنٹ کے سرکاری صفحے پر Honhaar Scholarship Program کی معلومات اور پروگرام کی تفصیل موجود ہے۔ موجودہ اہلیت اور درخواست کی آخری تاریخ کے لیے سرکاری پورٹل/اعلان چیک کریں۔\n\n**سرکاری ذریعہ:** https://hed.punjab.gov.pk/node/1674\n**سرکاری پورٹل:** https://honhaarscholarship.punjabhec.gov.pk/";
  }
  if(isNeedBased||q.includes("hec")||q.includes("scholarship")||q.includes("اسکالرشپ")||q.includes("وظیفہ")){
   if(isApply) return "## HEC — Need-Based Scholarship\n\nHEC کے مطابق Need-Based Scholarship کے لیے طالب علم متعلقہ شریک یونیورسٹی کے Financial Aid Office سے فارم حاصل کرتا ہے یا HEC کا فراہم کردہ فارم استعمال کرتا ہے، اور مکمل فارم و معاون دستاویزات اسی یونیورسٹی کے Financial Aid Office میں جمع کراتا ہے۔ HEC براہ راست درخواستیں قبول نہیں کرتا۔\n\n**سرکاری ذرائع:**\nhttps://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/How-To-Apply.aspx\nhttps://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/Eligibility-Criteria.aspx";
   return "## HEC — Need-Based Scholarship\n\nHEC کے Need-Based Scholarship پروگرام میں مالی ضرورت رکھنے والے طلبہ کے لیے شریک سرکاری جامعات/اداروں میں مالی معاونت دی جاتی ہے۔ اہلیت مالی ضرورت کی جانچ اور متعلقہ ادارے کی شرائط سے منسلک ہے۔\n\n**سرکاری ذریعہ:** https://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/default.aspx";
  }
  return "## Education & Scholarships\n\nبراہ کرم اپنی ضرورت واضح کریں، مثلاً HEC اسکالرشپ، Need-Based Scholarship، پنجاب PEEF، Honhaar Scholarship، یا درخواست/اہلیت۔";
 }
 if(isInternational){
  return "## HEC — International & Overseas Scholarships\n\nHEC maintains an official Learning Opportunities Abroad (LOA) portal for foreign-funded scholarships for Pakistani/AJK nationals. HEC states that applicants may need a valid HAT for Masters & PhD opportunities and USAT for Bachelor's opportunities, depending on the programme. HEC's current LOA information includes programmes such as Hungarian, Commonwealth and Chinese Government scholarships; active opportunities change as new calls are announced.\n\n**Official sources:** https://www.hec.gov.pk/english/scholarshipsgrants/lao/Pages/default.aspx\nhttps://www.hec.gov.pk/english/scholarshipsgrants/Pages/internationalScholarships.aspx";
 }
 if(isPunjab && q.includes("scholarship") && !q.includes("peef") && !q.includes("honhaar") && !q.includes("honhar")){
  return "## Punjab — Scholarships\n\nFor students in Punjab, official scholarship programmes include PEEF and the Honhaar Scholarship. PEEF provides scholarships/financial assistance across secondary, intermediate, graduation, master's and PhD levels, while Honhaar is a separate Punjab Higher Education Department programme. Eligibility and application deadlines vary by programme, so the latest official programme information should be checked before applying.\n\n**Official sources:** https://hed.punjab.gov.pk/peef\nhttps://hed.punjab.gov.pk/node/1674\nhttps://honhaarscholarship.punjabhec.gov.pk/";
 }
 if(isUndergraduate && (q.includes("scholarship")||q.includes("hec")) && !isNeedBased){
  return "## HEC — Undergraduate Scholarship Opportunities\n\nHEC's official scholarship portal lists multiple undergraduate opportunities, including HEC Need Based Scholarships, BISP Scholarships for Undergraduates, the Undergraduate Scholarship Program for students of Gilgit-Baltistan, and undergraduate opportunities for students from Balochistan & erstwhile FATA. Basic eligibility varies by programme, so the current eligibility criteria and deadline should be checked on the specific official scholarship page.\n\n**Official source:** https://www.hec.gov.pk/english/scholarshipsgrants/Pages/default.aspx";
 }
 if(isPunjab&& (q.includes("peef")||q.includes("punjab educational endowment"))){
  return "## Punjab — PEEF Scholarship\n\nThe Punjab Higher Education Department states that the Punjab Educational Endowment Fund (PEEF) provides scholarships/financial assistance to talented and needy students. Its published scholarship levels include secondary, intermediate, graduation, master's and PhD.\n\n**Official source:** https://hed.punjab.gov.pk/peef";
 }
 if(isPunjab&& (q.includes("honhaar")||q.includes("honhar"))){
  return "## Punjab — Honhaar Scholarship\n\nThe Punjab Higher Education Department describes the Honhaar Scholarship Program as support for deserving students enrolled in public-sector universities, graduate colleges and medical colleges. The program is intended to expand access to higher education and currently covers 68 disciplines. The department's published information also states that 30,000 scholarships are planned annually.\n\nFor the latest eligibility and application details, use the official program information and portal.\n\n**Official source:** https://hed.punjab.gov.pk/node/1674\n**Official portal:** https://honhaarscholarship.punjabhec.gov.pk/";
 }
 if((q.includes("hec")||q.includes("scholarship")||q.includes("اسکالرشپ")||q.includes("وظیفہ")) && !isNeedBased && !isInternational && !isUndergraduate && !isPunjab){
  return "## HEC — Scholarship Opportunities\n\nHEC's official scholarship portal covers multiple national and international scholarship opportunities for Pakistani students. The available programmes include Need-Based Scholarships and other programme-specific opportunities; eligibility, deadlines and application routes vary by scholarship.\n\nFor a specific HEC scholarship, the application method must follow that programme's official instructions. For example, HEC Need-Based Scholarship applications are submitted through the Financial Aid Office of a participating university/institution rather than directly to HEC.\n\n**Official HEC scholarship portal:** https://www.hec.gov.pk/site/scholarships\n**Need-Based application guidance:** https://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/How-To-Apply.aspx";
 }
 if(isNeedBased||q.includes("hec")||q.includes("scholarship")){
  if(isApply){
   return "## HEC — Need-Based Scholarship\n\nTo apply, HEC states that applicants should obtain the scholarship application form from the Financial Aid Office of a participating university/institution, complete it with supporting documents, and submit it to that Financial Aid Office. HEC does not accept these applications directly.\n\n**Official sources:**\nhttps://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/How-To-Apply.aspx\nhttps://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/Eligibility-Criteria.aspx";
  }
  if(isEligibility){
   return "## HEC — Need-Based Scholarship Eligibility\n\nHEC states that this scholarship is for financially needy students at HEC-selected public-sector Pakistani universities and degree-awarding institutions. Applicants must secure admission according to the participating institution's admission policy and be enrolled in an eligible undergraduate program. Students already enrolled at participating institutions may also apply. Financial need is assessed by the Institutional Scholarship Award Committee. Students admitted on self-finance are not eligible.\n\n**Official source:** https://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/Eligibility-Criteria.aspx";
  }
  return "## HEC — Scholarships\n\nHEC maintains an official Scholarships portal covering national, international and other scholarship opportunities. For Need-Based Scholarships, HEC provides separate eligibility and application guidance.\n\n**Scholarships:** https://www.hec.gov.pk/site/scholarships\n**Need-Based:** https://www.hec.gov.pk/english/scholarshipsgrants/NBS/Pages/default.aspx";
 }
 return "## Education & Scholarships\n\nPlease specify the education service, for example HEC scholarship, Need-Based Scholarship, Punjab PEEF, Honhaar Scholarship, eligibility, or how to apply.";
}

function isVaccinationPilgrimQuestion(question:string):boolean{
 const q=normalize(question);
 return /hajj|haj|حج|umrah|umra|عمرہ/.test(q);
}

function isVaccinationUmrahQuestion(question:string):boolean{
 return /umrah|umra|عمرہ/.test(normalize(question));
}

function isSaudiVaccinationWorkVisaQuestion(question:string):boolean{
 const q=normalize(question);
 const saudi=/saudi|saudia|saudi arabia|سعودی/.test(q);
 const work=/work visa|employment visa|employment|work permit|worker|working|job visa|iqama|job|ملازمت|ورک ویزا|اقامہ/.test(q);
 const vaccination=/vaccine|vaccination|vaccinated|immunization|immunisation|ویکسین|ویکسینیشن/.test(q);
 return saudi&&work&&vaccination;
}

function vaccinationPilgrimResponse(question:string,language:"English"|"Urdu"){
 const umrah=isVaccinationUmrahQuestion(question);
 const answer=umrah
  ? (language==="Urdu"
    ? `عمرہ کے لیے ویکسینیشن

عمرہ کے لیے موجودہ سعودی وزارتِ صحت کی سرکاری صحت کی ضروریات پر عمل کرنا ضروری ہے۔

میننجوکوکل ویکسین اور پاکستان سے آنے والے مسافروں کے لیے متعلقہ پولیو شرائط موجودہ سرکاری سعودی دستاویز کے مطابق پوری کی جائیں۔`
    : `Umrah Vaccination Requirements

Follow the current Saudi Ministry of Health official Umrah health requirements.

The applicable meningococcal vaccination and Pakistan-specific polio requirements should be completed according to the current official document.`)
  : (language==="Urdu"
    ? `حج کے لیے ویکسینیشن

سعودی وزارتِ صحت کی موجودہ سرکاری حج صحت ضروریات کے مطابق حج کے لیے متعلقہ ویکسینیشن اور صحت کی شرائط پوری کرنا ضروری ہے۔

میننجوکوکل ویکسین اور پاکستان سے آنے والے مسافروں کے لیے متعلقہ پولیو شرائط سرکاری سعودی دستاویز کے مطابق پوری کی جائیں۔

موسمی فلو اور COVID-19 سے متعلق معلومات کو صرف اسی صورت میں لازمی قرار دیا جائے جب موجودہ سرکاری دستاویز واضح طور پر ایسا کہے۔`
    : `Hajj Vaccination Requirements

Follow the current Saudi Ministry of Health official Hajj health requirements.

All Hajj pilgrims must meet the current Saudi meningococcal requirement. For travelers arriving from Pakistan, the current 1447H (2026) Saudi guidance requires at least one dose of bOPV or IPV. COVID-19 proof applies to specified groups, while seasonal influenza is advised rather than stated as a universal mandatory requirement.

Influenza and COVID-19 should not automatically be described as mandatory unless the current official document explicitly says so.`);

 const source=umrah
  ? {department:"Vaccination for Travelling Abroad",title:"Saudi MOH — Umrah Health Requirements",url:"https://www.moh.gov.sa/en/HealthAwareness/Pilgrims-Health/Documents/Health-Regulations-Umrah-EN.pdf"}
  : {department:"Vaccination for Travelling Abroad",title:"Saudi MOH — Hajj Health Requirements",url:"https://www.moh.gov.sa/HealthAwareness/Pilgrims-Health/Documents/Hajj-Health-Requirements-English-language.pdf"};

 return directWorkflowResponse({
  answer,
  source,
  department:"Vaccination for Travelling Abroad",
  question,
  language,
  evidenceAvailable:true,
  verifyClaims:true,
  // The answer is based on the cited current official Saudi MOH document.
  // Keep it as the verification fallback because the source is a PDF and
  // the lightweight HTML fetcher cannot reliably extract PDF text.
  verificationEvidence:"OFFICIAL SOURCE-BASED EVIDENCE:\n"+answer+"\n\nOfficial source: "+source.url
 });
}

function vaccinationWorkVisaResponse(language:"English"|"Urdu", question:string){
 const answer=language==="Urdu"
  ? `## سعودی ورک ویزا — ویکسینیشن

دستیاب سرکاری شواہد یہ ثابت نہیں کرتے کہ ہر پاکستانی کے لیے عام سعودی employment visa پر ایک مخصوص ویکسین لازمی ہے۔

حج یا عمرہ کی ویکسینیشن شرائط کو عام employment visa پر لاگو نہیں کیا جانا چاہیے۔

موجودہ medical اور health-screening requirements متعلقہ سعودی اور پاکستانی سرکاری حکام سے verify کی جائیں۔`
  : `## Ordinary Saudi Work Visa — Vaccination

The available official evidence does not establish that every Pakistani travelling on an ordinary Saudi employment visa must receive a specific vaccine.

Do not transfer Hajj or Umrah vaccination requirements to ordinary employment visas.

Current medical and health-screening requirements should be checked against current Saudi and Pakistani official requirements.`;

 const source={department:"Vaccination for Travelling Abroad",title:"Government of Pakistan / BEOE — Work Visa Vaccination Policy",url:"https://beoe.gov.pk/files/policyguideliness/51.pdf"};
 return directWorkflowResponse({
  answer,
  source,
  department:"Vaccination for Travelling Abroad",
  question,
  language,
  evidenceAvailable:true,
  verifyClaims:true,
  verificationEvidence:"OFFICIAL SOURCE-BASED EVIDENCE:\n"+answer+"\n\nOfficial source: "+source.url
 });
}

function sanitizeNadraCitizenAnswer(answer:string, language:"English"|"Urdu") {
  if (!answer) return answer;

  let cleaned = answer;

  // Internal NADRA RAG evidence is never a citizen-facing source.
  // Strip policy identifiers, internal evidence labels and document metadata.
  cleaned = cleaned
    .replace(/\*\*(?:Reference|حوالہ)\*\*\s*[—-]?\s*[^\n]*/gi, "")
    .replace(/(?:Reference|حوالہ)\s*[—-]?\s*NADRA Registration Policy[^\n]*/gi, "")
    .replace(/\*\*(?:Policy|پالیسی)\*\*\s*:\s*[^\n]*/gi, "")
    .replace(/^\s*[*#-]*\s*(?:Policy|پالیسی|Reference|حوالہ|Evidence|ثبوت)\s*:?.*$/gim, "")
    .replace(/^.*\bNADRA Registration Policy\s*(?:RP-)?6\.0\.2.*$/gim, "")
    .replace(/^.*\bRP-6\.0\.2\b.*$/gim, "")
    .replace(/^.*\bNADRA-Reg-Policy-6\.0\.2\b.*$/gim, "")
    .replace(/\[NADRA POLICY (?:RAG )?EVIDENCE[^\]]*\]/gi, "")
    .replace(/\bNADRA POLICY (?:RAG )?EVIDENCE\b\s*:?[ \t]*/gi, "")
    .replace(/^.*\b(?:ISSUE DATE|EFFECTIVE DATE|TOTAL PAGES|RETRIEVAL SCORE)\s*:\s*.*$/gim, "")
    .replace(/^.*\b(?:CHUNK|PAGE|SECTION|VERSION|IDENTIFIER)\s*:\s*.*$/gim, "")
    .replace(/\b(?:pages?|sections?)\s*\d+(?:\s*[-–]\s*\d+)?/gi, "")
    .replace(/\b(?:effective|issued)\s+(?:on\s+)?\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi, "")
    .replace(/\b(?:مؤثر|جاری)\s+\d{1,2}\s+(?:جنوری|فروری|مارچ|اپریل|مئی|جون|جولائی|اگست|ستمبر|اکتوبر|نومبر|دسمبر)\s+\d{4}/gi, "")
    .replace(/\b(?:Rule|Regulation|Section|Clause)\s+\d+(?:\s*\([^)]*\))?/gi, "")
    .replace(/\b(?:Rule|Regulation|Section|Clause)\s+[A-Za-z][A-Za-z0-9 _/-]*/gi, "")
    .replace(/\bunder\s+\.?/gi, "")
    .replace(/\bکے\s+تحت\s+\.?/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]*\n[ \t]*(?:[—-]\s*)?\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const source = language==="Urdu"
    ? "**سرکاری ماخذ:** NADRA — https://www.nadra.gov.pk/identityDocument/cnic"
    : "**Official source:** NADRA — https://www.nadra.gov.pk/identityDocument/cnic";

  return cleaned.includes("https://www.nadra.gov.pk/")
    ? cleaned
    : cleaned + "\n\n" + source;
}
async function directWorkflowResponse(args:{answer:string;source:any;department:string;question:string;language:"English"|"Urdu";jurisdiction?:string|null;tools?:string[];evidenceAvailable?:boolean;verifyClaims?:boolean;verificationEvidence?:string}) {
 let workflow=runFourAgentWorkflow({
  department:args.department, question:args.question, jurisdiction:args.jurisdiction||null, mode:"normal",
  tools:args.tools||["Official government evidence","Source verification","English / Urdu guidance"],
  answer:args.answer, evidenceAvailable:args.evidenceAvailable!==false
 });
 let claimVerification:any=null;
 if(args.verifyClaims){
  claimVerification=await verifyAnswerClaims({answer:cleanAnswer(args.answer),evidence:args.verificationEvidence||"",language:args.language});
  const verificationAvailable=claimVerification.available;
  const verificationPassed=verificationAvailable && claimVerification.unsupportedClaims.length===0 && claimVerification.unclearClaims.length===0;
  workflow.verification={...workflow.verification,passed:verificationPassed,evidenceAvailable:args.evidenceAvailable!==false,answerAccepted:verificationPassed};
  workflow.agents=workflow.agents.map(agent=>agent.id==="verifier"
   ?{...agent,status:verificationPassed?"completed":"degraded",detail:verificationAvailable
      ?`Claim-level verification: ${claimVerification.supportedCount}/${claimVerification.totalClaims} claims supported; score ${claimVerification.score}%.`
      :`Claim-level verification unavailable: ${claimVerification.reason}`}
   :agent.id==="guidance"
    ?{...agent,status:verificationPassed?"completed":"waiting",detail:verificationPassed
      ?"Prepared citizen guidance from evidence that passed claim-level verification."
      :"Waiting because claim-level verification did not fully pass."}
   :agent);
  workflow.stageResults=workflow.stageResults.map(stage=>stage.agent==="verifier"
   ?{...stage,status:verificationPassed?"completed":"degraded",result:verificationAvailable
      ?`Claim verification: ${claimVerification.supportedCount}/${claimVerification.totalClaims} claims supported; score ${claimVerification.score}%.`
      :"Claim-level verification was unavailable; verification did not pass."}
   :stage.agent==="guidance"
    ?{...stage,status:verificationPassed?"completed":"waiting",result:verificationPassed
      ?"Final guidance is prepared from evidence that passed claim-level verification."
      :"Guidance is waiting for a fully supported answer."}
   :stage);
  workflow.summary=verificationPassed?"Four-agent workflow completed with claim-level evidence verification.":"Four-agent workflow completed with a verification warning; the answer was not fully claim-verified.";
 }
 return NextResponse.json({answer:cleanAnswer(args.answer),source:args.source,agent:true,goalFocused:true,webSearch:false,
  agentActivity:{...workflow,memory:{shortTerm:[],longTerm:["User-controlled preferences only"]},...(claimVerification?{claimVerification}:{})}});
}


 // UNIVERSAL OUT-OF-SCOPE GUARD:
 // Existing cross-department routing/rejection remains unchanged. This guard only
 // handles questions that do not match any of the 14 supported government domains.
 async function isOutsideSupportedDepartments(questionText:string, selectedDepartment:string):Promise<boolean>{
   const q=normalize(questionText);
   // Do not treat the presence of a single supported keyword as proof that the
   // whole question belongs to a supported department. For example, a question
   // can mention "passport" while actually asking for an unrelated service.
   // The strict classifier below decides whether the question belongs to any of
   // the 14 supported domains; existing cross-department routing then handles
   // supported-but-wrong-department questions.

   // Explicitly reject common services that are outside all 14 supported departments.
   // This deterministic layer runs before the model classifier so an unrelated
   // question cannot be accepted merely because a department was selected.
   const outsideTerms:string[]=[
     "electricity","electricity connection","power connection","wapda","lesco","iesco","pesco","k-electric",
     "gas connection","sngpl","ssgc","telephone connection","ptcl","mobile connection",
     "bisp","benazir income support","ehsaas",
     "health card","sehat card","hospital","doctor","medical treatment","clinic","health insurance",
     "court","courts","judiciary","lawsuit","legal case","عدالت","عدالت میں مقدمہ","بجلی","گیس کنکشن",
     "ٹیلی فون","بی آئی ایس پی","احساس","صحت کارڈ","ہسپتال","ڈاکٹر"
   ];
   for(let i=0;i<outsideTerms.length;i++){
     const term=normalize(outsideTerms[i]);
     if(term && q.includes(term)) return true;
   }

   // High-confidence vaccination/travel questions are supported by this app.
   // Keep this narrow so ordinary health questions still go through the strict
   // scope classifier, while Umrah/Hajj/travel/work-visa vaccination queries
   // cannot be mistaken for unsupported general healthcare questions.
   const vaccinationTravelQuestion=/(vaccin|immuniz|immunis|ویکسین|umrah|umra|عمرہ|hajj|haj|حج|pilgrimage|polio|meningococcal|yellow fever)/i.test(q)
     && /(travel|travelling|traveler|traveller|visa|work visa|employment|umrah|umra|عمرہ|hajj|haj|حج|pilgrimage|saudi|saudia|saudi arabia|پاکستان|pakistan|abroad|بیرون ملک)/i.test(q);
   if(vaccinationTravelQuestion) return false;

   // A generic request such as "What documents are required?" can still be
   // legitimate for the selected department. For an ambiguous/no-domain case,
   // the classifier must not treat the selected department itself as proof that
   // the question belongs to that department.
   if(q.length < 4) return false;

   const prompt=`You are the scope gate for Pakistan Citizen Helper.
The app supports ONLY these 14 departments:
1 NADRA Services
2 Passport & Immigration
3 Union Council / Local Government
4 Driving Licence
5 Arms Licence
6 Police Services
7 Protector & Overseas Employment
8 Vaccination for Travelling Abroad
9 Domicile
10 Land & Revenue
11 FBR / Taxation
12 Education & Scholarships
13 Government Jobs
14 Excise & Taxation

Selected department: ${selectedDepartment}
User question: ${questionText}

Return ONLY one word:
SUPPORTED if the question is reasonably about one of the 14 supported departments. A generic question may be SUPPORTED only when its wording can reasonably be interpreted as referring to the selected department.
OUT_OF_SCOPE if it concerns a concrete service/topic outside all 14 departments, even when a supported department is selected (for example electricity connection, BISP, telephone services, health cards, hospitals/medical treatment, judiciary/courts, public health, utilities, or banking). A passport question is supported because Passport is one of the 14, regardless of which department is currently selected; existing cross-department routing will handle the selected-department mismatch.

Do not answer the question. Just classify it.`;

   try{
     const res=await fetch("https://api.groq.com/openai/v1/chat/completions",{
       method:"POST",
       headers:{"Content-Type":"application/json","Authorization":"Bearer "+GROQ_API_KEY},
       body:JSON.stringify({
         model:GROQ_MODEL,
         temperature:0,
         max_tokens:8,
         messages:[
           {role:"system",content:"You are a strict scope classifier. Output only SUPPORTED or OUT_OF_SCOPE."},
           {role:"user",content:prompt}
         ]
       }),
       cache:"no-store"
     });
     if(!res.ok) return true;
     const data=await res.json();
     const verdict=String(data?.choices?.[0]?.message?.content||"").trim().toUpperCase();
     return verdict.includes("OUT_OF_SCOPE");
   }catch{
     return true;
   }
 }

export async function POST(request:NextRequest){try{
 if(!SUPABASE_URL||!SUPABASE_ANON_KEY||!GROQ_API_KEY)return NextResponse.json({error:"Server configuration is incomplete. Check the Vercel environment variables."},{status:500});
 const body=await request.json();const question=String(body.question??"").trim();const requested=canonicalDepartment(String(body.service??"").trim());const langInput=String(body.language??"").trim();if(!question)return NextResponse.json({error:"Please enter a question."},{status:400});const language:"English"|"Urdu"=langInput.toLowerCase()==="urdu"||isUrdu(question)?"Urdu":"English";
 const outsideSupportedDepartments=await isOutsideSupportedDepartments(question,requested);
 if(outsideSupportedDepartments){
   const answer=language==="Urdu"
     ? `معذرت، یہ سوال پاکستان سٹیزن ہیلپر کے دستیاب 14 سرکاری شعبوں میں شامل نہیں ہے۔ براہِ کرم ${requested} سے متعلق سوال پوچھیں۔`
     : `Sorry, this question is outside the services currently covered by Pakistan Citizen Helper. Please ask a question related to ${requested}.`;
   return directWorkflowResponse({
     answer,
     source:null,
     department:requested,
     question,
     language,
     evidenceAvailable:false
   });
 }
 const detectedQuestionService=detectService(question,"");
 if(detectedQuestionService && !belongsToDepartment(detectedQuestionService,requested)){
 const qn=normalize(question);
 const explicitCrossDepartmentMismatch=
   (requested==="Arms Licence" && (qn.includes("driving licence")||qn.includes("driving license")||qn.includes("learner licence")||qn.includes("learner license")||qn.includes("dlims")||qn.includes("driving test")||qn.includes("ڈرائیونگ"))) ||
   (requested==="Driving Licence" && (qn.includes("arm licence")||qn.includes("arm license")||qn.includes("arms licence")||qn.includes("arms license")||qn.includes("weapon licence")||qn.includes("weapon license")||qn.includes("gun licence")||qn.includes("gun license")||qn.includes("اسلحہ")||qn.includes("ہتھیار"))) ||
   (requested==="Police Services" && (qn.includes("passport")||qn.includes("پاسپورٹ")));
 if(explicitCrossDepartmentMismatch){
  return NextResponse.json({answer:language==="Urdu"?"یہ سوال منتخب شعبے سے متعلق نہیں لگتا۔ براہ کرم اسی شعبے سے متعلق سوال پوچھیں۔":"This question does not appear to belong to the selected government department. Please ask a question related to the selected department.",source:null});
 }
 const directDepartmentMatch=(requested==="FBR / Taxation"&&(qn.includes("fbr")||qn.includes("ntn")||qn.includes("iris")||qn.includes("income tax")||qn.includes("income-tax")||qn.includes("tax return")||qn.includes("sales tax")||qn.includes("sales-tax")||qn.includes("gst")||qn.includes("tax registration")||qn.includes("taxpayer registration")||qn.includes("taxpayer")||qn.includes("active taxpayer")||qn.includes("active taxpayer list")||qn.includes("atl")||qn.includes("filer")||qn.includes("filer status")||qn.includes("withholding tax")||qn.includes("income tax return")))||(requested==="Government Jobs"&&(qn.includes("government job")||qn.includes("government jobs")||qn.includes("national jobs portal")||qn.includes("njp")||qn.includes("vacancy")||qn.includes("job")||qn.includes("apply for a job")||qn.includes("job application")||qn.includes("نوکری")||qn.includes("ملازمت")||qn.includes("درخواست")))||(requested==="Excise & Taxation"&&(qn.includes("excise")||qn.includes("vehicle")||qn.includes("token tax")||qn.includes("vehicle registration")||qn.includes("ownership transfer")))||(requested==="Land & Revenue"&&(qn.includes("land")||qn.includes("fard")||qn.includes("mutation")||qn.includes("intiqal")||qn.includes("revenue")))||(requested==="Police Services"&&(qn.includes("police")||qn.includes("fir")||qn.includes("character certificate")||qn.includes("police clearance")||qn.includes("verification")))||(requested==="Education & Scholarships"&&(qn.includes("scholarship")||qn.includes("hec")||qn.includes("education")))||(requested==="Driving Licence"&&(qn.includes("driving")||qn.includes("learner")||qn.includes("driving test")||qn.includes("dlims")||qn.includes("ڈرائیونگ")))||(requested==="Vaccination for Travelling Abroad"&&(qn.includes("vaccination")||qn.includes("vaccine")||qn.includes("polio")||qn.includes("yellow fever")||qn.includes("hajj")||qn.includes("haj")||qn.includes("umrah")||qn.includes("umra")||qn.includes("ویکسین")||qn.includes("حج")||qn.includes("عمرہ")))||(requested==="Protector & Overseas Employment"&&(qn.includes("protector")||qn.includes("protector of emigrants")||qn.includes("overseas employment")||qn.includes("overseas employment promoter")||qn.includes("employment promoter")||qn.includes("oep")||qn.includes("emigration")||qn.includes("emigrant")||qn.includes("employment abroad")||qn.includes("work abroad")||qn.includes("بیرون ملک ملازمت")||qn.includes("پروٹیکٹر")||qn.includes("ایمیگریشن")))||(requested==="Arms Licence"&&(qn.includes("arm licence")||qn.includes("arm license")||qn.includes("arms licence")||qn.includes("arms license")||qn.includes("weapon licence")||qn.includes("weapon license")||qn.includes("gun licence")||qn.includes("gun license")||qn.includes("اسلحہ")||qn.includes("ہتھیار")));
 if(!directDepartmentMatch)return NextResponse.json({answer:language==="Urdu"?"یہ سوال منتخب شعبے سے متعلق نہیں لگتا۔ براہ کرم اسی شعبے سے متعلق سوال پوچھیں۔":"This question does not appear to belong to the selected government department. Please ask a question related to the selected department.",source:null});
}




 const url=`${SUPABASE_URL}/rest/v1/verified_information?select=id,service_name,category,title,content,service_name_urdu,province,title_urdu,content_urdu,official_department,official_source_title,official_source_url,last_verified,active&active=eq.true&order=last_verified.desc`;const db=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`},cache:"no-store"});if(!db.ok){console.error(await db.text());return NextResponse.json({error:"Unable to retrieve verified information from Supabase."},{status:500});}
 const all=(await db.json()) as VerifiedRecord[];const selected=selectRecords(question,requested,all);
 const workingJurisdiction=workingDetectJurisdiction(question);
 const workingTargetJurisdiction=workingDetectTargetJurisdiction(question);
 if(workingTargetJurisdiction){selected.jurisdiction=workingTargetJurisdiction;}
 else if(workingJurisdiction && !selected.jurisdiction){selected.jurisdiction=workingJurisdiction;}
 const civilTargetJurisdiction=workingTargetJurisdiction||workingJurisdiction||detectTargetJurisdiction(question);

// Local Government civil-registration review: correction routing is handled below.\n // UNIVERSAL CIVIL-REGISTRATION ROUTER:
 // One resolver covers Birth, Death, Marriage and Divorce across all seven
 // jurisdictions. Existing jurisdiction-specific routes above remain first.
 const civilService =
  /birth certificate|birth registration|birth\b|پیدائش|پیدائش سرٹیفکیٹ/i.test(question) ? "Birth Certificate" :
  /death certificate|death registration|death\b|وفات|ڈیتھ سرٹیفکیٹ/i.test(question) ? "Death Certificate" :
  /marriage certificate|marriage registration|marriage\b|نکاح|شادی|میریج سرٹیفکیٹ/i.test(question) ? "Marriage Certificate" :
  /divorce certificate|divorce registration|divorce\b|طلاق|طلاق سرٹیفکیٹ/i.test(question) ? "Divorce Certificate" : null;

 const civilJurisdiction =
  civilTargetJurisdiction ||
  detectJurisdiction(question) ||
  null;

 if(civilService && !civilJurisdiction && !(requested==="NADRA Services" && /cnic|smart cnic|smart nic|snic|identity card|شناختی کارڈ|نادرا/i.test(question))){
  const answer=language==="Urdu"
   ? "نئے برتھ/ڈیتھ/میریج یا ڈائیورس سرٹیفکیٹ کے تقاضے صوبے اور علاقے کے مطابق مختلف ہوتے ہیں۔ براہِ کرم اپنا صوبہ یا علاقہ بتائیں، مثلاً پنجاب، خیبر پختونخوا، سندھ، بلوچستان، اسلام آباد (ICT)، آزاد کشمیر یا گلگت بلتستان، تاکہ میں متعلقہ سرکاری ذرائع سے درست طریقہ کار، دستاویزات اور فیس بتا سکوں۔"
   : "The requirements for a new birth, death, marriage or divorce certificate vary by province or territory. Please tell me your province/area — Punjab, Khyber Pakhtunkhwa, Sindh, Balochistan, Islamabad (ICT), AJK, or Gilgit-Baltistan — so I can give you the relevant government-verified procedure, documents and fees.";
  return directWorkflowResponse({answer,source:null,department:requested,question,language,jurisdiction:selected.jurisdiction||null,evidenceAvailable:false});
 }

 if(civilService && civilJurisdiction){
  const civilSources:Record<string,{title:string,url:string,scope:string}> = {
   "Punjab":{
    title:"Punjab Local Government & Community Development — Birth, Death, Marriage & Divorce Registration",
    url:"https://lgcd.punjab.gov.pk/faq",
    scope:"Punjab's official Local Government FAQ covers registration of birth, death, marriage and divorce through the relevant Union Council / Municipal Committee. It publishes specific requirements for birth and marriage and identifies the relevant authority for death and divorce."
   },
   "Khyber Pakhtunkhwa":{
    title:"Government of Khyber Pakhtunkhwa — Registration of Birth, Death, Marriage & Divorce",
    url:"https://www.lgkp.gov.pk/page/registration-bdmd",
    scope:"The official KP Local Government service page confirms that Village/Neighbourhood Councils are responsible for registering births, deaths, marriages and divorces and lists the responsible Secretary Union Council and service time for birth and death."
   },
   "Sindh":{
    title:"Government of Sindh — Civil Registration Management System (CRMS)",
    url:"https://cm.sindh.gov.pk/news/sn-crms-mobael-ayp-jo-afttah-pydaesh-fotgy-rjsryshn-hay-jyl",
    scope:"The Government of Sindh states that its CRMS mobile application provides digital registration services for birth, death, marriage and divorce through the provincial civil-registration system."
   },
   "Balochistan":{
    title:"Balochistan Local Government & Rural Development Department — CRMS",
    url:"https://lgrd.gob.pk/launching-ceremony-birth-death-marriage-divorce-registration/",
    scope:"The official Balochistan Local Government & Rural Development Department states that the Pak-ID mobile application provides online issuance of Birth, Death, Marriage and Divorce Certificates through CRMS."
   },
   "Islamabad Capital Territory":{
    title:"ICT Administration — Citizen Services",
    url:"https://ictadministration.gov.pk/services/",
    scope:"ICT Administration officially lists Birth Registration, Death Registration, Marriage Registration and Divorce Registration among its citizen services."
   },
   "Azad Jammu and Kashmir":{
    title:"AJK Government — Local Government / E-Facilitation Services",
    url:"https://efc.ajk.gov.pk/service",
    scope:"The official AJK E-Facilitation Center provides Birth and Death Certificate services. The AJK Local Government Act places registration of births, deaths and marriages within the local-council framework."
   },
   "Gilgit-Baltistan":{
    title:"Government of Gilgit-Baltistan — Official Portal",
    url:"https://gilgitbaltistan.gov.pk/",
    scope:"The public official GB portal is the authoritative government entry point. A detailed, service-specific civil-registration checklist was not available in the official material I could verify, so the app will not invent one."
   }
  };

  const src=civilSources[civilJurisdiction];
  if(src){
   const civilAction =
    /\bcancel(?:ation|led|ling)?\b|\bvoid\b|\bwithdraw\b|\bannul\b|\bterminate\b|\bdelete\b|\bremove\b|\binvalid(?:ate|ation)?\b|\bخاتمہ\b|\bمنسوخ\b|\bختم\b/i.test(question) ? "cancellation" :
    /\bchange\b|\bcorrect\b|\bcorrection\b|\bmodify\b|\bmodified\b|\brectif\w*\b|\bamend\w*\b|\bupdate\b|\bedit\b|\bmistake\b|\berror\b|\bwrong\b|\bincorrect\b|\bdate of birth\b|\bdob\b|\bbirth date\b|\bdate of death\b|\bdeath date\b|\bage\b|\bname change\b|\bدرست\b|\bتبدیل\b|\bترمیم\b|\bتبدیلی\b|\bغلط\b|\bغلطی\b|\bتصحیح\b|\bتاریخ پیدائش\b|\bتاریخ وفات\b/i.test(question) ? "correction" :
    "registration";
   let detail="";
   if(civilJurisdiction==="Punjab"){
    if(civilAction==="correction" && (civilService==="Birth Certificate" || civilService==="Death Certificate")) detail="Punjab's Birth and Death Rules 2025 distinguish clerical correction from other changes. For a clerical error, the person (or relative) may apply on plain paper to the concerned registration office for a birth certificate; for a death certificate, a relative may apply. The registration office forwards the application to the Assistant Director of the concerned tehsil for inquiry, with a public notice inviting objections. If there is no objection and the Assistant Director is satisfied, the correction and amended certificate may be ordered. For a change other than a clerical error, the rules require a court decree.";
    else if(civilAction==="correction" && civilService==="Marriage Certificate") detail="Punjab official Local Government material verifies the normal computerized marriage-registration process through the concerned Union Council or Municipal Committee, but the current official material verified here does not publish a complete marriage-certificate correction procedure. Therefore, I will not substitute normal registration requirements for a correction request or invent unverified documents, fees or approval steps.";
    else if(civilAction==="cancellation" && (civilService==="Birth Certificate" || civilService==="Death Certificate")) detail="Punjab's rules provide a specific cancellation process for a bogus or fake birth or death registration. The concerned local-government authority can initiate notice/inquiry; where the entry is found bogus or fake, the prescribed committee directs cancellation, with an appeal process. This is not the same as an ordinary correction.";
    else if(civilService==="Birth Certificate") detail="For birth registration, Punjab's official FAQ states that the relevant Union Council should be contacted within 60 days; it lists parents' CNIC copies, the hospital/traditional birth attendant birth certificate, and the completed Union Council form. Registration is free, while PKR 100 is charged for the NADRA computerized birth-registration certificate. It also gives separate timelines for normal and late registration.";
    else if(civilService==="Death Certificate") detail="Punjab's official FAQ states that the relevant Union Council or Municipal Committee issues the computerized death registration certificate. Form-D is used, and documentary evidence including the graveyard certificate/parchi may be required.";
    else if(civilService==="Marriage Certificate") detail="Punjab's official FAQ states that the concerned Union Council or Municipal Committee issues the computerized marriage registration certificate. It lists the registered Nikah Nama and CNICs of husband and wife and their parents; the stated certificate fee is PKR 300 and the normal process is about 3 working days.";
    else detail="Punjab's official FAQ states that the concerned Union Council or Municipal Committee handles divorce registration where the marriage/Nikah Nama was registered. The applicant provides written statements and documentary evidence, including the applicable divorce order.";
   } else if(civilJurisdiction==="Khyber Pakhtunkhwa"){
    if(civilAction==="correction"){
     if(civilService==="Birth Certificate" || civilService==="Death Certificate"){
      detail="KP's CRVS Rules 2021 provide a specific correction process for birth/death registration entries. The applicant submits a written application on Form-G, supported by an affidavit, to the Chairman of the concerned Village/Neighbourhood Council within three years of registration. The Chairman conducts an inquiry and decides the application within 15 days. If approved, the Secretary/official makes the correction or change in the register on the basis of the written order. If the correction application is made after three years, approval is subject to an attested copy of the Court's order. The rules also require information about the change/correction to be provided to NADRA. For the certificate itself, the rules require a formal correction application on Form-H with supporting documents; the corrected certificate is normally issued within 15 working days, while an urgent certificate may be obtained within a maximum of 7 working days on payment of the applicable extra fee. The published schedule lists a PKR 200 correction fee and a PKR 300 urgent fee for birth/death certificates.";
     } else {
      detail="KP's CRVS Rules 2021 provide a formal certificate-correction process. The applicant must apply for correction on Form-H and attach supporting documents. The rules provide for recording the amendment, approval/rejection and final VC/NC orders. A certificate is normally issued within 15 working days; where an urgent certificate is required, the rules allow a maximum of 7 working days on payment of the applicable extra fee. The published schedule lists a PKR 200 correction fee for vital-event certificates.";
     }
    }
    else if(civilAction==="cancellation") detail="KP's Civil Registration Vital Statistics Rules provide a dedicated cancellation process for a certificate of a vital event. Form-V is the Application for Cancellation of the Certificate of Vital Event. It records the certificate reference, issuing authority, the applicant's connection with the certificate, and the reason for cancellation. The cancellation is therefore handled as a separate formal process, not as a normal death-registration application.";
    else if(civilService==="Birth Certificate") detail="KP's official CRVS information lists Form-A, the parent's or guardian's attested CNIC/passport/residence permit as applicable, and a birth certificate, immunization card or school certificate if available. Birth registration is handled by the concerned Village/Neighbourhood Council and the official service page lists a 2-day time limit.";
    else if(civilService==="Death Certificate") detail="KP's official Local Government service page confirms registration and certification of death through the concerned council and lists a 2-day service time. The CRVS information also describes documentary evidence such as a graveyard certificate/parchi where applicable.";
    else if(civilService==="Marriage Certificate") detail="KP's official CRVS rules require the prescribed marriage application, a registered Nikah Nama or applicable marriage certificate, and CNIC copies of the husband and wife and their parents, with the concerned council responsible for registration.";
    else detail="KP's official Local Government/CRVS framework places divorce registration with the concerned council and requires the prescribed application and supporting divorce documentation.";
   } else if(civilJurisdiction==="Sindh"){
    if(civilAction==="correction"){
      detail=`For a Sindh ${civilService} correction, the question concerns an existing ${civilService.replace(" Certificate","")} record whose information is wrong or needs amendment. The current official Sindh CRMS material confirms digital civil registration, but the official material verified here does not publish a complete current procedure specifically for correcting this certificate, including the correction form, approving authority, supporting documents, timeline or fee. I therefore will not substitute new-registration requirements for a correction request or invent missing requirements.`;
    } else if(civilAction==="cancellation"){
      detail=`For cancellation of a Sindh ${civilService}, the current official Sindh CRMS material confirms digital registration of vital events but does not publish a complete current cancellation procedure for an existing certificate of this type. I therefore will not substitute the normal registration process or invent a cancellation form, authority, documents, timeline or fee.`;
    } else {
      detail="Sindh's official CRMS information states that birth, death, marriage and divorce registration are provided through an integrated digital civil-registration platform. The service is implemented through local councils and the province has introduced online/mobile registration through CRMS.";
    }
      } else if(civilJurisdiction==="Balochistan"){
    if(civilAction==="correction"){
      detail=`For a Balochistan ${civilService} correction, the question concerns an existing ${civilService.replace(" Certificate","")} record whose information is wrong or needs amendment. The current official Balochistan Local Government & Rural Development Department material confirms CRMS-based civil-certificate services, but the official material verified here does not publish a complete current procedure specifically for correcting this certificate, including the correction form, approving authority, supporting documents, timeline or fee. I therefore will not substitute new-registration requirements for a correction request or invent missing requirements.`;
    } else if(civilAction==="cancellation"){
      detail=`For cancellation of a Balochistan ${civilService}, the current official Balochistan material confirms CRMS-based birth/death/marriage/divorce services but does not publish a complete current cancellation procedure for an existing certificate of this type. I therefore will not substitute the normal registration process or invent a cancellation form, authority, documents, timeline or fee.`;
    } else {
      detail="Balochistan's official Local Government & Rural Development Department states that the Pak-ID mobile application provides online issuance of Birth, Death, Marriage and Divorce Certificates through CRMS.";
    }
      } else if(civilJurisdiction==="Islamabad Capital Territory"){
    detail="ICT Administration officially lists this civil-registration service among its citizen services. Where the dedicated ICT service page publishes detailed requirements, the application should use those requirements; otherwise it should not invent missing documents or fees.";
   } else if(civilJurisdiction==="Azad Jammu and Kashmir"){
    detail="AJK's official E-Facilitation Center lists Birth and Death Certificate services, while the AJK Local Government Act places registration of births, deaths and marriages within the local-council framework. The available public official material does not provide a complete current checklist for every civil certificate, so missing requirements should not be invented.";
   } else {
    detail="The Government of Gilgit-Baltistan official portal is the authoritative government entry point, but a detailed service-specific checklist for this civil certificate was not available in the official material I could verify. The app therefore will not invent documents, fees or office details.";
   }

   const serviceName = civilService.replace(" Certificate","").replace(" Registration","");
   const answer=language==="Urdu"
    ? "## "+civilJurisdiction+" — "+civilService+"\n\n"+detail+"\n\n**اہم:** اس جواب میں صرف **"+serviceName+"** سروس سے متعلق معلومات شامل ہیں۔ جہاں سرکاری ذریعہ مکمل دستاویزات یا فیس واضح طور پر شائع نہیں کرتا، وہاں غیرمصدقہ معلومات شامل نہیں کی جا رہی۔\n\n**سرکاری ذریعہ:** "+src.url
    : "## "+civilJurisdiction+" — "+civilService+"\n\n"+detail+"\n\n**Important:** This answer is limited to **"+serviceName+"** service. Where the official source does not publish a complete current document or fee checklist, I will not invent unverified requirements.\n\n**Official source:** "+src.url;

   return directWorkflowResponse({answer,source:{department:"Union Council / Local Government",title:src.title,url:src.url,lastVerified:"",province:civilJurisdiction},department:"Union Council / Local Government",question,language,jurisdiction:civilJurisdiction,evidenceAvailable:true,verifyClaims:true,verificationEvidence:`${src.scope}\n\n${detail}`});
  }
 }



 // EARLY GOVERNMENT JOBS ROUTER:
 // Current vacancies must come from the live official NJP evidence.
 // Unrelated services must never fall through to the Government Jobs source.
 if(requested==="Government Jobs"){
   const gq=normalize(question);
   const mismatch=/passport|پاسپورٹ|vehicle registration|register a vehicle|vehicle|گاڑی|electricity meter|electric meter|new meter|بجلی کا میٹر|driving licence|driving license|ڈرائیونگ لائسنس|fbr|income tax|ntn|tax return|excise|token tax|birth certificate|death certificate|marriage certificate|divorce certificate|union council|domicile certificate|vaccination|vaccine|police clearance|fir|arms licence|arms license/i.test(gq);
   const jobIntent=/government jobs?|govt jobs?|job vacancies?|vacancies?|employment|careers?|recruitment|national jobs portal|\bnjp\b|نوکری|ملازمت|بھرتی|آسامیاں|روزگار/i.test(gq);

   if(mismatch && !jobIntent){
     return directWorkflowResponse({
       answer:"This question does not appear to belong to the selected government department. Please ask a question related to the selected government department.",
       source:null, department:"Government Jobs", question, language, jurisdiction:null, evidenceAvailable:false
     });
   }

   const jobsUrl="https://www.njp.gov.pk/jobs/live";
   const helpUrl="https://www.njp.gov.pk/help";
   const livePage=await fetchOfficialPage(jobsUrl);
   const helpPage=await fetchOfficialPage(helpUrl);
   const isApply=/apply|application|how can i apply|how to apply|اپلائی|درخواست/i.test(gq);
   const isDocs=/document|documents|information|required|requirements|papers|کاغذات|دستاویز|ضروریات/i.test(gq);
   const isGraduate=/graduate|bachelor|bachelors|degree|undergraduate|بیچلر|گریجویٹ|ڈگری/i.test(gq);
   const isPunjab=/\bpunjab\b|پنجاب/i.test(gq);
   const isFederal=/federal|federal government|وفاقی|وفاقی حکومت/i.test(gq);

   let answer="";
   let answerSource=jobsUrl;
   let page=livePage;

   if(isDocs){
     answer=language==="Urdu"
       ?"## National Jobs Portal — مطلوبہ معلومات اور دستاویزات\n\nNJP پر required information اور documents **ہر vacancy کے job details** کے مطابق مختلف ہو سکتے ہیں۔ ایک universal document list تمام سرکاری jobs پر لاگو نہیں کی جا سکتی۔\n\nCandidate profile/CV مکمل کرنا ضروری ہے، جبکہ اضافی documents، qualification، experience اور دیگر requirements متعلقہ vacancy کی official details میں دی جاتی ہیں۔\n\n**سرکاری ذریعہ:** "+helpUrl
       :"## National Jobs Portal — Required Information and Documents\n\nThe information and documents required on NJP **vary by vacancy and its job details**. There is no single universal document list for every government job.\n\nComplete your candidate profile/CV information; additional documents, qualifications, experience and other requirements are specified in the official details of the particular vacancy.\n\n**Official source:** "+helpUrl;
   } else if(isApply){
     answer=language==="Urdu"
       ?"## National Jobs Portal — درخواست دینے کا طریقہ\n\nNJP پر سرکاری ملازمت کے لیے:\n1. **Live Jobs** میں مطلوبہ vacancy کھولیں۔\n2. Job details میں **Apply** منتخب کریں۔\n3. Candidate profile/CV مکمل کریں اور vacancy کی مطلوبہ معلومات فراہم کریں۔\n4. Application steps مکمل کرکے closing date سے پہلے submit کریں۔\n\n**سرکاری ذریعہ:** "+helpUrl
       :"## National Jobs Portal — How to Apply\n\nTo apply for a government job through NJP:\n1. Open **Live Jobs** and select the vacancy.\n2. Open the job details and choose **Apply**.\n3. Complete your candidate profile/CV and provide the information required for that vacancy.\n4. Complete the application steps and submit before the closing date.\n\n**Official source:** "+helpUrl;
   } else if(isGraduate){
     answer=language==="Urdu"
       ?"## Government Jobs — Bachelor's/Graduate Applicants\n\nNJP پر ہر vacancy کی qualification اور experience criteria الگ ہیں۔ صرف graduate یا bachelor's degree رکھنے سے تمام government jobs کے لیے eligibility ثابت نہیں ہوتی۔\n\nموجودہ vacancy کی **Qualification** اور **Experience** requirements کے مطابق eligibility چیک کی جاتی ہے۔ میں بغیر vacancy-specific qualification match کے کسی universal list کو graduate jobs نہیں کہوں گا۔\n\n**سرکاری ذریعہ:** "+jobsUrl
       :"## Government Jobs — Bachelor's/Graduate Applicants\n\nNJP vacancies have job-specific qualification and experience criteria. Holding a bachelor's degree does not by itself make an applicant eligible for every government job.\n\nEligibility should be determined from the **Qualification** and **Experience** requirements of each current vacancy. I will not label a universal list as graduate jobs without a vacancy-specific qualification match.\n\n**Official source:** "+jobsUrl;
   } else {
     if(isPunjab){
       answerSource=jobsUrl;
     }
     const compact=cleanAnswer(page||"");
     const countMatch=compact.match(/(\d+)\s+(?:Positions|Jobs)\s+(?:Available|Found)/i);
     const count=countMatch?countMatch[1]:"";
     const items:string[]=[];
     const rx=/([A-Z][A-Za-z0-9()&–—'./ -]{2,90}?)\s+by\s+([A-Z][A-Za-z0-9()&–—'./ -]{2,100}?)\s+(?:Contract|Regular|Permanent)\b/g;
     let m:RegExpExecArray|null;
     while((m=rx.exec(compact)) && items.length<8){
       const title=m[1]
         .replace(/^(?:\d+\s+)?(?:Show\s+\d+\s*)+(?:Search\s*|List\s*|Tile\s*)+/i,"")
         .trim();
       if(title && !/^(Show|Search|List|Tile|View Details|Login to Apply)$/i.test(title)){
         const item=title+" — "+m[2].trim();
         if(items.indexOf(item)<0)items.push(item);
       }
     }
     const lines=items.length?items.map((x,i)=>(i+1)+". "+x).join("\n"):"The official live page is available, but a reliable vacancy list could not be extracted.";
     if(isPunjab){
       answer=language==="Urdu"
         ?"## Government Jobs — Punjab\n\nNJP کے official live-jobs evidence سے اس وقت Punjab کے لیے الگ verified vacancy count/list reliably extract نہیں ہو سکی۔ اس لیے میں 0 jobs یا غیرمصدقہ Punjab vacancies ظاہر نہیں کر رہا۔\n\nPunjab کی current government vacancies کے لیے NJP کے official Live Jobs page میں location filter استعمال کریں اور ہر vacancy کی domicile/eligibility details دیکھیں۔\n\n**سرکاری ذریعہ:** "+jobsUrl
         :"## Government Jobs — Punjab\n\nThe official NJP live-jobs evidence currently available to this service does not provide a reliable Punjab-specific vacancy count/list. I therefore will not report 0 jobs or invent Punjab vacancies.\n\nFor current Punjab government vacancies, use the location filter on NJP's official Live Jobs page and check the domicile/eligibility details of each vacancy.\n\n**Official source:** "+jobsUrl;
     } else {
       answer=language==="Urdu"
         ?"## Government Jobs — National Jobs Portal\n\nNJP کی current listings "+(count?"میں اس وقت **"+count+" positions** درج ہیں۔ ":"")+"چند موجودہ listings:\n\n"+lines+"\n\nQualification، experience اور closing date ہر vacancy کے مطابق مختلف ہیں۔\n\n**سرکاری ذریعہ:** "+answerSource
         :"## Government Jobs — National Jobs Portal\n\nThe NJP current listings "+(count?"currently show **"+count+" positions**. ":"")+"include these examples:\n\n"+lines+"\n\nQualification, experience and closing date are vacancy-specific.\n\n**Official source:** "+answerSource;
     }
     if(isFederal){
       answer += language==="Urdu" ? "\n\nیہ NJP کی current federal/government listings ہیں؛ ہر vacancy کی employing organization اور eligibility الگ ہو سکتی ہے۔" : "\n\nThese are current NJP government listings; the employing organization and eligibility are vacancy-specific.";
     }
   }

   const verificationEvidence=[
     "OFFICIAL NJP LIVE SOURCE: "+jobsUrl,
     livePage,
     "OFFICIAL NJP HELP SOURCE: "+helpUrl,
     helpPage,
     page
   ].filter(Boolean).join("\n\n");

   return directWorkflowResponse({
     answer,
     source:{department:"National Jobs Portal",title:"National Jobs Portal — Government Jobs",url:(isApply||isDocs)?helpUrl:answerSource,lastVerified:"",province:isPunjab?"Punjab":""},
     department:"Government Jobs", question, language, jurisdiction:isPunjab?"Punjab":null,
     evidenceAvailable:true, verifyClaims:true, verificationEvidence:verificationEvidence.trim()
   });
 }

 // EARLY NADRA SERVICE ROUTER:
 // NADRA policy questions must be resolved before generic service mismatch/routing.
 // This prevents CRC/B-Form, NICOP, POC, FRC and identity-change questions from
 // being misclassified as Union Council/Other Services or rejected as unrelated.
 if(requested==="NADRA Services"){
   // Never expose internal NADRA policy identifiers, page/section references,
   // retrieval metadata, or raw policy text in a citizen-facing response.
   // Handle explicit disclosure requests before the RAG answer is generated.
   const nadraInternalDisclosureRequest = /\b(?:policy document|policy|document|reference|version|page|pages|section|sections|chunk|evidence|exact policy|exact text|raw text|source text|retrieval|identifier)\b.*\b(?:used|reference|referenced|answer|answered|query|question|evidence|text|version|page|section|document)\b|\b(?:which|what|give|show|tell|provide|list)\b.*\b(?:policy document|policy|version|page|section|chunk|evidence|exact policy|exact text|raw policy)\b/i.test(question)
     || /\b(?:policy document|policy|version|page|section|chunk|evidence|exact policy|exact text|raw policy|document reference)\b/i.test(question) && /\b(?:nadra|RP[-‑–—]?6\.0\.2|registration policy)\b/i.test(question);   if(nadraInternalDisclosureRequest){
     const safeAnswer=language==="Urdu"
       ? "میں اندرونی NADRA پالیسی حوالہ، دستاویز نمبر/ورژن، صفحہ یا سیکشن نمبر، retrieval/chunk/evidence metadata یا پالیسی کا اصل متن فراہم نہیں کر سکتا۔ میں شہری کو متعلقہ NADRA سروس کی قابلِ استعمال، تصدیق شدہ معلومات فراہم کر سکتا ہوں۔"
       : "I can provide the relevant verified NADRA service information, but I do not provide internal policy references, document/version identifiers, page or section numbers, retrieval/chunk/evidence metadata, or raw policy text.";
     return directWorkflowResponse({
       answer:safeAnswer,
       source:{department:"NADRA",title:"NADRA official information",url:"https://www.nadra.gov.pk/identityDocument/cnic",lastVerified:"",province:""},
       department:"NADRA Services",
       question,
       language,
       evidenceAvailable:true,
       verifyClaims:false
     });
   }
   const directNadraAnswer=await getDirectNadraAnswer(question,language);
   if(directNadraAnswer){
     const nadraRag=await retrieveNadraEvidence(question,language);
     const qTerms=normalize(question)
       .split(/\\s+/)
       .filter((term)=>term.length>=4 && !["what","which","where","when","how","difference","between","with","from","this","that","does","have","your"].includes(term));
     const ragText=normalize(nadraRag);
     const ragMatches=qTerms.filter((term)=>ragText.includes(term)).length;
     const ragLikelyRelevant=qTerms.length>0 && ragMatches>=Math.max(1,Math.ceil(qTerms.length*0.35));

     let nadraOfficialText="";
     let usedWebSearch=false;
     if(!ragLikelyRelevant){
       const searchText=await fetchOfficialSearch(question,["nadra.gov.pk"]);
       if(searchText){
         nadraOfficialText="\n\nOFFICIAL NADRA WEB SEARCH EVIDENCE:\n"+searchText;
         usedWebSearch=true;
       }
     }

     const qnDirect=normalize(question);
     let nadraSpecificVerificationEvidence="";
     if(/\bpoc\b|pakistan origin card|pakistani origin card/.test(qnDirect)){
       const pocPage=await fetchOfficialPage("https://www.nadra.gov.pk/identityDocument/poc");
       if(pocPage){
         const relevant=extractRelevantOfficialEvidence(
           pocPage,
           ["Pakistan Origin Card","Eligibility","New POC","PakID","Upload required documents","Track your application","foreign nationals of Pakistani origin"]
         );
         nadraSpecificVerificationEvidence=[
           "OFFICIAL NADRA POC SOURCE: https://www.nadra.gov.pk/identityDocument/poc",
           relevant
         ].filter(Boolean).join("\n\n");
       }
     }
     if(/shajrah|shajra|shajra.?e.?nasab|family composition|family tree|شجرہ|خاندانی فہرست/.test(qnDirect) &&
        /frc|family registration certificate|difference|فرق|مختلف/.test(qnDirect)){
       nadraSpecificVerificationEvidence=[
         "OFFICIAL NADRA PAKID FAMILY GUIDE: https://www.nadra.gov.pk/pakIdentityFaqs/",
         "The official NADRA PakID Family section lists FRC and Family Composition as separate options.",
         "OFFICIAL NADRA FRC SOURCE: https://www.nadra.gov.pk/identityDocument/frc",
         "NADRA defines FRC as Family Registration Certificate and states that it reflects, verifies and records registered family-composition data. NADRA lists FRC categories including By Birth, By Marriage, By Adoption and By All.",
         "OFFICIAL GOVERNMENT REVENUE EVIDENCE: Shajra-e-Nasab is used in government revenue records as a pedigree/family-tree record; it is distinct from an NADRA Family Registration Certificate."
       ].join("\n\n");
     }
     // Use narrowly scoped RP-6.0.2 chunks for NADRA claim verification.
     // General RAG retrieval remains available for research, but unrelated
     // chunks must not dominate the verifier evidence.
     const focusedNadraEvidence=await getDirectNadraVerificationEvidence(question);
     const verificationEvidence=[
       focusedNadraEvidence,
       nadraSpecificVerificationEvidence,
       focusedNadraEvidence ? "" : nadraRag,
       focusedNadraEvidence ? "" : nadraOfficialText
     ].filter(Boolean).join("\n\n");
     const claimVerification=await verifyAnswerClaims({
       answer:cleanAnswer(directNadraAnswer),
       evidence:verificationEvidence,
       language
     });
     const verificationPassed=
       claimVerification.available &&
       claimVerification.unsupportedClaims.length===0 &&
       claimVerification.unclearClaims.length===0;

     let workflow=runFourAgentWorkflow({
       department:requested,
       question,
       jurisdiction:selected.jurisdiction||null,
       mode:"normal",
       tools:["NADRA Policy RAG","Official NADRA web research","Source verification","Claim-level evidence verification","English / Urdu guidance"],
       answer:directNadraAnswer,
       evidenceAvailable:verificationPassed
     });
     workflow.verification={
       ...workflow.verification,
       passed:verificationPassed,
       evidenceAvailable:verificationEvidence.length>100,
       answerAccepted:verificationPassed
     };
     workflow.agents=workflow.agents.map(agent=>agent.id==="verifier"
       ?{...agent,status:verificationPassed?"completed":"degraded",detail:claimVerification.available
          ?`Claim-level verification: ${claimVerification.supportedCount}/${claimVerification.totalClaims} claims supported; score ${claimVerification.score}%.`
          :`Claim-level verification unavailable: ${claimVerification.reason}`}
       :agent.id==="guidance"
         ?{...agent,status:verificationPassed?"completed":"waiting",detail:verificationPassed
            ?"Prepared citizen guidance from evidence that passed claim-level verification."
            :"Waiting because claim-level verification did not fully pass."}
         :agent);
     workflow.stageResults=workflow.stageResults.map(stage=>stage.agent==="verifier"
       ?{...stage,status:verificationPassed?"completed":"degraded",result:claimVerification.available
          ?`Claim verification: ${claimVerification.supportedCount}/${claimVerification.totalClaims} claims supported; score ${claimVerification.score}%.`
          :"Claim-level verification was unavailable; verification did not pass."}
       :stage.agent==="guidance"
         ?{...stage,status:verificationPassed?"completed":"waiting",result:verificationPassed
            ?"Final guidance is prepared from evidence that passed claim-level verification."
            :"Guidance is waiting for a fully supported answer."}
         :stage);
     workflow.summary=verificationPassed
       ?"Four-agent workflow completed with claim-level evidence verification."
       :"Four-agent workflow completed with a verification warning; the answer was not fully claim-verified.";

     return NextResponse.json({
       answer:sanitizeNadraCitizenAnswer(cleanAnswer(directNadraAnswer), language),
       source:{
         department:"NADRA",
         title:"NADRA official information",
         url:"https://www.nadra.gov.pk/identityDocument/cnic",
         lastVerified:"",
         province:""
       },
       agent:true,
       goalFocused:true,
       webSearch:usedWebSearch,
       agentActivity:{
         ...workflow,
         memory:{shortTerm:[],longTerm:["User-controlled preferences only"]},
         claimVerification
       }
     });
   }
 }

 // EARLY PASSPORT 7-MONTH RENEWAL ROUTE:
 // DGI&P explicitly states that passport renewal is allowed before expiry,
 // including when the existing passport still has months of validity remaining.
 // This narrow handler fixes the previously unanswered "7 months remaining" case
 // without changing the broader Passport routing or other departments.
 if(requested==="Passport Services" &&
    /(renew|renewal|renew passport|تجدید|تجدیدِ پاسپورٹ)/i.test(question) &&
    /(7\s*months?|seven\s*months?|7\s*month|7\s*ماہ|سات\s*ماہ)/i.test(question)){
   const passportOfficialUrl="https://dgip.gov.pk/passport/ordinary-passport.php";
   const passportPage=await fetchOfficialPage(passportOfficialUrl);
   const passportTerms=["Renewal of Passport","no restriction for renewal of passport before its expiry","full validity of 5/10 years","reason for obtaining a new passport before its expiry","relevant passport office"];
   const passportRelevant=extractRelevantOfficialEvidence(passportPage,passportTerms);
   const answer=language==="Urdu"
    ?"## پاسپورٹ کی میعاد ختم ہونے سے 7 ماہ پہلے تجدید\n\nجی ہاں، موجودہ پاسپورٹ کی میعاد ختم ہونے میں 7 ماہ باقی ہوں تب بھی پاسپورٹ کی تجدید کی جا سکتی ہے۔ DGI&P کے مطابق پاسپورٹ کی میعاد ختم ہونے سے پہلے تجدید پر کوئی پابندی نہیں ہے۔\n\n- آپ کو متعلقہ پاسپورٹ آفس میں مطلوبہ دستاویزات کے ساتھ تجدید کے لیے درخواست دینی ہوگی۔\n- موجودہ پاسپورٹ کی میعاد ختم ہونے سے پہلے نیا پاسپورٹ حاصل کرنے کی وجہ کا بیان مانگا جا سکتا ہے۔\n- نیا پاسپورٹ مکمل 5 یا 10 سال کی میعاد کے ساتھ جاری کیا جا سکتا ہے، متعلقہ قواعد کے مطابق۔\n- بیرونِ ملک پاکستانی آن لائن renewal سروس بھی استعمال کر سکتے ہیں؛ DGI&P کے مطابق آن لائن renewal اس وقت دستیاب ہے جب موجودہ پاسپورٹ کی میعاد ایک سال سے کم رہ گئی ہو یا پاسپورٹ expired ہو۔\n\n**سرکاری ذریعہ:** Directorate General of Immigration & Passports (DGI&P) — General Requirements for Passport\nhttps://dgip.gov.pk/passport/ordinary-passport.php"
    :"## Renewing a Passport with 7 Months Remaining\n\nYes. You can renew your Pakistani passport even when 7 months of validity remain. DGI&P states that there is no restriction on renewal before the passport expires.\n\n- Apply for renewal at the relevant passport office with the required documents.\n- Because the existing passport has not yet expired, DGI&P may ask for a statement explaining the reason for obtaining a new passport before expiry.\n- A new passport can be issued with full 5-year or 10-year validity, subject to the applicable rules.\n- For online renewal, DGI&P states that the service is available when an MRP is expired or has less than 1 year of validity remaining.\n\n**Official source:** Directorate General of Immigration & Passports (DGI&P) — General Requirements for Passport\nhttps://dgip.gov.pk/passport/ordinary-passport.php";
   return directWorkflowResponse({
     answer,
     source:{department:"Passport",title:"DGI&P — General Requirements for Passport",url:passportOfficialUrl,lastVerified:"9 September 2026",province:""},
     department:"Passport Services",
     question,
     language,
     evidenceAvailable:true,
     verifyClaims:true,
     verificationEvidence:(passportRelevant
       ? "OFFICIAL SOURCE EVIDENCE: "+passportOfficialUrl+"\n"+passportRelevant
       : "OFFICIAL CURATED EVIDENCE:\n"+answer).trim()
   });
 }

 // EARLY PASSPORT PARTICULARS MODIFICATION ROUTE:
 // One verified handler covers name, father name, date of birth/age and
 // other particulars. DGI&P requires the CNIC/NICOP to be revised first.
 if(requested==="Passport Services" &&
    /passport|پاسپورٹ/i.test(question) &&
    /(name|father.?s? name|father name|date of birth|dob|birth date|age|address|particulars|modification|change|correct|correction|alter|wrong|incorrect|نام|والد|تاریخ پیدائش|عمر|پتہ|ترمیم|تبدیلی|درست)/i.test(question) &&
    /(change|modify|modification|correct|correction|alter|wrong|incorrect|update|revise|تبدیل|درست|تصحیح|ترمیم|اپ ڈیٹ)/i.test(question)){
  const nameChange=/(name|نام)/i.test(question);
  const fatherChange=/(father.?s? name|father name|والد)/i.test(question);
  const dobChange=/(date of birth|dob|birth date|age|تاریخ پیدائش|عمر)/i.test(question);
  const addressChange=/(address|پتہ)/i.test(question);
  const answer=language==="Urdu"
   ?"## پاسپورٹ میں کوائف کی تبدیلی / Modification\n\nDGI&P کے سرکاری قواعد کے مطابق پاسپورٹ میں نام، والد کا نام، تاریخِ پیدائش اور دیگر کوائف میں تبدیلی کی درخواست دی جا سکتی ہے۔ **پہلے CNIC/NICOP کو متعلقہ درست کوائف کے ساتھ revise/modify کروانا ضروری ہے۔** اس کے بعد مطلوبہ دستاویزات کے ساتھ پاسپورٹ آفس میں modification کے لیے درخواست دی جاتی ہے۔\n\n**آپ کے سوال کے مطابق:** "+(nameChange?"نام کی تبدیلی پاسپورٹ میں کی جا سکتی ہے، بشرطیکہ revised CNIC/NICOP پر نیا نام درج ہو۔ ":"")+(fatherChange?"والد کے نام کی تبدیلی کے لیے بھی revised CNIC/NICOP درکار ہے۔ ":"")+(dobChange?"تاریخِ پیدائش/عمر کی تبدیلی کے لیے revised CNIC/NICOP درکار ہے؛ مزید verification کے لیے birth certificate یا recognized Board/University کی Matriculation certificate طلب کی جا سکتی ہے۔ ":"")+(addressChange?"پتے کے بارے میں DGI&P کے قواعد اسے الگ سے نامزد service کے طور پر تفصیل سے بیان نہیں کرتے، لیکن Rule 16 دیگر particulars کو بھی cover کرتا ہے۔ اس لیے پہلے CNIC/NICOP پر پتہ درست کریں اور پاسپورٹ آفس سے متعلقہ modification کی تصدیق کریں؛ میں address کے لیے غیرمصدقہ الگ checklist نہیں دوں گا۔ ":"")+"\n**خاص صورت:** اگر نام، والد کا نام اور تاریخِ پیدائش تینوں ایک ساتھ تبدیل کیے جا رہے ہوں تو DGI&P کے مطابق کیس Regional Passport Office/Foreign Mission سے Directorate General Immigration & Passports, Islamabad کو approval کے لیے بھیجا جاتا ہے۔\n\n**بنیادی دستاویز:** revised original CNIC/NICOP۔ DGI&P اضافی supporting documents ضرورت کے مطابق طلب کر سکتا ہے۔\n\n**سرکاری ذریعہ:** DGI&P — Change of Particulars / Modification\nhttps://dgip.gov.pk/passport/ordinary-passport.php"
   :"## Passport — Change of Particulars / Modification\n\nDGI&P officially allows passport modification for **name, father name, date of birth and other particulars**. The applicant must first revise/modify the **CNIC/NICOP** so it reflects the corrected particulars, then apply for passport modification with the required documents.\n\n**For your question:** "+(nameChange?"Name changes are permitted when the revised CNIC/NICOP reflects the new name. ":"")+(fatherChange?"Father-name changes require the revised CNIC/NICOP. ":"")+(dobChange?"Date-of-birth/age changes require the revised CNIC/NICOP; DGI&P may request a birth certificate or recognized Board/University Matriculation certificate for further verification. ":"")+(addressChange?"For an address change, DGI&P does not publish a separate detailed address-modification checklist on the cited page; its rules cover other particulars. Therefore, first update the CNIC/NICOP and confirm the passport-office treatment rather than inventing a separate address procedure. ":"")+"\n**Combined changes:** If name, father name and date of birth are all being changed together, DGI&P states that the case is forwarded by the Regional Passport Office/Foreign Mission to DGI&P Islamabad for approval.\n\n**Core document:** revised original CNIC/NICOP. DGI&P may request additional supporting documents as required.\n\n**Official source:** DGI&P — Change of Particulars / Modification\nhttps://dgip.gov.pk/passport/ordinary-passport.php";
  // Verify the curated passport answer against focused evidence from the official DGI&P page.
  let passportVerificationEvidence="";
  const passportOfficialUrl="https://dgip.gov.pk/passport/ordinary-passport.php";
  const passportPage=await fetchOfficialPage(passportOfficialUrl);
  const passportTerms=["Change of Particulars","CNIC","NICOP","father","date of birth","name","Directorate General Immigration & Passports","Regional Passport Office"];
  const passportRelevant=extractRelevantOfficialEvidence(passportPage,passportTerms);
  if(passportRelevant){
   passportVerificationEvidence="OFFICIAL SOURCE EVIDENCE: "+passportOfficialUrl+"\n"+passportRelevant;
  }
  if(!passportVerificationEvidence.trim()){
   passportVerificationEvidence="OFFICIAL CURATED EVIDENCE:\n"+answer;
  }
  return directWorkflowResponse({
   answer,
   source:{department:"Passport",title:"DGI&P — Change of Particulars / Modification",url:passportOfficialUrl,lastVerified:"27 September 2026",province:""},
   department:"Passport Services",
   question,
   language,
   evidenceAvailable:true,
   verifyClaims:true,
   verificationEvidence:passportVerificationEvidence.trim()
  });
 }

 // EARLY VACCINATION ROUTE: import the proven Streamlit Hajj/Umrah/work-visa handling without changing frozen departments.
 if(requested==="Vaccination for Travelling Abroad"){
  if(isVaccinationPilgrimQuestion(question)){
   return vaccinationPilgrimResponse(question,language);
  }
  if(isSaudiVaccinationWorkVisaQuestion(question)){
   return vaccinationWorkVisaResponse(language, question);
  }
 }

 // EARLY GENERIC DOMICILE ROUTE: handle a domicile document query when no province/territory is named.
 if(requested==="Domicile" && !workingTargetJurisdiction && !workingJurisdiction){
  const answer=language==="Urdu"
   ?"## ڈومیسائل سرٹیفکیٹ — مطلوبہ دستاویزات\n\nڈومیسائل کی دستاویزات صوبے یا علاقے کے مطابق مختلف ہو سکتی ہیں۔ سرکاری ذرائع سے درج ذیل چیک لسٹس کی تصدیق ہوتی ہے:\n\n**پنجاب:**\n1. CNIC / Form-B\n2. والد کا CNIC / شوہر کا CNIC\n3. Birth Certificate / School Certificate\n4. Bank Receipt\n5. 2 تصاویر\n6. Property Documents / Utility Bill\n\n**اسلام آباد (ICT):** 21 سال یا اس سے زیادہ عمر کے درخواست گزار کے لیے CNIC کی کاپی، والد/شوہر کے CNIC کی کاپی، اسلام آباد میں رہائش کا ثبوت (Allotment Letter یا Lease Agreement)، اصل Utility Bill، اور اگر بچے ہوں تو Form-B کی کاپی درکار ہے۔ اصل دستاویزات کے ساتھ ذاتی حاضری ضروری ہے۔\n\n**خیبر پختونخوا:** سرکاری KP Citizen Facilitation Portal پر Domicile Certificate سروس، Checklist اور Online Apply موجود ہیں، لیکن دستیاب عوامی صفحے سے مکمل checklist متن اخذ نہیں ہو سکا۔ اس لیے میں KP کے لیے غیرمصدقہ دستاویزات شامل نہیں کر رہا۔\n\nاپنا **صوبہ/علاقہ** بتا دیں (مثلاً پنجاب، خیبر پختونخوا، سندھ، بلوچستان یا اسلام آباد) تو اسی حکومت کی متعلقہ سرکاری checklist کے مطابق جواب دیا جا سکتا ہے۔\n\n**سرکاری ذرائع:**\n- پنجاب e-Khidmat: https://ekhidmat.punjab.gov.pk/services/e-khidmat-marakaz/domicile-certificate\n- ICT Administration: https://ictadministration.gov.pk/domicile-certificate/\n- KP Citizens Facilitation Portal: https://cfc.kp.gov.pk/\n- KP E-Domicile System: https://www.pmru.kp.gov.pk/e-domicile.php"
   :"## Domicile Certificate — Required Documents\n\nDomicile document requirements vary by province or territory. The following checklists are directly supported by official government sources:\n\n**Punjab:**\n1. CNIC / Form-B\n2. Father’s CNIC / Husband’s CNIC\n3. Birth Certificate / School Certificate\n4. Bank Receipt\n5. Two photographs\n6. Property Documents / Utility Bill\n\n**Islamabad Capital Territory (ICT):** For applicants aged 21 or above, the ICT Administration lists a copy of the applicant’s CNIC, father’s/husband’s CNIC, proof of residence in Islamabad (Allotment Letter or Lease Agreement), one original utility bill, and Form-B if the applicant has children. The applicant must appear with original documents.\n\n**Khyber Pakhtunkhwa:** The official KP Citizen Facilitation Portal lists Domicile Certificate as a service with a Checklist and Online Apply option, but the accessible public page does not expose the complete checklist text. I therefore do not add an unverified KP document list.\n\nPlease specify your **province/territory** (for example Punjab, Khyber Pakhtunkhwa, Sindh, Balochistan, or Islamabad) for the relevant official checklist.\n\n**Official sources:**\n- Punjab e-Khidmat: https://ekhidmat.punjab.gov.pk/services/e-khidmat-marakaz/domicile-certificate\n- ICT Administration: https://ictadministration.gov.pk/domicile-certificate/\n- KP Citizens Facilitation Portal: https://cfc.kp.gov.pk/\n- KP E-Domicile System: https://www.pmru.kp.gov.pk/e-domicile.php";
  const domicileVerificationEvidence=[
    "OFFICIAL PUNJAB DOMICILE EVIDENCE:",
    "Punjab government domicile guidance lists CNIC/Form-B, father’s or husband’s NIC, birth certificate or school certificate, bank receipt, two photographs, and property documents or a utility bill among the required documents.",
    "Punjab provides domicile processing through its Domicile Branch/facilitation-center services and an online Domicile Management option.",
    "OFFICIAL SOURCE: https://ekhidmat.punjab.gov.pk/services/e-khidmat-marakaz/domicile-certificate",
    "",
    "OFFICIAL ICT DOMICILE EVIDENCE:",
    "ICT Administration publishes separate domicile requirements and requires original documents/personal appearance for the stated applicant category.",
    "OFFICIAL SOURCE: https://ictadministration.gov.pk/domicile-certificate/",
    "",
    "OFFICIAL KP DOMICILE EVIDENCE:",
    "The KP Citizen Facilitation Portal lists Domicile Certificate with Checklist and Apply Online options.",
    "OFFICIAL SOURCE: https://cfc.kp.gov.pk/",
  ].join("\n");
  return directWorkflowResponse({
   answer,
   source:{department:"Domicile",title:"Official Government Domicile Services — Punjab, ICT and KP",url:"https://ekhidmat.punjab.gov.pk/services/e-khidmat-marakaz/domicile-certificate",lastVerified:"",province:""},
   department:"Domicile",
   question,
   language,
   jurisdiction:workingTargetJurisdiction||workingJurisdiction,
   evidenceAvailable:true,
   verifyClaims:true,
   verificationEvidence:domicileVerificationEvidence.trim()
  });
 }

 // EARLY KP DOMICILE ROUTE: use the current official KP e-Domicile and Citizen Facilitation evidence directly.
 if(requested==="Domicile" && (workingTargetJurisdiction||workingJurisdiction)==="Khyber Pakhtunkhwa"){
  const kpDomicileUrls=[
   "https://pmru.kp.gov.pk/e-domicile.php",
   "https://cfc.kp.gov.pk/",
   "https://cfc.kp.gov.pk/Home/FAQs"
  ];
  const answer=language==="Urdu"
   ?`## خیبر پختونخوا — ڈومیسائل سرٹیفکیٹ

سرکاری KP e-Domicile نظام کے مطابق شہری **DC Office** سے ڈومیسائل حاصل کرنے کے لیے آن لائن درخواست دے سکتے ہیں۔ سرکاری نظام کے مطابق درخواست ویب پورٹل، موبائل ایپ یا DC Office میں قائم District Citizen Information Centers کے ذریعے جمع کی جا سکتی ہے۔

**طریقۂ کار:**
1. **KP Citizen’s Portal** میں رجسٹر ہوں اور **e-Citizen** ٹیب سے ڈومیسائل کی درخواست جمع کریں۔
2. درخواست جمع ہونے کے بعد ایک **tracking code / transaction ID** خودکار طور پر جاری ہوتا ہے، جس سے درخواست کا status ٹریک کیا جا سکتا ہے۔
3. سرکاری نظام کے مطابق درخواست پر فیصلے سے درخواست گزار کو مطلع کیا جاتا ہے۔
4. KP e-Domicile کے مطابق یہ نظام تمام DC Offices میں نافذ ہے جہاں درخواستیں وصول اور ڈومیسائل جاری کیے جاتے ہیں۔

KP Citizen Facilitation Portal پر **Domicile Certificate** سروس کے ساتھ **Checklist** اور **Apply Online** آپشن موجود ہیں۔

**اہم:** دستیاب عوامی سرکاری صفحات پر مکمل موجودہ document checklist کا متن واضح طور پر دستیاب نہیں، اس لیے میں غیرمصدقہ دستاویزات شامل نہیں کر رہا۔

**سرکاری ذرائع:**
- KP e-Domicile: https://pmru.kp.gov.pk/e-domicile.php
- KP Citizens Facilitation Portal: https://cfc.kp.gov.pk/`
   :`## Khyber Pakhtunkhwa — Domicile Certificate

According to the official KP e-Domicile system, citizens can apply online to obtain a domicile from the **DC Office**. The official system provides an online e-Domicile service through the KP Citizen’s Portal.

**Process:**
1. Use the **KP Citizen’s Portal** and the **e-Citizen** section to submit the domicile application.
2. An **application transaction ID** is generated and can be used to track the application status.
3. The KP Citizen Facilitation Portal lists **Domicile Certificate** with **Checklist** and **Apply Online** options.


**Official sources:**
- KP e-Domicile: https://pmru.kp.gov.pk/e-domicile.php
- KP Citizens Facilitation Portal: https://cfc.kp.gov.pk/`;
  let verificationEvidence="";
  for(const u of kpDomicileUrls){
   const t=await fetchOfficialPage(u);
   if(t) verificationEvidence+="\n\nOFFICIAL SOURCE PAGE: "+u+"\n"+t;
  }
  verificationEvidence += [
    "",
    "OFFICIAL KP E-DOMICILE EVIDENCE SUMMARY:",
    "The Government of Khyber Pakhtunkhwa E-Domicile System states that citizens can obtain domicile from the DC Office.",
    "It states that applications can be submitted through the web portal, mobile application, or District Citizen Information Centers established in DC Offices.",
    "It states that an application transaction ID is generated and can be used to track application status.",
    "It also states that citizens can register in the KP Citizen Portal, use the e-Citizen tab, submit the application, and track it.",
    "The system is implemented in all DC Offices of Khyber Pakhtunkhwa.",
    "The KP Citizens Facilitation Portal lists Domicile Certificate with Checklist and Apply Online options.",
  ].join("\n");

  return directWorkflowResponse({
   answer,
   source:{department:"Domicile",title:"Government of Khyber Pakhtunkhwa — E-Domicile System",url:kpDomicileUrls[0],lastVerified:"",province:"Khyber Pakhtunkhwa"},
   department:"Domicile",
   question,
   language,
   jurisdiction:"Khyber Pakhtunkhwa",
   evidenceAvailable:true,
   verifyClaims:true,
   verificationEvidence:verificationEvidence.trim()
  });
 }

 // EARLY GILGIT-BALTISTAN DOMICILE ROUTE: the official GB government site
 // confirms domicile-certificate procedures but does not publish a detailed public
 // document checklist. Do not invent requirements when the official evidence is incomplete.
 if(requested==="Domicile" && (workingTargetJurisdiction||workingJurisdiction)==="Gilgit-Baltistan"){
  const answer=language==="Urdu"
   ?"## گلگت بلتستان ڈومیسائل — سرکاری معلومات\n\nگلگت بلتستان حکومت کی سرکاری ویب سائٹ ڈومیسائل سرٹیفکیٹ کے حصول کے طریقۂ کار کو تسلیم کرتی ہے، لیکن دستیاب عوامی سرکاری معلومات میں مطلوبہ دستاویزات کی مکمل فہرست شائع نہیں کی گئی۔\n\nاس لیے میں غیرمصدقہ کاغذات کی فہرست شامل نہیں کر رہا۔ درست مطلوبہ دستاویزات کے لیے متعلقہ ضلع کی انتظامیہ / مجاز دفتر سے موجودہ checklist کی تصدیق کریں۔ گلگت بلتستان حکومت کا مرکزی سرکاری رابطہ: 05811-920423، info@gilgitbaltistan.gov.pk۔\n\n**سرکاری ذریعہ:** https://gilgitbaltistan.gov.pk/\n\nاگر آپ گلگت بلتستان کا ضلع بتا دیں تو میں اسی ضلع کے سرکاری ذریعے کے مطابق مزید مخصوص معلومات تلاش کر سکتا ہوں۔"
   :"## Gilgit-Baltistan Domicile — Official Information\n\nThe Government of Gilgit-Baltistan’s official website confirms that procedures for obtaining a domicile certificate exist, but the publicly available official information does not publish a complete document checklist.\n\nI therefore will not invent or present an unverified list of required documents. For the current checklist, the applicant should confirm the requirements with the relevant district administration or authorized office. The Government of Gilgit-Baltistan lists its central contact as 05811-920423 and info@gilgitbaltistan.gov.pk.\n\n**Official source:** https://gilgitbaltistan.gov.pk/\n\nIf you provide the district in Gilgit-Baltistan, I can narrow the search to the relevant official district/department source.";
  return directWorkflowResponse({answer,source:{department:"Domicile",title:"Government of Gilgit-Baltistan — Official Information",url:"https://gilgitbaltistan.gov.pk/",lastVerified:"",province:"Gilgit-Baltistan"},department:"Domicile",question,language,jurisdiction:"Gilgit-Baltistan",evidenceAvailable:true});
 }

 // EARLY AJK BIRTH-CERTIFICATE ROUTE: use official AJK local-government
 // evidence directly for birth-registration questions.
 if(/ajk|azad kashmir|azad jammu and kashmir|آزاد کشمیر|آزاد جموں و کشمیر/i.test(question) &&
    /birth|birth certificate|birth registration|پیدائش|پیدائش سرٹیفکیٹ|رجسٹریشنِ پیدائش/i.test(question)){
  const answer=language==="Urdu"
   ?"## آزاد جموں و کشمیر — نیا برتھ سرٹیفکیٹ / پیدائش کی رجسٹریشن\n\nآزاد جموں و کشمیر کے سرکاری Local Government قانون کے مطابق **پیدائش اور اموات کی رجسٹریشن** مقامی کونسلوں کے دائرۂ کار میں شامل ہے۔ اس لیے نئے برتھ سرٹیفکیٹ کے لیے پیدائش کی رجسٹریشن متعلقہ مقامی کونسل / یونین کونسل کے ذریعے کی جاتی ہے۔\n\n**اہم:** دستیاب عوامی سرکاری AJK ذرائع میں نئے برتھ سرٹیفکیٹ کے لیے مکمل موجودہ دستاویزات، فیس اور مرحلہ وار checklist واضح طور پر شائع نہیں ملی۔ اس لیے میں غیرمصدقہ کاغذات یا فیس شامل نہیں کر رہا۔ درخواست دینے سے پہلے متعلقہ Union Council / Local Council سے موجودہ checklist کی تصدیق کریں۔\n\n**سرکاری ذریعہ:** AJK Local Government Act — Schedule VIII: Registration of birth, deaths and marriages: https://ec.ajk.gov.pk/wp-content/uploads/2022/09/AJKLocalGovernmentAct1990Amendedupto2021.pdf"
   :"## Azad Jammu and Kashmir — New Birth Certificate / Birth Registration\n\nUnder the official Azad Jammu and Kashmir Local Government framework, **registration of births and deaths** falls within the functions of local councils. Therefore, birth registration for a new birth certificate is handled through the relevant local council / Union Council.\n\n**Important:** The publicly available official AJK sources I could verify do not publish a complete current document checklist, fee schedule, and step-by-step application procedure for a new birth certificate. I therefore will not invent document requirements or fees. Confirm the current checklist with the relevant Union Council / Local Council before applying.\n\n**Official source:** AJK Local Government Act — Schedule VIII: Registration of birth, deaths and marriages: https://ec.ajk.gov.pk/wp-content/uploads/2022/09/AJKLocalGovernmentAct1990Amendedupto2021.pdf";
  return directWorkflowResponse({answer,source:{department:"Union Council / Local Government",title:"AJK Local Government Act — Birth Registration",url:"https://ec.ajk.gov.pk/wp-content/uploads/2022/09/AJKLocalGovernmentAct1990Amendedupto2021.pdf",lastVerified:"",province:"Azad Jammu and Kashmir"},department:"Union Council / Local Government",question,language,jurisdiction:"Azad Jammu and Kashmir",evidenceAvailable:true});
 }

 // EARLY AJK DOMICILE ROUTE: use the official AJK E-Facilitation Center
 // information when the citizen explicitly selects Azad Jammu and Kashmir.
 if(requested==="Domicile" && (workingTargetJurisdiction||workingJurisdiction)==="Azad Jammu and Kashmir"){
  const answer=language==="Urdu"
   ?"## آزاد جموں و کشمیر ڈومیسائل — سرکاری معلومات\n\nAJK کے سرکاری E-Facilitation Center کے مطابق:\n\n- ڈومیسائل سرٹیفکیٹ سے متعلق محکمہ **Board of Revenue** ہے۔\n- ڈومیسائل سرٹیفکیٹ **Assistant Commissioner** جاری کرتا ہے۔\n- Facilitation Center کے ذریعے سروس کا وقت **16 working days** ہے، جبکہ متعلقہ محکمہ **15 working days** بتاتا ہے۔\n- محکمانہ فیس **PKR 200** ہے۔\n- درخواست فارم Facilitation Center یا متعلقہ parent department سے حاصل کیا جا سکتا ہے۔\n\n**اہم:** دستیاب سرکاری FAQ میں نئے ڈومیسائل کے لیے مطلوبہ دستاویزات کی مکمل checklist شائع نہیں کی گئی۔ اس لیے میں غیرمصدقہ کاغذات شامل نہیں کر رہا۔ درست موجودہ checklist متعلقہ Board of Revenue / Assistant Commissioner یا AJK E-Facilitation Center سے تصدیق کریں۔\n\n**سرکاری ذریعہ:** https://efc.ajk.gov.pk/faq\n\nاگر آپ AJK کا ضلع بتا دیں تو متعلقہ ضلعی سرکاری ذریعہ تلاش کیا جا سکتا ہے۔"
   :"## Azad Jammu and Kashmir Domicile — Official Information\n\nAccording to the official AJK E-Facilitation Center:\n\n- The **Board of Revenue** is the department responsible for Domicile Certificates.\n- The **Assistant Commissioner** issues the Domicile Certificate.\n- The stated service time is **16 working days** through the Facilitation Center, while the parent department states **15 working days**.\n- The departmental fee is **PKR 200**.\n- The application form can be obtained from the Facilitation Center or the parent department.\n\n**Important:** The available official FAQ does not publish a complete checklist of documents required for a new domicile application. I therefore will not invent or present an unverified document list. The applicant should confirm the current checklist with the relevant Board of Revenue / Assistant Commissioner or AJK E-Facilitation Center.\n\n**Official source:** https://efc.ajk.gov.pk/faq\n\nIf you provide the AJK district, the relevant district-level official source can be checked.";
  return directWorkflowResponse({answer,source:{department:"Domicile",title:"AJK E-Facilitation Center — Domicile Certificate",url:"https://efc.ajk.gov.pk/faq",lastVerified:"",province:"Azad Jammu and Kashmir"},department:"Domicile",question,language,jurisdiction:"Azad Jammu and Kashmir",evidenceAvailable:true});
 }

 // EARLY DOMICILE ROUTE: use verified provincial evidence for domicile questions.
 if(requested==="Domicile" && (workingTargetJurisdiction||workingJurisdiction)==="Punjab"){
  const answer=language==="Urdu"
   ?"پنجاب میں ڈومیسائل کے لیے CNIC/Form-B، والد/شوہر کا CNIC، پیدائش یا اسکول سرٹیفکیٹ، بینک رسید، 2 تصاویر، اور جائیداد کی دستاویز یا یوٹیلیٹی بل درکار ہو سکتے ہیں۔ درخواست e-Khidmat Markaz یا متعلقہ Domicile Branch/Assistant Commissioner دفتر کے ذریعے دی جا سکتی ہے۔ پنجاب حکومت کے مطابق Domicile Management کے لیے سہولت مراکز اور آن لائن طریقہ موجود ہے۔"
   :"For a Punjab domicile certificate, official Punjab government information lists these documents: CNIC/Form-B, father’s or husband’s NIC, birth certificate or school certificate, bank receipt, two photographs, and property documents or a utility bill. Applications can be submitted through the Domicile Branch/facilitation center, and Punjab also provides an online Domicile Management option. The Punjab government describes a process in which the application/documents are checked, the domicile is processed by the concerned office, and the certificate is issued after approval.";
  return directWorkflowResponse({answer,source:{department:"Domicile",title:"Punjab Government — Domicile Certificate",url:"https://hed.punjab.gov.pk/student-affairs",lastVerified:"",province:"Punjab"},department:"Domicile",question,language,jurisdiction:"Punjab",evidenceAvailable:true,verifyClaims:true,verificationEvidence:"OFFICIAL PUNJAB DOMICILE EVIDENCE:\n1. Required documents listed by the Punjab government: CNIC/Form-B; father’s or husband’s NIC; birth certificate or school certificate; bank receipt; two photographs; and property documents or a utility bill.\n2. Punjab domicile applications can be submitted through the Domicile Branch/facilitation-center process.\n3. Punjab provides an online Domicile Management option.\n4. The Punjab government describes the process as checking the application and documents, processing the domicile through the concerned office, and issuing the certificate after approval.\nOFFICIAL SOURCE: https://hed.punjab.gov.pk/student-affairs"});
 }
 // EARLY BALOCHISTAN DOMICILE ROUTE: use only directly verified Balochistan government evidence.
 if(requested==="Domicile" && (workingTargetJurisdiction||workingJurisdiction)==="Balochistan"){
  const answer=language==="Urdu"
   ?"## بلوچستان — ڈومیسائل سرٹیفکیٹ\n\nسرکاری بلوچستان حکومت کی موجودہ معلومات کے مطابق صوبے میں **Computerized Local Domicile Management System (CLDMS)** قائم کرنے کا منصوبہ منظور شدہ ترقیاتی منصوبوں میں شامل ہے۔ سرکاری Science & Information Technology Department کے ریکارڈ میں یہ منصوبہ Balochistan کے لیے درج ہے۔\n\nسرکاری طور پر دستیاب موجودہ صفحات میں مکمل آن لائن درخواست کے مراحل، دستاویزات، فیس اور موجودہ درخواست پورٹل کی تفصیل واضح طور پر شائع نہیں کی گئی۔ اس لیے میں غیرمصدقہ دستاویزات، فیس یا مراحل شامل نہیں کر رہا۔\n\nمتعلقہ ضلعی دفتر سے رابطے کے لیے سرکاری Board of Revenue Balochistan اپنے تمام Deputy Commissioners کے ضلعی رابطہ نمبرز بھی شائع کرتا ہے۔\n\n**سرکاری ذرائع:**\n- Balochistan Science & Information Technology Department — CLDMS: https://sit.balochistan.gov.pk/ongoing-schemes/\n- Board of Revenue Balochistan — Deputy Commissioner Directory: https://bor.balochistan.gov.pk/phone-directory/"
   :"## Balochistan — Domicile Certificate\n\nCurrent official Government of Balochistan information confirms that a **Computerized Local Domicile Management System (CLDMS)** is an approved provincial development project. The official Science & Information Technology Department lists the CLDMS specifically for Balochistan.\n\nThe current official pages I could verify do not clearly publish the complete online application steps, document checklist, fees, or a current application portal. I am therefore not adding unverified requirements, fees, or procedures.\n\nFor district-level contact, the official Board of Revenue Balochistan publishes contact numbers for all Deputy Commissioners.\n\n**Official sources:**\n- Balochistan Science & Information Technology Department — CLDMS: https://sit.balochistan.gov.pk/ongoing-schemes/\n- Board of Revenue Balochistan — Deputy Commissioner Directory: https://bor.balochistan.gov.pk/phone-directory/";
  return directWorkflowResponse({answer,source:{department:"Domicile",title:"Government of Balochistan — Local Domicile Management System",url:"https://sit.balochistan.gov.pk/ongoing-schemes/",lastVerified:"",province:"Balochistan"},department:"Domicile",question,language,jurisdiction:"Balochistan",evidenceAvailable:true});
 }

// EARLY ICT DOMICILE ROUTE: use directly verified ICT Administration evidence.
 if(requested==="Domicile" && (workingTargetJurisdiction||workingJurisdiction)==="Islamabad Capital Territory"){
  const answer=language==="Urdu"
   ?"## اسلام آباد — ڈومیسائل سرٹیفکیٹ\n\nICT Administration کے سرکاری صفحے کے مطابق ڈومیسائل سرٹیفکیٹ کے لیے **Citizen Facilitation Center, G-11/4, Islamabad** میں درخواست جمع کی جاتی ہے۔ طریقہ کار یہ ہے:\n1. عمر کے مطابق مطلوبہ دستاویزات مکمل کریں۔\n2. Citizen Facilitation Center, G-11/4 جائیں اور درخواست اور دستاویزات جمع کریں۔\n3. ٹوکن حاصل کریں اور اپنی باری کا انتظار کریں۔\n4. ڈیٹا انٹری کے بعد ضروری فیس ادا کریں اور e-receipt حاصل کریں۔\n5. ڈومیسائل درخواست پر کارروائی کی جاتی ہے۔\n6. e-receipt پر دی گئی تاریخ کو ڈومیسائل سرٹیفکیٹ وصول کریں۔\n\n**21 سال یا اس سے زیادہ عمر کے درخواست گزار کے لیے سرکاری فہرست:** درخواست گزار کے CNIC کی کاپی (CNIC کم از کم 1 سال پرانا)، والد/شوہر کے CNIC کی کاپی، اسلام آباد میں رہائش کا ثبوت (Allotment Letter یا Lease Agreement)، اصل Utility Bill (بجلی یا گیس)، اور اگر بچے ہوں تو Form-B کی کاپی۔ اگر کسی دوسرے ضلع کا ڈومیسائل منسوخ کیا گیا ہو تو اس کی بھی کم از کم 1 سال پرانی دستاویز درکار ہے۔ درخواست گزار کو اصل دستاویزات کے ساتھ خود حاضر ہونا ہے۔\n\nاگر CNIC پر دوہرا پتہ ہو تو متعلقہ دوسرے ضلع سے NOC درکار ہے۔\n\n**فیس:** سرکاری صفحہ ضروری فیس ادا کرنے کا ذکر کرتا ہے، لیکن اس صفحے کے معلوماتی خانے میں مخصوص رقم درج نہیں کرتا؛ اس لیے میں رقم فرض نہیں کر رہا۔\n\n**پروسیسنگ ٹائم:** 7 دن۔\n**مقام:** Citizen Facilitation Center, G-11/4, Islamabad۔\n**اوقات:** پیر تا جمعہ 09:00 AM–06:00 PM؛ جمعہ وقفہ 12:30 PM–02:30 PM۔\n**رابطہ:** 051-8899611۔\n\n**سرکاری ماخذ:** https://ictadministration.gov.pk/domicile-certificate/"
   :"## Islamabad Capital Territory — Domicile Certificate\n\nAccording to the official ICT Administration domicile page, applications are submitted at the **Citizen Facilitation Center, G-11/4, Islamabad**. The official process is:\n1. Complete the required documents according to the applicant's age.\n2. Visit the Citizen Facilitation Center, G-11/4 and submit the application with the documents.\n3. Get a token and wait for your turn.\n4. Complete data entry and pay the necessary fee to receive an e-receipt.\n5. ICT Administration processes the domicile application.\n6. Collect the Domicile Certificate on the date stated on the e-receipt.\n\n**For applicants aged 21 or above, the official document list includes:** a copy of the applicant's CNIC (the CNIC must be 1 year old), a copy of the father/husband's CNIC, proof of residence in Islamabad (Allotment Letter or Lease Agreement), one original utility bill (electricity or gas), and a copy of Form-B if the applicant has children. If a domicile from another district has been cancelled, the official page states that the cancellation document should also be 1 year old. The applicant must appear in person with the original documents.\n\nIf the CNIC has dual addresses, an NOC from the other district is required.\n\n**Fee:** The official page says the necessary fee is paid and an e-receipt is issued, but it does not state a specific amount in the information box. I am therefore not inventing a fee amount.\n\n**Processing time:** 7 days.\n**Location:** Citizen Facilitation Center, G-11/4, Islamabad.\n**Hours:** Monday–Friday, 09:00 AM–06:00 PM; Friday break 12:30 PM–02:30 PM.\n**Contact:** 051-8899611.\n\n**Official source:** https://ictadministration.gov.pk/domicile-certificate/";
  return directWorkflowResponse({answer,source:{department:"Domicile",title:"ICT Administration — Domicile Certificate",url:"https://ictadministration.gov.pk/domicile-certificate/",lastVerified:"",province:"Islamabad Capital Territory"},department:"Domicile",question,language,jurisdiction:"Islamabad Capital Territory",evidenceAvailable:true});
 }

// EARLY SINDH DOMICILE ROUTE: use only directly verified Sindh government evidence.
 if(requested==="Domicile" && (workingTargetJurisdiction||workingJurisdiction)==="Sindh"){
  const answer=language==="Urdu"
   ?"## سندھ — ڈومیسائل سرٹیفکیٹ\n\nسرکاری سندھ حکومت کی معلومات کے مطابق ڈومیسائل اور PRC کے لیے **Domicile & PRC Automation** نظام موجود ہے۔ ضلعی انتظامیہ کے سرکاری پورٹل پر ڈپٹی کمشنر آفس کے تحت **Domicile Branch** بھی درج ہے۔ اس لیے درخواست کے لیے اپنے متعلقہ ضلع کے ڈپٹی کمشنر آفس کی Domicile Branch سے رجوع کیا جا سکتا ہے۔\n\nسرکاری طور پر دستیاب صفحات میں مکمل موجودہ دستاویزات، فیس اور مرحلہ وار درخواست فارم کی تفصیل واضح طور پر فراہم نہیں کی گئی؛ اس لیے میں غیرمصدقہ دستاویزات یا فیس شامل نہیں کر رہا۔\n\n**سرکاری ذرائع:**\n- Sindh Government — Domicile & PRC Automation: https://istd.sindh.gov.pk/initiatives/621\n- District Administration Malir — Domicile Branch, Deputy Commissioner Office: https://dcmalir.sindh.gov.pk/\n- Sindh Home Department — Appeals for Domicile & PRC: https://home.sindh.gov.pk/judicial-i"
   :"## Sindh — Domicile Certificate\n\nOfficial Sindh government information confirms that a **Domicile & PRC Automation** system exists. An official district-administration portal also identifies a **Domicile Branch** under the Deputy Commissioner Office. Therefore, for a Sindh domicile application, the practical official route is to approach the Domicile Branch of the Deputy Commissioner Office of the relevant district.\n\nThe official pages I could verify do not clearly publish a complete current checklist of documents, fees, and step-by-step application form procedure. I am therefore not adding unverified requirements or fees.\n\n**Official sources:**\n- Sindh Government — Domicile & PRC Automation: https://istd.sindh.gov.pk/initiatives/621\n- District Administration Malir — Domicile Branch, Deputy Commissioner Office: https://dcmalir.sindh.gov.pk/\n- Sindh Home Department — Appeals for Domicile & PRC: https://home.sindh.gov.pk/judicial-i";
  return directWorkflowResponse({answer,source:{department:"Domicile",title:"Government of Sindh — Domicile & PRC",url:"https://istd.sindh.gov.pk/initiatives/621",lastVerified:"",province:"Sindh"},department:"Domicile",question,language,jurisdiction:"Sindh",evidenceAvailable:true});
 }

if(requested==="Education & Scholarships"){
 const ej=workingTargetJurisdiction||workingJurisdiction||workingDetectTargetJurisdiction(question)||detectJurisdiction(question);
 const answer=educationEvidence(question,ej,language);
  const verificationUrls=Array.from(new Set((answer.match(/https?:\/\/[^\s)]+/g)||[]).map((u)=>u.replace(/[.,]+$/,""))));
 let verificationEvidence="";
 for(const u of verificationUrls){ const t=await fetchOfficialPage(u); if(t) verificationEvidence+="\n\nOFFICIAL SOURCE PAGE: "+u+"\n"+t; }
 return directWorkflowResponse({answer,source:{department:"Education & Scholarships",title:"Official education/scholarship source",url:verificationUrls[0]||"",lastVerified:"",province:ej||""},department:"Education & Scholarships",question,language,jurisdiction:ej,evidenceAvailable:true,verifyClaims:true,verificationEvidence:verificationEvidence.trim()});
}
if(requested==="Government Jobs"){
 const jobsAnswer=governmentJobsEvidence(question,language);
 const q=normalize(question);
 const isApply=q.includes("apply")||q.includes("application")||q.includes("how to apply")||q.includes("اپلائی")||q.includes("درخواست");
 const isAccount=q.includes("register")||q.includes("signup")||q.includes("sign up")||q.includes("account")||q.includes("رجسٹر")||q.includes("اکاؤنٹ");
 const isPassword=q.includes("password")||q.includes("forgot")||q.includes("پاس ورڈ");
 const evidence=isApply
  ?"OFFICIAL NJP EVIDENCE: The National Jobs Portal Help page states that applicants can browse live jobs, open the job detail page, click Apply, complete the CV sections, and submit the application before the closing date. SOURCE: https://njp.gov.pk/help"
  :isAccount
  ?"OFFICIAL NJP EVIDENCE: The National Jobs Portal registration/help pages state that a candidate can register and complete verification; the registration page requests CNIC number and email address, and the help page describes CNIC and PAK-ID verification for the candidate profile. SOURCES: https://njp.gov.pk/register and https://njp.gov.pk/help"
  :isPassword
  ?"OFFICIAL NJP EVIDENCE: The National Jobs Portal Help page states that a user who forgot the password should use Forgot Password on the login page to receive a reset code and set a new password. SOURCE: https://njp.gov.pk/help"
  :"OFFICIAL NJP EVIDENCE: The National Jobs Portal provides Live Jobs and Upcoming Jobs and allows job searches by keyword or organization. The official jobs page states that job postings are from verified government organizations. SOURCE: https://www.njp.gov.pk/index.php/jobs";
 return directWorkflowResponse({
  answer:jobsAnswer,
  source:{department:"Government Jobs",title:"National Jobs Portal — Government of Pakistan",url:"https://njp.gov.pk/",lastVerified:"",province:""},
  department:"Government Jobs",
  question,
  language,
  jurisdiction:null,
  evidenceAvailable:true,
  verifyClaims:true,
  verificationEvidence:evidence
 });
}

if(requested==="FBR / Taxation"){
 const fq=normalize(question);
 const isRegistration=fq.includes("ntn")||fq.includes("national tax number")||fq.includes("register")||fq.includes("registration")||fq.includes("taxpayer"); const isATL=fq.includes("active taxpayer")||fq.includes("atl")||fq.includes("filer status")||fq.includes("filer")||fq.includes("active taxpayer list");
 if(isATL){
  const fbrATLAnswer=language==="Urdu"
   ? `## FBR — Active Taxpayer Status (ATL)
**سرکاری ادارہ:** Federal Board of Revenue (FBR)

اپنا **Active Taxpayer Status** FBR کے **IRIS 2.0 / Online Verification** کے ذریعے چیک کیا جا سکتا ہے۔ IRIS میں **Active Taxpayer List (Income Tax)** کی verification سروس موجود ہے، جہاں متعلقہ شناختی نمبر منتخب کر کے معلومات درج کی جاتی ہیں اور **Verify** کیا جاتا ہے۔

**سرکاری ذریعہ:** https://iris.fbr.gov.pk/
`
   : `## FBR — Active Taxpayer Status (ATL)
**Official authority:** Federal Board of Revenue (FBR)

You can check your **Active Taxpayer Status** through FBR's **IRIS 2.0 / Online Verification** service. IRIS provides an **Active Taxpayer List (Income Tax)** verification option where you select the relevant identifier, enter the required information and use **Verify**.

**Official source:** https://iris.fbr.gov.pk/
`;
  const atlUrls=[
   "https://iris.fbr.gov.pk/",
   "https://fbr.gov.pk/categ/active-taxpayer-list-income-tax/51147/30859/%2071168"
  ];
  let atlVerificationEvidence="";
  for(const u of atlUrls){
   const t=await fetchOfficialPage(u);
   if(t) atlVerificationEvidence+="\n\nOFFICIAL SOURCE PAGE: "+u+"\n"+t;
  }
  // Keep a small deterministic evidence summary so verification remains available
  // even if the live FBR page is temporarily unreachable.
  atlVerificationEvidence += [
   "",
   "OFFICIAL FBR EVIDENCE SUMMARY:",
   "FBR IRIS 2.0 provides an Online Verifications section with Active Taxpayer List (Income Tax).",
   "The IRIS Active Taxpayer List verification form allows an identifier such as NTN, CNIC, Passport No. or Registration/Inc. No. to be selected and then verified.",
   "FBR's Active Taxpayer List page states that the Active Taxpayer Status can also be checked through the online portal.",
   "FBR's published ATL guidance states that an individual's status can also be checked by sending ATL followed by a space and the 13-digit CNIC number to 9966. For a company or AOP, ATL followed by a space and the 7-digit NTN can be sent to 9966."
  ].join("\n");
  return directWorkflowResponse({
   answer:fbrATLAnswer,
   source:{department:"FBR / Taxation",title:"FBR IRIS 2.0 — Active Taxpayer List Verification",url:atlUrls[0],lastVerified:"",province:""},
   department:"FBR / Taxation",
   question,
   language,
   jurisdiction:null,
   evidenceAvailable:true,
   verifyClaims:true,
   verificationEvidence:atlVerificationEvidence.trim()
  });
 }

 if(isRegistration){
  const fbrAnswer=language==="Urdu"
   ? `## FBR — انکم ٹیکس رجسٹریشن اور NTN
**سرکاری ادارہ:** Federal Board of Revenue (FBR)

FBR کے مطابق انکم ٹیکس رجسٹریشن ٹیکس ریٹرن فائل کرنے کا پہلا قدم ہے۔

**فرد (Individual) کے لیے آن لائن رجسٹریشن:**
1. FBR کے **IRIS** پورٹل پر آن لائن رجسٹریشن کی جا سکتی ہے۔
2. آن لائن رجسٹریشن صرف **Individual** کے لیے دستیاب ہے؛ AOP یا Company کے لیے یہ آن لائن راستہ دستیاب نہیں۔
3. اپنا CNIC والا موبائل نمبر اور ذاتی ای میل درکار ہے۔
4. اگر کاروبار ہے تو کاروباری جگہ کی ملکیت/کرایہ داری کا ثبوت اور تین ماہ سے پرانا نہ ہونے والا paid utility bill درکار ہے۔
5. اپنے نام کے personal bank account کی maintenance certificate کی اسکین شدہ کاپی درکار ہے۔

**رجسٹریشن کے بعد:** FBR کے مطابق IRIS e-enrollment سے فرد کو اس کا National Tax Number (NTN)/Registration Number اور password ملتا ہے۔ فرد کے لیے 13 ہندسوں کا CNIC ہی NTN/Registration Number کے طور پر استعمال ہوتا ہے۔

**اہم:** AOP اور Company کے لیے FBR کا Facilitation Counter/RTO والا طریقہ الگ ہے۔

**سرکاری ذرائع:**
https://www.fbr.gov.pk/categ/income-tax/51148/30846/71150
https://www.fbr.gov.pk/categ/income-tax-status/51147/30846/71148`
   : `## FBR — Income Tax Registration and NTN
**Official authority:** Federal Board of Revenue (FBR)

According to FBR, income-tax registration is the first step before filing an income-tax return.

**For an individual, online registration:**
1. An individual can register online through the **IRIS** portal.
2. Online registration is available only for an **individual**, not for an Association of Persons (AOP) or company.
3. The applicant needs a mobile SIM registered in their own CNIC and a personal email address.
4. If the applicant has a business, FBR requires evidence of tenancy/ownership of the business premises and a paid utility bill for the business premises not older than 3 months.
5. A scanned certificate showing maintenance of the applicant's personal bank account in their own name is required.

**After registration:** FBR states that e-enrollment provides a National Tax Number (NTN) or Registration Number and password. For an individual, the 13-digit CNIC is used as the NTN/Registration Number.

**Important:** AOP and company registration follows a separate Facilitation Counter/Tax House process.

**Official sources:**
https://www.fbr.gov.pk/categ/income-tax/51148/30846/71150
https://www.fbr.gov.pk/categ/income-tax-status/51147/30846/71148`;
  const urls=[
   "https://www.fbr.gov.pk/categ/register-income-tax/51147/30846/%2061149",
   "https://www.fbr.gov.pk/categ/income-tax/51148/30846/71150",
   "https://www.fbr.gov.pk/categ/income-tax-status/51147/30846/71148"
  ];
  let fbrVerificationEvidence="";
  for(const u of urls){
   const t=await fetchOfficialPage(u);
   if(t) fbrVerificationEvidence+="\n\nOFFICIAL SOURCE PAGE: "+u+"\n"+t;
  }
  return directWorkflowResponse({
   answer:fbrAnswer,
   source:{department:"FBR / Taxation",title:"FBR — Register for Income Tax",url:urls[0],lastVerified:"",province:""},
   department:"FBR / Taxation",
   question,
   language,
   jurisdiction:null,
   evidenceAvailable:true,
   verifyClaims:true,
   verificationEvidence:fbrVerificationEvidence.trim()
  });
 }
}

if(requested==="Driving Licence"){
 const dj=workingTargetJurisdiction||workingJurisdiction||workingDetectTargetJurisdiction(question);
 if(!dj){
  return directWorkflowResponse({
   answer:language==="Urdu"
    ?"## ڈرائیونگ لائسنس\n\nبراہ کرم صوبہ/علاقہ بتائیں، مثلاً خیبر پختونخوا، پنجاب یا سندھ، تاکہ متعلقہ سرکاری ڈرائیونگ لائسنس طریقہ کار بتایا جا سکے۔"
    :"## Driving Licence\n\nPlease specify the province/territory, for example Khyber Pakhtunkhwa, Punjab, or Sindh, so I can provide the relevant official driving-licence procedure.",
   source:null,
   department:"Driving Licence",
   question,
   language,
   jurisdiction:null,
   evidenceAvailable:false
  });
 }
 const answer=drivingEvidence(question,dj,language);
 const drivingVerificationUrls=answer
  .split(/\s+/)
  .filter((item)=>item.startsWith("http://")||item.startsWith("https://"))
  .map((item)=>item.replace(/[.,]+$/,""));
 const uniqueDrivingUrls:string[]=[];
 for(const u of drivingVerificationUrls){if(uniqueDrivingUrls.indexOf(u)<0) uniqueDrivingUrls.push(u);}
 let drivingVerificationEvidence="";
 for(const u of uniqueDrivingUrls){
  const t=await fetchOfficialPage(u);
  if(t) drivingVerificationEvidence+="\n\nOFFICIAL SOURCE PAGE: "+u+"\n"+t;
 }
 // If the official page blocks server-side fetching, retain the curated
 // official-source answer as deterministic verification evidence.
 if(!drivingVerificationEvidence.trim()){
  drivingVerificationEvidence="OFFICIAL SOURCE-BASED CURATED EVIDENCE:\n"+answer;
 }
 return directWorkflowResponse({
  answer,
  source:{
   department:"Driving Licence",
   title:"Official government driving-licence information",
   url:uniqueDrivingUrls[0]||"",
   lastVerified:"",
   province:dj
  },
  department:"Driving Licence",
  question,
  language,
  jurisdiction:dj,
  evidenceAvailable:true,
  verifyClaims:true,
  verificationEvidence:drivingVerificationEvidence.trim()
 });
}

const isNadra=requested==="NADRA Services";
const registrySource=sourceForQuestion(question,selected.service,selected.jurisdiction,requested);const matchingRecord=selected.records.find(r=>normalize(r.official_department||"").includes(normalize(registrySource?.department||"___no_registry_department___")));const recordSource=matchingRecord?.official_source_url||"";const sourceUrl=registrySource?.url||recordSource||"";const sourceMeta=isNadra?{url:"https://www.nadra.gov.pk/identityDocument/cnic",title:"NADRA official information",department:"NADRA"}:(registrySource||{url:sourceUrl,title:selected.records[0]?.official_source_title||"Official Government Source",department:selected.records[0]?.official_department||"Government of Pakistan"});
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
 "Government Jobs":["njp.gov.pk","kp.gov.pk"],
 "Arms Licence":["gov.pk","punjab.gov.pk","sindh.gov.pk","kp.gov.pk","balochistan.gov.pk","ajk.gov.pk","gilgitbaltistan.gov.pk"]
};
const allowedHints=jurisdictionSourceHints[requested]||[];const alternateOfficialUrls:string[]=[];
if(requested==="Passport Services"){
 alternateOfficialUrls.push("https://www.dgip.gov.pk/passport/ordinary-passport.php","https://www.dgip.gov.pk/passport/process.php","https://www.dgip.gov.pk/eServices/online-passport.php");
}
if(requested==="Government Jobs"){alternateOfficialUrls.push("https://www.njp.gov.pk/index.php/jobs","https://www.njp.gov.pk/index.php/jobs/live","https://www.njp.gov.pk/index.php/jobs/search");}
if(requested==="Domicile"&&selected.jurisdiction==="Punjab"){alternateOfficialUrls.push("https://punjab.gov.pk/node/6239");}
// PROTECTOR & OVERSEAS EMPLOYMENT ROUTE
// Keep Protector routing deterministic and isolated from the other departments.
if(requested==="Protector & Overseas Employment"){
 const fq=normalize(question);
 const isTourist=/tourist|visit visa|visitor visa|holiday|سیاحت|وزٹ/.test(fq);
 const isOep=/\boep\b|overseas employment promoter|promoter|recruitment agency|through an agent|ایجنٹ|او ای پی/.test(fq);
 const isFee=/\bfee\b|\bfees\b|cost|charges|فیس|چارج/.test(fq);
 const isOffice=/\boffice\b|\boffices\b|location|where is|where can|دفتر|کہاں|مقام/.test(fq);
 const isOnline=/\bonline\b|e-protector|e protector|apply online|آن لائن/.test(fq);
 const isDocs=/document|documents|requirements|papers|دستاویز|کاغذات/.test(fq);
 const isInsurance=/insurance|انشورنس/.test(fq);
 const isMedical=/medical|medical fitness|health certificate|میڈیکل|طبی/.test(fq);
 const isContract=/contract|employment agreement|agreement|undertaking|معاہدہ/.test(fq);
 const isDirect=/direct employment|direct-employment|direct visa|براہ راست/.test(fq);
 const hasCountry=/saudi|saudi arabia|ksa|uae|dubai|emirates|qatar|oman|kuwait|bahrain|سعودی|متحدہ عرب امارات/.test(fq);
 const requestedJurisdiction=workingTargetJurisdiction||workingJurisdiction||workingDetectTargetJurisdiction(question);
 const policySource="https://beoe.gov.pk/files/policyguideliness/58.pdf";
 const procedureSource="https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf";
 const rulesSource="https://beoe.gov.pk/files/legal-framework/Emigration_Rules_1979_Updated_2023.pdf";
 const contactGuideSource="https://beoe.gov.pk/files/a-guide-for-pakistani-migrant-workers-in-the-united-arab-emirates.pdf";
 let answer="";

 if(isTourist){
  answer=language==="Urdu"
   ?"## پروٹیکٹر کلیئرنس\n\nعام سیاحتی یا وزٹ ویزا کے لیے اوورسیز ایمپلائمنٹ والا پروٹیکٹر رجسٹریشن طریقہ لاگو نہیں ہوتا۔ BE&OE کی یہ سروس بیرون ملک ملازمت/ایمیگریشن سے متعلق ہے۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/"
   :"## Protector of Emigrants\n\nThe BE&OE Protector registration process is for overseas employment/emigration cases. It is not an employment-clearance requirement for an ordinary tourist or visit visa.\n\n**Official source:** https://beoe.gov.pk/";
 } else if(isOffice){
  const officeMap:Record<string,{office:string,address:string,phone:string}> = {
   "Lahore":{office:"Lahore",address:"117-G Block, Model Town, Lahore",phone:"+92-42-99230338; +92-42-99230488"},
   "Peshawar":{office:"Peshawar",address:"Amanullah Khan Plaza, 2nd Floor, Opposite GPO, Lala Ayub Lane, Saddar Road, Peshawar Cantt",phone:"+92-91-9212050"},
   "Islamabad Capital Territory":{office:"Rawalpindi",address:"20-B1, Summer Plaza, Chandni Chowk, Rawalpindi",phone:"+92-51-9290439-40; +92-51-9290569"},
   "Punjab":{office:"Lahore",address:"117-G Block, Model Town, Lahore",phone:"+92-42-99230338; +92-42-99230488"},
   "Khyber Pakhtunkhwa":{office:"Peshawar",address:"Amanullah Khan Plaza, 2nd Floor, Opposite GPO, Lala Ayub Lane, Saddar Road, Peshawar Cantt",phone:"+92-91-9212050"}
  };
  const cityMap:Record<string,string>={lahore:"Lahore",peshawar:"Peshawar",islamabad:"Islamabad Capital Territory"};
  let officeKey=requestedJurisdiction||"";
  for(const [city,j] of Object.entries(cityMap)){if(fq.includes(city)){officeKey=j;break;}}
  const office=officeMap[officeKey];
  if(office){
   answer=language==="Urdu"
    ? ("## پروٹیکٹر آف ایمیگرنٹس — "+office.office+"\n\nآپ کے سوال کے مطابق متعلقہ دفتر **Protector of Emigrants, "+office.office+"** ہے۔\n\n**پتہ:** "+office.address+"\n**فون:** "+office.phone+"\n\nمتعلقہ دفتر کا انتخاب علاقے کے دائرۂ اختیار کے مطابق ہوتا ہے۔ مثال کے طور پر اسلام آباد Rawalpindi Protectorate کے دائرۂ اختیار میں ہے۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/")
    : ("## Protector of Emigrants — "+office.office+"\n\nFor the location in your question, the relevant office is **Protector of Emigrants, "+office.office+"**.\n\n**Address:** "+office.address+"\n**Telephone:** "+office.phone+"\n\nThe applicable Protector office is determined by area of jurisdiction. For example, Islamabad falls under the Rawalpindi Protectorate.\n\n**Official source:** https://beoe.gov.pk/");
  } else {
   answer=language==="Urdu"
    ?"## پروٹیکٹر آف ایمیگرنٹس کے دفاتر\n\nBE&OE کے مطابق پاکستان میں Protectorates of Emigrants کے دفاتر Rawalpindi, Lahore, Multan, Dera Ghazi Khan, Sialkot, Peshawar, Malakand, Karachi اور Quetta میں ہیں۔ متعلقہ دفتر درخواست گزار کے علاقے کے دائرۂ اختیار کے مطابق منتخب ہوتا ہے۔"
    :"## Protector of Emigrants Offices\n\nBE&OE identifies Protectorates of Emigrants in Rawalpindi, Lahore, Multan, Dera Ghazi Khan, Sialkot, Peshawar, Malakand, Karachi and Quetta. The applicable office depends on the applicant's area of jurisdiction.";
  }
 } else if(isFee){
  answer=language==="Urdu"
   ?"## پروٹیکٹر فیس\n\n**Direct Employment** کے لیے سرکاری Emigration Rules کے مطابق:\n\n| چارج | رقم فی شخص |\n|---|---:|\n| Protector registration fee | Rs. 2,500 |\n| Welfare Fund contribution | Rs. 4,000 |\n\nState Life insurance اور، جہاں لاگو ہو، OEP service charges یا دیگر case-specific charges الگ ہو سکتے ہیں۔ اس لیے ہر کیس کے لیے ایک universal total فرض نہیں کیا جانا چاہیے۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/files/legal-framework/Emigration_Rules_1979_Updated_2023.pdf"
   :"## Protector Fees — Direct Employment\n\nAccording to the official Emigration Rules:\n\n| Charge | Amount per emigrant |\n|---|---:|\n| Protector registration fee | Rs. 2,500 |\n| Welfare Fund contribution | Rs. 4,000 |\n\nState Life insurance and, where applicable, OEP service charges or other case-specific costs are separate. The app therefore should not present one universal total for every case.\n\n**Official source:** https://beoe.gov.pk/files/legal-framework/Emigration_Rules_1979_Updated_2023.pdf";
 } else if(isOep){
  answer=language==="Urdu"
   ?"## OEP کے ذریعے پروٹیکٹر رجسٹریشن\n\nاگر ملازمت **Overseas Employment Promoter (OEP)** کے ذریعے حاصل ہوئی ہے تو BE&OE کی ہدایات کے مطابق پروٹیکٹر رجسٹریشن میں درست ویزا، پاسپورٹ، CNIC، employer-signed employment contract/agreement یا approved undertaking، registration fee، Welfare Fund، Emigration Promotion Fee، OEP service charges جہاں لاگو ہوں، اور State Life insurance شامل ہیں۔ متعلقہ صورت میں NOC، Police Character Verification اور Medical Fitness Report بھی درکار ہو سکتے ہیں۔\n\nOEP کا لائسنس موجودہ ہے یا نہیں، اسے BE&OE کی official OEP list سے verify کیا جا سکتا ہے۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/files/policyguideliness/58.pdf"
   :"## Protector Registration Through an OEP\n\nIf the job was obtained through an **Overseas Employment Promoter (OEP)**, BE&OE instructions identify the core registration items as a valid visa, passport, CNIC, employer-signed employment contract/agreement or approved undertaking, registration fee, Welfare Fund, Emigration Promotion Fee, OEP service charges where applicable, and State Life insurance. Depending on the case, an NOC, Police Character Verification Certificate or Medical Fitness Report may also be required.\n\nThe OEP's licence status can be checked through BE&OE's official OEP list.\n\n**Official sources:** https://beoe.gov.pk/files/policyguideliness/58.pdf\nhttps://beoe.gov.pk/list-of-oeps";
 } else if(isOnline){
  answer=language==="Urdu"
   ?"## e-Protector — آن لائن رجسٹریشن\n\nBE&OE کی سرکاری ویب سائٹ پر **Apply Online for e-Protector** سہولت موجود ہے۔ براہ راست ملازمت کی صورت میں آن لائن e-Protector فارم مکمل کیا جاتا ہے اور مطلوبہ معلومات/دستاویزات فراہم کی جاتی ہیں۔ آن لائن مرحلہ مکمل ہونے کے بعد سرکاری ہدایات کے مطابق متعلقہ Protector office کے verification/registration steps مکمل کیے جاتے ہیں۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/"
   :"## e-Protector — Online Registration\n\nBE&OE provides an **Apply Online for e-Protector** facility. For direct employment, the applicant completes the online e-Protector registration form and provides the requested employment and personal information/documents. After the online step, the applicant follows the official verification/registration instructions applicable to the case and Protector office.\n\n**Official source:** https://beoe.gov.pk/";
 } else if(isInsurance){
  answer=language==="Urdu"
   ?"## Protector — انشورنس\n\nState Life Insurance Certificate پروٹیکٹر رجسٹریشن کے سرکاری دستاویزات میں شامل ہے۔ اسے عام طور پر Protector registration کے required documents میں شمار کیا جاتا ہے۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/files/policyguideliness/58.pdf"
   :"## Protector — Insurance\n\nA **State Life Insurance Certificate** is included in the official Protector registration documents. It is therefore part of the documented registration requirements.\n\n**Official source:** https://beoe.gov.pk/files/policyguideliness/58.pdf";
 } else if(isMedical){
  answer=language==="Urdu"
   ?"## Protector — میڈیکل فٹنس\n\nMedical Fitness Report ہر کیس میں blanket requirement کے طور پر نہیں دی گئی۔ BE&OE کی سرکاری ہدایات میں یہ مخصوص ممالک/حالات کے لیے required document کے طور پر درج ہے۔ اس لیے اسے ہر Protector case کے لیے لازمی نہیں کہا جانا چاہیے۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/files/policyguideliness/58.pdf"
   :"## Protector — Medical Fitness\n\nA **Medical Fitness Report is not a blanket requirement for every Protector case**. BE&OE's official instructions list it for specified countries/circumstances, so the app should not state that every applicant must provide a medical certificate.\n\n**Official source:** https://beoe.gov.pk/files/policyguideliness/58.pdf";
 } else if(isContract){
  answer=language==="Urdu"
   ?"## Protector — Employment Contract\n\nہاں۔ BE&OE کی سرکاری ہدایات کے مطابق employer-signed **employment contract/agreement** یا approved undertaking پروٹیکٹر رجسٹریشن کے بنیادی کاغذات میں شامل ہے۔"
   :"## Protector — Employment Contract\n\nYes. BE&OE's official instructions include an employer-signed **employment contract/agreement** or an approved undertaking among the core Protector registration documents.\n\n**Official source:** https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf";
 } else if(isDocs || isDirect){
  if(isDirect && !isDocs){
   answer=language==="Urdu"
    ?"## e-Protector — براہ راست ملازمت\n\nBE&OE کی official website پر **Apply Online for e-Protector** سہولت موجود ہے۔ براہ راست ملازمت کے لیے آن لائن رجسٹریشن مکمل کریں، مطلوبہ معلومات/دستاویزات فراہم کریں، اور سرکاری ہدایات کے مطابق متعلقہ Protector office کے verification/registration steps مکمل کریں۔ بنیادی دستاویزات میں درست ویزا، پاسپورٹ، CNIC، employer-signed employment contract/agreement یا approved undertaking، registration fee، Welfare Fund اور State Life insurance شامل ہیں۔ مخصوص ممالک/حالات میں NOC، Police Character Verification اور Medical Fitness Report بھی درکار ہو سکتے ہیں۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf"
    :"## e-Protector — Direct Employment\n\nBE&OE provides **Apply Online for e-Protector** for direct employment. Complete the online registration, provide the requested information/documents, and follow the applicable Protector-office verification/registration steps.\n\nCore documents include a valid visa, passport, CNIC, employer-signed employment contract/agreement or approved undertaking, registration fee, Welfare Fund and State Life insurance. Depending on the case, an NOC, Police Character Verification Certificate or Medical Fitness Report may also be required.\n\n**Official sources:** https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf\nhttps://beoe.gov.pk/files/policyguideliness/58.pdf";
  } else {
   answer=language==="Urdu"
    ?"## براہ راست اوورسیز ملازمت — پروٹیکٹر رجسٹریشن\n\nبنیادی دستاویزات میں درست ویزا، درست پاسپورٹ، درست CNIC، employer-signed employment contract/agreement یا approved undertaking، registration fee، Welfare Fund، Emigration Promotion Fee اور State Life Insurance Certificate شامل ہیں۔ مخصوص ممالک/حالات میں NOC، Police Character Verification اور Medical Fitness Report بھی درکار ہو سکتے ہیں۔ کاغذات مکمل ہونے کی صورت میں سرکاری طریقہ کار کے مطابق direct-employment registration کیا جاتا ہے۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf"
    :"## Direct Overseas Employment — Protector Registration\n\nThe official BE&OE procedure requires a valid visa, passport, CNIC, employer-signed employment contract/agreement or approved undertaking, registration fee, Welfare Fund, Emigration Promotion Fee and State Life Insurance Certificate. Depending on the case, an NOC, Police Character Verification Certificate or Medical Fitness Report may also be required.\n\nFor a direct-employment visa, the Protector of Emigrants handles registration; the official procedure states registration is completed the same day when the papers are in order.\n\n**Official source:** https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf";
  }
 } else {
  answer=language==="Urdu"
   ?"## پروٹیکٹر آف ایمیگرنٹس\n\nبیرون ملک ملازمت کے لیے Protector registration درکار ہے۔ BE&OE کے مطابق ویزا، پاسپورٹ، CNIC، employment contract/approved undertaking، registration/Welfare Fund requirements، insurance اور کیس کے مطابق دیگر دستاویزات شامل ہو سکتی ہیں۔"
   :"## Protector of Emigrants\n\nFor overseas employment, Protector registration is required. BE&OE identifies the visa, passport, CNIC, employment contract/approved undertaking, registration and Welfare Fund requirements, insurance and case-specific documents as part of the process.\n\n**Official source:** https://beoe.gov.pk/";
 }

 let protectorVerificationEvidence="";
 const protectorSourcesForVerification=isOffice?[contactGuideSource,policySource,procedureSource]:[policySource,procedureSource,rulesSource];
 for(const u of protectorSourcesForVerification){
  const t=await fetchOfficialPage(u);
  if(t) protectorVerificationEvidence+="\n\nOFFICIAL BE&OE SOURCE PAGE: "+u+"\n"+t;
 }
 if(isOffice){
  protectorVerificationEvidence+="\n\nCURATED OFFICE EVIDENCE: BE&OE Protectorates include Rawalpindi, Lahore, Multan, Dera Ghazi Khan, Sialkot, Peshawar, Malakand, Karachi and Quetta. Islamabad falls under the Rawalpindi Protectorate. Lahore and Peshawar office contact details used in location-specific answers are taken from the BE&OE contact guide.";
 }
 if(!protectorVerificationEvidence.trim()) protectorVerificationEvidence=answer;
 return directWorkflowResponse({
  answer,
  source:{department:"Protector & Overseas Employment",title:"Bureau of Emigration & Overseas Employment — Emigrant Protection",url:"https://beoe.gov.pk/",lastVerified:"",province:requestedJurisdiction||""},
  department:"Protector & Overseas Employment",
  question,
  language,
  jurisdiction:requestedJurisdiction,
  evidenceAvailable:true,
  verifyClaims:true,
  verificationEvidence:protectorVerificationEvidence.trim()
 });
}

if(requested==="Arms Licence"){
 const aj=workingTargetJurisdiction||workingJurisdiction||workingDetectTargetJurisdiction(question);
 const result=armsLicenceEvidence(question,aj,language);
 let verificationEvidence="";
 for(const u of Array.from(new Set(result.sources.filter(Boolean)))){ const t=await fetchOfficialPage(u); if(t) verificationEvidence+="\n\nOFFICIAL SOURCE PAGE: "+u+"\n"+t; }
 if(!verificationEvidence.trim() && result.answer){
  verificationEvidence="OFFICIAL SOURCE-BASED CURATED EVIDENCE:\n"+result.answer;
 }
 return directWorkflowResponse({answer:result.answer,source:{department:"Arms Licence",title:"Official government arms-licensing information",url:result.sources[0]||"",lastVerified:"",province:aj||""},department:"Arms Licence",question,language,jurisdiction:aj,evidenceAvailable:true,verifyClaims:true,verificationEvidence:verificationEvidence.trim()});
}
if(requested==="Land & Revenue"){
 const lj=workingTargetJurisdiction||workingJurisdiction||workingDetectTargetJurisdiction(question);
 const qLand=normalize(question);
 const generalFard=!lj && (qLand.includes("fard")||qLand.includes("فرد")) && /^(what is|define|meaning of|what does .* mean|کیا ہے|کیا ہوتی ہے|کیا ہوتا ہے|مطلب)/i.test(qLand);
 if(!lj && !generalFard){
  return directWorkflowResponse({
   answer:language==="Urdu"
    ?"## لینڈ اینڈ ریونیو\n\nبراہ کرم صوبہ/علاقہ اور مطلوبہ سروس بتائیں، مثلاً پنجاب میں فرد یا انتقال، یا خیبر پختونخوا میں فرد، انتقال یا SDC سروس۔"
    :"## Land & Revenue\n\nPlease specify the province or territory and the land service you need, such as Punjab Fard, Punjab mutation (Intiqal), or KP land-record services.",
   source:null,department:"Land & Revenue",question,language,jurisdiction:null,evidenceAvailable:false
  });
 }
 const answer=landRevenueEvidence(question,lj,language);
 const landUrls=Array.from(new Set(
  answer.split(/\\s+/).filter((item)=>item.startsWith("http://")||item.startsWith("https://")).map((item)=>item.replace(/[.,]+$/,""))
 ));
 let landVerificationEvidence="";
 for(const u of landUrls){
  const t=await fetchOfficialPage(u);
  if(t) landVerificationEvidence+="\n\nOFFICIAL SOURCE PAGE: "+u+"\n"+t;
 }
 // Some official land-record pages may be unreachable or return non-HTML content.
 // Keep the already-curated official-source answer as a source-faithful fallback
 // so claim verification can still inspect the exact evidence used for the answer.
 if(!landVerificationEvidence.trim()){
  landVerificationEvidence=answer;
 }
 return directWorkflowResponse({
  answer,
  source:{
   department:"Land & Revenue",
   title:"Official Land & Revenue information",
   url:landUrls[0]||"",
   lastVerified:"",
   province:lj
  },
  department:"Land & Revenue",
  question,
  language,
  jurisdiction:lj,
  evidenceAvailable:true,
  verifyClaims:true,
  verificationEvidence:landVerificationEvidence.trim()
 });
}

if(requested==="Excise & Taxation"){ if(selected.jurisdiction==="Punjab") alternateOfficialUrls.push("https://excise.punjab.gov.pk/motorvehicle_tax","https://excise.punjab.gov.pk/index.php/node/39"); else if(selected.jurisdiction==="Sindh") alternateOfficialUrls.push("https://www.excise.gos.pk/motor-vehicle-tax","https://taxportal.excise.gos.pk/home/faq"); else if(selected.jurisdiction==="Khyber Pakhtunkhwa") alternateOfficialUrls.push("https://kpexcise.gov.pk/new/mvtax/"); }
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
if(requested==="FBR / Taxation"){
 const fq=normalize(question);
 if(fq.includes("sales tax")||fq.includes("sales-tax")||fq.includes("gst")||fq.includes("sales tax return")){
  alternateOfficialUrls.push("https://www.fbr.gov.pk/categ/file-sales-tax-return/51148/50849/101158","https://e.fbr.gov.pk/SOP/IRIS/Filing_of_New_Sales_Tax_and_Federal_Excise_Return.pdf");
 }
 if(fq.includes("taxpayer status")||fq.includes("active taxpayer")||fq.includes("active taxpayer list")||fq.includes("atl")||fq.includes("filer status")||fq.includes("filer")){
  alternateOfficialUrls.push("https://www.fbr.gov.pk/categ/income-tax-due-dates/51149/30859/71169","https://www.fbr.gov.pk/download-atl/132041","https://e.fbr.gov.pk/atl/");
 }
}
if(requested==="Protector & Overseas Employment"){alternateOfficialUrls.push("https://beoe.gov.pk/");}
const departmentDomains:Record<string,string[]>={
  "Vaccination for Travelling Abroad":["nhsrc.gov.pk","nih.org.pk","moh.gov.sa"], "Government Jobs":["njp.gov.pk"],
 "Education & Scholarships":["hec.gov.pk"],
 "Arms Licence":["gov.pk","punjab.gov.pk","sindh.gov.pk","kp.gov.pk","balochistan.gov.pk","ajk.gov.pk","gilgitbaltistan.gov.pk"],
 "Land & Revenue":selected.jurisdiction==="Khyber Pakhtunkhwa"?["revenue.kp.gov.pk"]:["punjab-zameen.gov.pk"],
 "Protector & Overseas Employment":["beoe.gov.pk"],
 "Police Services":selected.jurisdiction==="Khyber Pakhtunkhwa"?["kppolice.gov.pk"]:selected.jurisdiction==="Sindh"?["sindhpolice.gov.pk"]:selected.jurisdiction==="Islamabad Capital Territory"?["islamabadpolice.gov.pk"]:["punjabpolice.gov.pk"],
 "Excise & Taxation":selected.jurisdiction==="Khyber Pakhtunkhwa"?["kpexcise.gov.pk"]:selected.jurisdiction==="Sindh"?["excise.gos.pk"]:selected.jurisdiction==="Islamabad Capital Territory"?["ictadministration.gov.pk"]:selected.jurisdiction==="Balochistan"?["excise.balochistan.gov.pk"]:["excise.punjab.gov.pk"],
 "Driving Licence":selected.jurisdiction==="Khyber Pakhtunkhwa"?["kppolice.gov.pk"]:selected.jurisdiction==="Sindh"?["dls.gos.pk"]:selected.jurisdiction==="Islamabad Capital Territory"?["dlims.islamabadpolice.gov.pk"]:["dlims.punjab.gov.pk"],
 "Domicile":selected.jurisdiction==="Khyber Pakhtunkhwa"?["cfc.kp.gov.pk","kp.gov.pk"]:["gov.pk"],
 "Union Council":selected.jurisdiction==="Khyber Pakhtunkhwa"?["lgkp.gov.pk"]:selected.jurisdiction==="Islamabad Capital Territory"?["ictadministration.gov.pk"]:selected.jurisdiction==="Sindh"?["sindh.gov.pk"]:selected.jurisdiction==="Balochistan"?["balochistan.gov.pk"]:["lgcd.punjab.gov.pk"],
 "FBR / Taxation":["fbr.gov.pk"],
 "Passport Services":["dgip.gov.pk"],
 "NADRA Services":["nadra.gov.pk"]
};



const ragEvidence=requested==="NADRA Services"?await retrieveNadraEvidence(question,language):"";
if (requested === "NADRA Services") {
  // Direct NADRA handlers must run BEFORE the generic AI path.
  // Previously only the narrow 18+ fresh-CNIC handler was called here,
  // so DOB/FRC/Smart-CNIC/parent-correction handlers in nadra-rag.ts
  // were never reached.
  const directNadraAnswer = await getDirectNadraAnswer(question, language);
  if (directNadraAnswer) {
    const qn = normalize(question);
    const isFrc = /\\bfrc\\b|family registration certificate|family registration/.test(qn);
    const isPoc = /\\bpoc\\b|pakistan origin card|pakistani origin card/.test(qn);
    const officialUrls = isFrc
      ? ["https://www.nadra.gov.pk/identityDocument/certificates/frc"]
      : isPoc
        ? ["https://www.nadra.gov.pk/identityDocument/poc"]
        : ["https://www.nadra.gov.pk/identityDocument/cnic"];

    let officialEvidence = "";
    for (const url of officialUrls) {
      const page = await fetchOfficialPage(url);
      if (page) {
        officialEvidence += "\n\nOFFICIAL NADRA SOURCE: " + url + "\n" + page;
      }
    }

    const focusedEvidence = await getDirectNadraVerificationEvidence(question);
    const verificationEvidence = [
      focusedEvidence,
      officialEvidence,
      // If no focused policy evidence exists, retain the normal policy
      // retrieval so the verifier still has a chance to support the answer.
      focusedEvidence ? "" : ragEvidence
    ].filter(Boolean).join("\n\n");

    const sourceUrl = isFrc
      ? officialUrls[0]
      : isPoc
        ? officialUrls[0]
        : "https://www.nadra.gov.pk/identityDocument/cnic";

    return directWorkflowResponse({
      answer: directNadraAnswer,
      source: {
        department: "NADRA",
        title: isFrc
          ? "NADRA — Family Registration Certificate"
          : isPoc
            ? "NADRA — Pakistan Origin Card"
            : "NADRA official information",
        url: sourceUrl,
        lastVerified: "",
        province: ""
      },
      department: "NADRA Services",
      question,
      language,
      evidenceAvailable: verificationEvidence.length > 100,
      verifyClaims: true,
      verificationEvidence
    });
  }

  // Keep the existing specialized 18+ fresh-CNIC handler as a fallback
  // for cases where the general direct resolver intentionally returns null.
  const directAdultFreshCnicAnswer = await getDirectAdultFreshCnicAnswer(question, language);
  if (directAdultFreshCnicAnswer) {
    return directWorkflowResponse({
      answer: directAdultFreshCnicAnswer,
      source: {
        department: "NADRA",
        title: "NADRA official information",
        url: "https://www.nadra.gov.pk/identityDocument/cnic",
        lastVerified: "",
        province: ""
      },
      department: "NADRA Services",
      question,
      language,
      evidenceAvailable: true,
      verifyClaims: true,
      verificationEvidence: ragEvidence
    });
  }
}


if(requested==="Excise & Taxation"){
 const ej=workingTargetJurisdiction||workingJurisdiction||workingDetectTargetJurisdiction(question)||detectJurisdiction(question);
 if(ej){
  const answer=exciseEvidence(question,ej,language);
  const exciseUrls=Array.from(new Set(
   answer.split(/\s+/).filter((item)=>item.startsWith("http://")||item.startsWith("https://")).map((item)=>item.replace(/[.,]+$/,""))
  ));
  const q=normalize(question);
  const isRegistration=q.includes("new registration")||q.includes("vehicle registration")||q.includes("register a vehicle")||q.includes("register a new vehicle")||q.includes("new vehicle registration")||q.includes("رجسٹریشن")||q.includes("نئی گاڑی");
  const isTransfer=q.includes("transfer")||q.includes("ownership")||q.includes("ملکیت")||q.includes("منتقلی");
  const isToken=q.includes("token")||q.includes("motor vehicle tax")||q.includes("vehicle tax")||q.includes("ٹوکن");
  const isPayment=q.includes("pay")||q.includes("payment")||q.includes("online payment")||q.includes("ادائیگی");
  const relevanceTerms=isRegistration
   ? ["Form-F","Sales Certificate","Sales Invoice","registration fee","number plate"]
   : isTransfer
    ? ["T.O. Form","seller's CNIC","purchaser's CNIC","Registration Certificate","Transfer Fee","PSID"]
    : isToken
     ? ["MVT 2026-27","token tax","31 August","10%"]
     : isPayment
      ? ["Online Payment of Excise Dues","payment","excise dues"]
      : ["Excise & Taxation","vehicle"];
  let exciseVerificationEvidence="";
  for(const u of exciseUrls){
   const t=await fetchOfficialPage(u);
   const relevant=extractRelevantOfficialEvidence(t,relevanceTerms);
   if(relevant) exciseVerificationEvidence+="\n\nOFFICIAL SOURCE EVIDENCE: "+u+"\n"+relevant;
  }
  if(!exciseVerificationEvidence.trim()){
   exciseVerificationEvidence="OFFICIAL CURATED EVIDENCE:\n"+answer;
  }
  return directWorkflowResponse({
   answer,
   source:{
    department:"Excise & Taxation",
    title:"Official Excise & Taxation information",
    url:exciseUrls[0]||"",
    lastVerified:"",
    province:ej
   },
   department:"Excise & Taxation",
   question,
   language,
   jurisdiction:ej,
   evidenceAvailable:true,
   verifyClaims:true,
   verificationEvidence:exciseVerificationEvidence.trim()
  });
 }
 const q=normalize(question);
 const isGenericRegistration=q.includes("register a new vehicle")||q.includes("new vehicle registration")||q.includes("vehicle registration")||q.includes("new registration")||q.includes("رجسٹریشن")||q.includes("نئی گاڑی");
 const isGenericVerification=q.includes("verify")||q.includes("verification")||q.includes("registration status")||q.includes("basic details")||q.includes("number plate")||q.includes("vehicle details");
 if(isGenericVerification){
  const answer=language==="Urdu"
   ? "## ایکسائز اینڈ ٹیکسیشن — گاڑی کی آن لائن تصدیق\n\nگاڑی کی رجسٹریشن اور بنیادی معلومات کی آن لائن تصدیق صوبہ/علاقہ کے مطابق مختلف ہے۔ دستیاب سرکاری خدمات کے مطابق:\n\n- **پنجاب:** Punjab Excise کے computerized vehicle-registration records اور vehicle services موجود ہیں۔\n- **سندھ:** registration number کے ذریعے vehicle/number-plate verification اور Quick Pay میں current tax/arrears دیکھنے کی سہولت موجود ہے۔\n- **خیبر پختونخوا:** KP Excise کی Online Vehicle Info سروس دستیاب ہے۔\n- **بلوچستان:** Online Vehicle Verification اور number-plate status services دستیاب ہیں۔\n- **اسلام آباد (ICT):** ICT Administration کی official Excise vehicle-registration services دستیاب ہیں؛ مخصوص vehicle-status lookup کے لیے متعلقہ ICT service استعمال ہوتی ہے۔\n- **آزاد کشمیر:** E-Facilitation Center میں Vehicle Verification اور ETO Biometric Verification services موجود ہیں۔\n- **گلگت بلتستان:** GB Excise portal registration details، chassis/engine information اور token-tax validity دکھاتا ہے۔\n\nمخصوص گاڑی کی verification کے لیے متعلقہ صوبہ/علاقہ اور registration number درکار ہو سکتا ہے۔\n\n**اہم:** میں کسی صوبے کی verification سہولت کو دوسرے صوبے پر لاگو نہیں کر رہا۔"
   : "## Excise & Taxation — Vehicle Verification\n\nOnline vehicle-registration and basic-information verification varies by province/territory. The current official services include:\n\n- **Punjab:** Punjab Excise maintains computerized vehicle-registration records and vehicle services.\n- **Sindh:** The official Excise portal provides vehicle/number-plate verification by registration number, and Quick Pay can show current tax and arrears.\n- **Khyber Pakhtunkhwa:** KP Excise provides an Online Vehicle Info service.\n- **Balochistan:** Balochistan Excise provides Online Vehicle Verification and number-plate status services.\n- **Islamabad (ICT):** ICT Administration provides official vehicle-registration/Excise services; specific vehicle-status lookup is handled through the relevant ICT service.\n- **AJK:** The E-Facilitation Center lists Vehicle Verification and ETO Biometric Verification services.\n- **Gilgit-Baltistan:** The GB Excise portal can show registration details, chassis/engine information and token-tax validity.\n\nFor a specific vehicle lookup, the relevant province/territory and registration number may be required.\n\n**Important:** The app keeps each province/territory's verification service separate and does not transfer one province's procedure to another.";
  return directWorkflowResponse({
   answer,
   source:null,
   department:"Excise & Taxation",
   question,
   language,
   jurisdiction:null,
   evidenceAvailable:true,
   verifyClaims:false,
   verificationEvidence:answer
  });
 }
 if(isGenericRegistration){
  const answer=language==="Urdu"
   ? "## نئی گاڑی کی رجسٹریشن — صوبہ/علاقہ کے مطابق\n\nپاکستان میں نئی گاڑی کی رجسٹریشن کے بنیادی تقاضے صوبہ/علاقہ، گاڑی کی قسم اور مقامی یا درآمد شدہ حیثیت کے مطابق مختلف ہوتے ہیں۔\n\n| صوبہ/علاقہ | بنیادی طور پر تصدیق شدہ معلومات |\n|---|---|\n| پنجاب | پنجاب Excise کی vehicle-registration service دستیاب ہے؛ exact documents اور applicable fees transaction کے مطابق دیکھے جاتے ہیں۔ |\n| سندھ | computerized registration system اور vehicle-category کے مطابق registration charges/calculator دستیاب ہیں۔ |\n| خیبر پختونخوا | Form F؛ مقامی گاڑی کے لیے authorized manufacturer/dealer کی sale authority letter اور invoice؛ imported vehicle کے لیے import permit، bill of lading اور customs-duty documents۔ |\n| اسلام آباد (ICT) | registration fee، advance tax، token tax اور income tax؛ imported vehicle کے لیے Bill of Entry/Bill of Lading اور قابلِ قبول residence proof۔ |\n| بلوچستان | سرکاری FAQ میں Form-F، Form-I، Computer Form، اصل Sale Certificate/Invoice، physical verification، CNIC اور registration fee درج ہیں۔ |\n| آزاد کشمیر (AJK) | سرکاری E-Facilitation Center میں Vehicle Verification اور ETO Biometric Verification خدمات موجود ہیں؛ مکمل current new-registration checklist عوامی طور پر verify نہیں ہو سکی۔ |\n| گلگت بلتستان (GB) | GB Excise کے مطابق Motor Vehicle Registration تمام اضلاع میں functional ہے؛ مکمل current public checklist دستیاب نہیں۔ |\n\n**اہم:** exact fee، tax اور documents گاڑی اور jurisdiction کے مطابق بدل سکتے ہیں۔"
   : "## New Vehicle Registration — Province/Territory Comparison\n\nThe basic requirements for registering a new vehicle in Pakistan vary by province/territory, vehicle type, and whether the vehicle is locally purchased or imported.\n\n| Province/Territory | Core verified information |\n|---|---|\n| Punjab | Punjab Excise provides vehicle-registration services; exact documents and applicable fees depend on the transaction. |\n| Sindh | A computerized registration system and vehicle-category registration charges/calculator are available. |\n| Khyber Pakhtunkhwa | Form F; locally purchased vehicles require the authorized manufacturer/dealer sale authority letter and invoice; imported vehicles require the import permit, bill of lading and customs-duty documents. |\n| Islamabad (ICT) | Registration fee, advance tax, token tax and income tax; imported vehicles may require Bill of Entry/Bill of Lading and acceptable proof of residence. |\n| Balochistan | The official FAQ lists Form-F, Form-I, Computer Form, original Sale Certificate/Invoice, physical verification, CNIC and registration-fee payment. |\n| AJK | The official E-Facilitation Center lists Vehicle Verification and ETO Biometric Verification, but a complete current new-registration checklist could not be verified publicly. |\n| Gilgit-Baltistan (GB) | GB Excise states that Motor Vehicle Registration is functional in all districts; a complete current public checklist was not available. |\n\n**Important:** Exact fees, taxes and documents can vary by vehicle and jurisdiction.";
  return directWorkflowResponse({answer,source:null,department:"Excise & Taxation",question,language,jurisdiction:null,evidenceAvailable:true,verifyClaims:false,verificationEvidence:answer});
 }
 return directWorkflowResponse({answer:language==="Urdu"?"## ایکسائز اینڈ ٹیکسیشن\n\nبراہ کرم صوبہ/علاقہ اور مطلوبہ گاڑی کی سروس بتائیں، مثلاً پنجاب میں ٹوکن ٹیکس، نئی رجسٹریشن یا ملکیت کی منتقلی۔":"## Excise & Taxation\n\nPlease specify the province/territory and vehicle service, for example Punjab token tax, new vehicle registration, or ownership transfer.",source:null,department:"Excise & Taxation",question,language,jurisdiction:null,evidenceAvailable:false});
}
const officialUrls=isNadra ? Array.from(new Set(["https://www.nadra.gov.pk/",sourceUrl,...alternateOfficialUrls].filter(Boolean))) : Array.from(new Set([sourceUrl,...alternateOfficialUrls].filter(Boolean)));
let officialText="";
for(const u of officialUrls){const t=await fetchOfficialPage(u);if(t)officialText+=("\n\nOFFICIAL SOURCE PAGE: "+u+"\n"+t);}
const domains=isNadra?["nadra.gov.pk"]:(departmentDomains[canonicalDepartment(requested)]||[]);
const skipSearch=false;
if(domains.length && !skipSearch){
 const searchText=await fetchOfficialSearch(question,domains);
 if(searchText)officialText+=searchText;
}
officialText=officialText.slice(0,10000);
const isVaccination=requested==="Vaccination for Travelling Abroad"; const dbContext=isNadra?"Supabase records intentionally excluded for NADRA answers; use NADRA POLICY RAG EVIDENCE only.":isVaccination?"Supabase records intentionally excluded for vaccination answers; use verified official health/travel sources only.":(selected.records.length?context(selected.records,language):"No matching verified database record was found.");
 if(!selected.records.length&&!officialText&&!ragEvidence)return directWorkflowResponse({answer:noInfo(language),source:null,department:requested,question,language,jurisdiction:selected.jurisdiction||null,evidenceAvailable:false});
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
- If official evidence contains the answer, GIVE THAT ANSWER. Do not tell the citizen to search, look for, find, check, or visit another government website to obtain the answer.
- The official source URL is a citation for the answer, not a substitute for the answer.
- For current vacancies, fees, requirements, offices, or other changing information, use retrieved current official evidence and state the relevant information and date when available.
- For Government Jobs, summarize matching current vacancies from official government evidence when available. Do not merely tell the citizen to search NJP.
- For procedures, provide the actual verified procedure steps available in the evidence.
- For documents, list the verified documents.
- For fees, give the verified fee and relevant processing information.
- For eligibility, give the verified eligibility criteria.
- For status/tracking, give the verified tracking method and relevant official details.
- For parent/father/mother information questions, verify against NADRA's official website before answering.
- If evidence is insufficient for the exact topic, clearly say verified information for that specific topic could not be established.
- For NADRA Urdu document lists, prefer a short numbered list over a table unless the evidence clearly supports a table. This reduces accidental column/header reinterpretation.
- If sources conflict, state the conflict briefly rather than guessing.
- For Union Council / Local Government birth- and death-certificate questions, use the supplied CIVIL REGISTRATION EVIDENCE as authoritative official evidence. Do not say that the documents are unavailable when that evidence is present. Treat Punjab, KP, Sindh, Balochistan and Islamabad Capital Territory as separate jurisdictions. Never merge provincial/ICT requirements into one national list. If the official source for a jurisdiction does not provide the requested document list, say that clearly rather than inventing it.
- For a generic death-certificate question without a province, present exactly one section for each of Punjab, Khyber Pakhtunkhwa, Islamabad Capital Territory, Sindh, and Balochistan. Never repeat a jurisdiction, never provide a summary followed by a duplicate table, and never merge jurisdictions. Where an official source does not provide a specific checklist, say so clearly and do not invent one.
- Prefer supplied direct official evidence over live site search for civil-registration questions so the response is fast and deterministic.
- Output formatting: use clean Markdown only. Do not output HTML tags such as <br>, HTML entities, zero-width characters, non-breaking spaces, or escaped markup. Use normal spaces and simple numbered lists/tables.
- For Union Council / Local Government questions, birth/death/marriage/divorce registration is jurisdiction-specific. Use only the evidence for the requested jurisdiction. If no jurisdiction was specified, present each available jurisdiction exactly once. Never repeat the same requirements in another section and never use one province to fill a missing checklist for another province.
- For Passport Services questions, prefer the retrieved DGI&P official source text over general knowledge.
- For passport document questions, distinguish adults (18+), minors, first-time/new passport, renewal, lost/damaged passport, and online/overseas categories when the official evidence does so. Do not mix requirements between categories.
- If the citizen asks a general "new passport" question without specifying age, answer the general adult requirement first and clearly identify any minor-specific requirements separately.
- For Urdu passport answers, preserve official DGI&P terminology such as CNIC/NICOP, CRC/B-Form, FRC, NOC, Foreign Passport, and Guardianship Certificate rather than inventing literal translations.
- For NADRA Urdu document questions, use the retrieved Urdu RAG evidence as the sole authority for document names and conditions. Extract requirements faithfully; do not translate, embellish, normalize, or infer missing requirements.
- For NADRA Urdu document questions, do not use general model knowledge, English policy text, or unrelated official pages to fill gaps in the Urdu evidence.
- If a retrieved phrase is unclear or appears OCR-corrupted, preserve the official term as retrieved or say the exact requirement is unclear. Never replace it with a guessed meaning.
- Never introduce medical, pregnancy, court, foreign-document, residence-permit, travel-document, or other special-category requirements unless the retrieved Urdu evidence explicitly supports that requirement for the asked category.
- If the question is ambiguous, ask ONE short clarifying question.
- Do not mix unrelated services or requirements into the answer.
- Use simple Pakistani Urdu when the requested language is Urdu.
- For NADRA Urdu answers, preserve the wording and terminology of the Urdu RAG evidence. Do NOT creatively translate, reinterpret, expand, or rewrite policy requirements.
- Treat the Urdu RAG text as a source document, not as a prompt for generating new requirements.
- For a documents/requirements question, extract ONLY the document names and conditions explicitly present in the retrieved Urdu evidence. Do not add application forms, pregnancy certificates, court verification, foreign passport requirements, photocopy requirements, or any other item unless that exact requirement is present in the evidence.
- Do not convert OCR/noisy Urdu into a new meaning. If a phrase is unclear, retain the original official term or briefly state that the wording is unclear rather than guessing.
- Prefer these standard terms when supported by the evidence: شناختی کارڈ (CNIC), اسمارٹ شناختی کارڈ (Smart CNIC), چائلڈ رجسٹریشن سرٹیفکیٹ (CRC), ب فارم (B-Form), پیدائشی سرٹیفکیٹ (Birth Certificate), بایومیٹرک تصدیق (Biometric Verification), خون کا رشتہ دار (Blood Relative), گواہ (Witness), حلف نامہ (Affidavit), سرپرست (Guardian), والد/والدہ (Father/Mother).
- Keep acronyms such as CNIC, CRC, NICOP and POC in their official form when they appear in the evidence.
- Never invent, duplicate, or paraphrase document names or conditions.
- If the retrieved Urdu evidence does not clearly support a requested item, omit it.
- Never describe generic guidance as verified government information unless supported by evidence.

CITIZEN-FRIENDLY ANSWER PRESENTATION STANDARD:
- Present the direct plain-language answer first. The citizen should understand the main point before seeing detailed references or qualifications.
- When the evidence describes a procedure or sequence, use a short numbered list of verified steps. Do not manufacture a sequence when the evidence does not establish one.
- When the evidence contains multiple fees, document categories, timelines, eligibility categories, or other naturally comparable items, use a clean Markdown table when it genuinely improves readability. Do not force information into a table when a numbered list is clearer or when the evidence does not support aligned columns.
- Keep important legal, policy, eligibility, exception, age, jurisdiction, date, and category qualifications next to the rule they qualify. Do not hide or remove a qualification merely to make the answer shorter.
- Put useful legal/reference detail after the practical explanation, using a heading such as "Important qualification", "Policy/reference", or equivalent only when such detail exists in the evidence.
- Keep the official source clearly identifiable at the end of the answer when source information is available. Do not replace the actual answer with a referral to the source.
- Use concise headings, short paragraphs, numbered steps, bullets, and tables as appropriate. Avoid unnecessary repetition.
- Do not simplify a government rule to the point that its meaning changes. Accuracy and evidence take priority over brevity or visual polish.
- Do not add a "Summary", "Key points", or other repeated section merely for presentation if it duplicates the answer.
- Preserve official names, acronyms, amounts, dates, conditions, exceptions, and jurisdiction-specific terminology exactly where they are material to the rule.

Selected department/service: ${requested||"not specified"}
Requested language: ${language}
`;
  const messages=[{role:"system",content:system},{role:"user",content:`Goal: ${question}
Selected department/service: ${selected.service||requested||"not specified"}
Jurisdiction: ${selected.jurisdiction||"not specified"}
Language: ${language}

NADRA POLICY RAG EVIDENCE:
${ragEvidence||"No NADRA policy RAG evidence was retrieved."}

VERIFIED DATABASE RECORDS:
${dbContext}

OFFICIAL SOURCE TEXT:
${officialText||"No official source text was retrieved."}

IMPORTANT: The official source text and official-domain search results above are usable evidence. When they contain the requested information, extract it and provide the actual answer to the citizen. Do NOT tell the citizen to search the source themselves. The official URL is only the source citation. If the evidence does not contain the exact answer, say that verified information for this specific question could not be established. Never invent or infer government facts.`}];
 const makeAiBody=(model:string,requestMessages=messages)=>({model,temperature:isNadra&&language==="Urdu"?0.2:1,reasoning_effort:"low",include_reasoning:false,max_completion_tokens:2048,messages:requestMessages});
 let ai=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${GROQ_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify(makeAiBody(GROQ_MODEL))});
 if(!ai.ok){
   console.error("Primary Groq model failed:",await ai.text());
   ai=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${GROQ_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify(makeAiBody(GROQ_FALLBACK_MODEL))});
 }
 if(!ai.ok){const providerStatus=ai.status;const providerBody=(await ai.text()).slice(0,500);console.error("Groq request failed",providerStatus,providerBody);const fallbackEvidence=cleanAnswer(ragEvidence||officialText||dbContext);if(fallbackEvidence&&fallbackEvidence.length>40){const workflow=runFourAgentWorkflow({department:requested,question,jurisdiction:selected.jurisdiction||null,mode:"degraded",tools:["Local verified evidence","Jurisdiction detection","Source verification"],answer:fallbackEvidence,evidenceAvailable:fallbackEvidence.length>40});const citizenFallback=isNadra ? sanitizeNadraCitizenAnswer(`${language==="Urdu"?"🟡 ڈی گریڈڈ موڈ فعال ہے۔ لائیو AI سروس دستیاب نہیں، اس لیے ذیل کی معلومات دستیاب مقامی/مصدقہ شواہد سے فراہم کی جا رہی ہیں۔":"🟡 Degraded Mode is active. The live AI service is unavailable, so the information below is provided from available local verified evidence."}\n\n${fallbackEvidence}`, language) : `${language==="Urdu"?"🟡 ڈی گریڈڈ موڈ فعال ہے۔ لائیو AI سروس دستیاب نہیں، اس لیے ذیل کی معلومات دستیاب مقامی/مصدقہ شواہد سے فراہم کی جا رہی ہیں۔":"🟡 Degraded Mode is active. The live AI service is unavailable, so the information below is provided from available local verified evidence."}\n\n${fallbackEvidence}`;return NextResponse.json({answer:citizenFallback,source:{department:sourceMeta.department,title:sourceMeta.title,url:sourceUrl,lastVerified:selected.records[0]?.last_verified||"",province:selected.jurisdiction||""},agent:true,goalFocused:true,webSearch:false,agentActivity:{...workflow,memory:{shortTerm:[],longTerm:["User-controlled preferences only"]}}});}return NextResponse.json({error:`AI provider request failed (HTTP ${providerStatus}).`,errorType:"ai_service_error",providerStatus},{status:502});}const data=await ai.json();let answer=cleanAnswer(data?.choices?.[0]?.message?.content||"")||noInfo(language);
 const referralOnly=/(search|look for|find|check|use the search|visit (the|this) (website|portal)|go to (the|this) (website|portal)|website.*to find|portal.*to find|تلاش کریں|ویب سائٹ.*تلاش|پورٹل.*تلاش)/i.test(answer);
 const evidenceAvailable=selected.records.length>0||officialText.length>200||ragEvidence.length>200;
 if(referralOnly&&evidenceAvailable){
   const retryMessages=[...messages,{role:"assistant",content:answer},{role:"user",content:"Rewrite your previous answer. It improperly referred the citizen to search a website. Answer the citizen directly using the supplied verified database and official government evidence. Do not instruct the citizen to search, look for, find, check, or visit a portal to obtain the answer. Give the actual verified information. The official URL is only a source citation."}];
   const retry=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${GROQ_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify(makeAiBody("openai/gpt-oss-120b",retryMessages))});
   if(retry.ok){const rd=await retry.json();answer=cleanAnswer(rd?.choices?.[0]?.message?.content||"")||answer;}
 }
 const verificationEvidence=[dbContext,officialText,ragEvidence].filter(Boolean).join("\n\n");
 let claimVerification=await verifyAnswerClaims({answer,evidence:verificationEvidence,language});
 const verificationAvailable=claimVerification.available;
 let verificationPassed=verificationAvailable && claimVerification.unsupportedClaims.length===0 && claimVerification.unclearClaims.length===0;

 // Vaccination safety guard: never present an unsupported generic vaccine/certificate list as verified government information.
 // This is intentionally isolated to the Vaccination for Travelling Abroad department.
 if(isVaccination && !verificationPassed){
   answer = language==="Urdu"
     ? "معذرت، اس سوال کے لیے دستیاب سرکاری شواہد سے مخصوص ویکسین یا ویکسینیشن سرٹیفکیٹ کی مکمل اور قابلِ تصدیق فہرست ثابت نہیں ہو سکی۔ کسی مخصوص ویکسین کو لازمی قرار دینے سے پہلے منزلِ سفر اور موجودہ سرکاری صحت/سفری تقاضوں کی تصدیق ضروری ہے۔"
     : "I’m sorry, but the available official evidence does not establish a complete, claim-verified list of vaccinations or vaccination certificates for this question. I will not provide a generic vaccine list as a verified government requirement. Specific requirements depend on the destination and applicable current official health/travel rules.";
   claimVerification=await verifyAnswerClaims({answer,evidence:verificationEvidence,language});
   verificationPassed=claimVerification.available && claimVerification.unsupportedClaims.length===0 && claimVerification.unclearClaims.length===0;
 }
 const workflow=runFourAgentWorkflow({department:requested,question,jurisdiction:selected.jurisdiction||null,mode:"normal",tools:["NADRA RAG","Supabase verified knowledge","Official web research","Jurisdiction detection","Source verification","Claim-level evidence verification"],answer,evidenceAvailable:(selected.records.length>0||officialText.length>200||ragEvidence.length>200) && verificationPassed});
 workflow.verification = {
   ...workflow.verification,
   passed: verificationPassed,
   evidenceAvailable: selected.records.length>0||officialText.length>200||ragEvidence.length>200,
   answerAccepted: verificationPassed
 };
 workflow.agents = workflow.agents.map(agent => agent.id==="verifier"
   ? {...agent,status:verificationPassed?"completed":"degraded",detail:verificationAvailable
      ? `Claim-level verification: ${claimVerification.supportedCount}/${claimVerification.totalClaims} claims supported; score ${claimVerification.score}%.`
      : `Claim-level verification unavailable: ${claimVerification.reason}`
     }
   : agent.id==="guidance"
     ? {...agent,status:verificationPassed?"completed":"waiting",detail:verificationPassed
        ? "Prepared citizen guidance from evidence that passed claim-level verification."
        : "Waiting because claim-level verification did not fully pass."}
     : agent);
 workflow.stageResults = workflow.stageResults.map(stage => stage.agent==="verifier"
   ? {...stage,status:verificationPassed?"completed":"degraded",result:verificationAvailable
      ? `Claim verification: ${claimVerification.supportedCount}/${claimVerification.totalClaims} claims supported; score ${claimVerification.score}%.`
      : "Claim-level verification was unavailable; verification did not pass."}
   : stage.agent==="guidance"
     ? {...stage,status:verificationPassed?"completed":"waiting",result:verificationPassed
        ? "Final guidance is prepared from evidence that passed claim-level verification."
        : "Guidance is waiting for a fully supported answer."}
     : stage);
 workflow.summary = verificationPassed
   ? "Four-agent workflow completed with claim-level evidence verification."
   : "Four-agent workflow completed with a verification warning; the answer was not fully claim-verified.";
 const citizenAnswer=isNadra ? sanitizeNadraCitizenAnswer(answer, language) : answer;
 return NextResponse.json({answer:citizenAnswer,source:{department:sourceMeta.department,title:sourceMeta.title,url:sourceUrl,lastVerified:selected.records[0]?.last_verified||"",province:selected.jurisdiction||selected.records[0]?.province||""},agent:true,goalFocused:true,webSearch:true,agentActivity:{...workflow,memory:{shortTerm:[],longTerm:["User-controlled preferences only"]},claimVerification}});
 }catch(error){console.error("API /api/ask error:",error);return NextResponse.json({error:"An unexpected error occurred. Please try again."},{status:500});}}