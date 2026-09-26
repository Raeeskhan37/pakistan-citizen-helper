import { NextRequest, NextResponse } from "next/server";

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
    ["Punjab",["punjab","پنجاب"]],["Sindh",["sindh","سندھ"]],["Khyber Pakhtunkhwa",["khyber pakhtunkhwa","kpk","خیبر پختونخوا"]],
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
 const cats=drivingCategories(question);
 const has=(name:string)=>cats.indexOf(name)>=0;
 const en:Record<string,string>={
  Punjab:`## Punjab — Driving Licence
**Official authority:** Punjab DLIMS 2.0.

**For the requested service:** ${has("learner")?"Learner licence information is requested.":has("renewal")?"Renewal information is requested.":has("duplicate")?"Duplicate/replacement information is requested.":has("international")?"International driving licence information is requested.":"General driving licence information is requested."}

The official DLIMS provides learner, regular and international driving licence services. The online workflow includes account/login, application form, PSID generation and payment, followed by applicable processing/approval steps.

**Licence categories:** motorcycle, car/jeep, LTV, HTV and PSV.

For exact documents or fees, only the current official DLIMS evidence should be used for the selected service/category.

**Source:** https://dlims.punjab.gov.pk/
**Fee structure:** https://dlims.punjab.gov.pk/fee_structure`,
  Sindh:`## Sindh — Driving Licence
**Official authority:** Sindh Police — Driving License Sindh (DLS).

**Requested service:** ${has("learner")?"Learner licence":has("renewal")?"Renewal":has("duplicate")?"Duplicate/replacement":has("international")?"International driving licence":"General driving licence"}.

The official computerized process includes:
1. DLS online application/registration.
2. Appearance at the DLS front desk.
3. Screening and registration.
4. Medical examination.
5. Fee payment.
6. Written/oral computer test.
7. Road test where applicable.
8. Final licence receipt.

The official source identifies a valid original CNIC, physical fitness and minimum age 18 for the general process. Categories include motorcycle, motor car, LTV and HTV.

**Sources:** https://dls.gos.pk/ and https://dls.gos.pk/pro-comp-lic.html`,
  "Khyber Pakhtunkhwa":`## Khyber Pakhtunkhwa — Driving Licence
**Official authorities:** KP Transport Department, KPITB and relevant licensing authorities.

The original working agent identifies the **Dastak App** as the primary digital route for KP transport/driving-licence services. The documented system covers learner, LTV, HTV and international driving licences.

The digital workflow may include applicant profile, CNIC/NADRA verification, required documents/attachments, officer verification/approval, payment and licence processing. KP Police Police Sahulat Markaz also provides specific driving services including learner permit, traffic learner certificate and duplicate driving licence.

**Requested category/service:** ${cats.join(", ")}.

Exact documents, fees and steps should only be stated when supported by current official evidence.

**Sources:**
https://transport.kp.gov.pk/public-service.php
https://apipsm.kppolice.gov.pk/psm/VideoTutorial`,
  Balochistan:`## Balochistan — Driving Licence
**Official authority:** Balochistan Police / Police Mobile Khidmat Markaz.

The official service covers learner driving licence, renewal, international driving licence, duplicate licence and endorsement.

**Learner licence evidence:**
- Original CNIC and one copy.
- Traffic rules/code book.
- Medical certificate for applicants aged 50 or above.
- Published learner age: 18 years for motorcycle/motor car and 21 years for LTV.
- Learner licence validity: six months.

These learner requirements should not be presented as the complete regular-licence procedure.

**Source:** https://pkm.balochistanpolice.gov.pk/public/home/services`,
  "Islamabad Capital Territory":`## Islamabad Capital Territory — Driving Licence
**Official authority:** Islamabad Traffic Police (ITP).

The official ITP-DLIMS provides:
- New driving licence
- Learner permit
- Driving tests
- Renewal
- Duplicate licence
- International driving permit

For ${has("learner")?"learner permit":has("renewal")?"renewal":has("duplicate")?"duplicate licence":has("international")?"international driving permit":"general driving licence"} questions, the exact documents, fees and processing time should only be stated when supported by current official ITP evidence.

**Official portal:** https://dlims.islamabadpolice.gov.pk/`,
  "Azad Jammu and Kashmir":`## Azad Jammu and Kashmir — Driving Licence
The official Traffic Police AJ&K portal provides licence procedure, verification, application tracking, office locations, DLMS forms, medical form, fee challan, licence fee details, theory book and traffic signs.

Use the official procedure/form for the selected licence category.

**Source:** https://trafficpolice.ajk.gov.pk/`,
  "Gilgit-Baltistan":`## Gilgit-Baltistan — Driving Licence
The official DLMIS provides regular licence application, renewal, duplicate licence, international driving licence, medical form and licensing-centre information. The regular application covers categories including motorcycle, motor car, LTV, HTV and other listed vehicle classes.

**Source:** https://dlmis.gbp.gov.pk/`
 };
 const ur:Record<string,string>={
  Punjab:`## پنجاب — ڈرائیونگ لائسنس
سرکاری DLIMS 2.0 میں لرنر، ریگولر اور انٹرنیشنل ڈرائیونگ لائسنس کی سہولیات موجود ہیں۔ کیٹیگریز میں موٹر سائیکل، کار/جیپ، LTV، HTV اور PSV شامل ہیں۔
لرنر، تجدید، ڈپلیکیٹ یا انٹرنیشنل لائسنس کے لیے درست موجودہ فیس اور دستاویزات سرکاری DLIMS کی متعلقہ معلومات کے مطابق ہی بتائی جانی چاہئیں۔
ماخذ: https://dlims.punjab.gov.pk/
فیس اسٹرکچر: https://dlims.punjab.gov.pk/fee_structure`,
  Sindh:`## سندھ — ڈرائیونگ لائسنس
سرکاری DLS کے مطابق عمل میں آن لائن رجسٹریشن، فرنٹ ڈیسک، اسکریننگ/رجسٹریشن، میڈیکل، فیس، تحریری/کمپیوٹر ٹیسٹ، جہاں لاگو ہو روڈ ٹیسٹ اور لائسنس کی وصولی شامل ہے۔
عمومی عمل کے لیے اصل CNIC، جسمانی فٹنس اور کم از کم عمر 18 سال درج ہے۔ کیٹیگریز میں موٹر سائیکل، موٹر کار، LTV اور HTV شامل ہیں۔
ماخذ: https://dls.gos.pk/`,
  "Khyber Pakhtunkhwa":`## خیبر پختونخوا — ڈرائیونگ لائسنس
سرکاری معلومات کے مطابق Dastak App KP ٹرانسپورٹ/ڈرائیونگ لائسنس خدمات کا اہم ڈیجیٹل ذریعہ ہے۔ سسٹم میں لرنر، LTV، HTV اور انٹرنیشنل ڈرائیونگ لائسنس شامل ہیں۔ Police Sahulat Markaz مخصوص ڈرائیونگ خدمات بھی فراہم کرتا ہے، جن میں لرنر پرمٹ اور ڈپلیکیٹ لائسنس شامل ہیں۔
ماخذ: https://transport.kp.gov.pk/public-service.php`,
  Balochistan:`## بلوچستان — ڈرائیونگ لائسنس
Police Mobile Khidmat Markaz لرنر، تجدید، انٹرنیشنل، ڈپلیکیٹ اور اینڈورسمنٹ خدمات فراہم کرتا ہے۔ لرنر کے لیے اصل CNIC اور ایک کاپی، ٹریفک رولز/کوڈ بک، اور 50 سال یا اس سے زیادہ عمر میں میڈیکل سرٹیفکیٹ درج ہے۔
ماخذ: https://pkm.balochistanpolice.gov.pk/public/home/services`,
  "Islamabad Capital Territory":`## اسلام آباد — ڈرائیونگ لائسنس
اسلام آباد ٹریفک پولیس کا ITP-DLIMS نیا لائسنس، لرنر پرمٹ، ڈرائیونگ ٹیسٹ، تجدید، ڈپلیکیٹ اور انٹرنیشنل ڈرائیونگ پرمٹ کی سہولیات فراہم کرتا ہے۔
ماخذ: https://dlims.islamabadpolice.gov.pk/`,
  "Azad Jammu and Kashmir":`## آزاد جموں و کشمیر — ڈرائیونگ لائسنس
سرکاری Traffic Police AJ&K پورٹل پر لائسنس طریقہ کار، تصدیق، ٹریکنگ، دفاتر، فارم، میڈیکل فارم، فیس چالان اور ٹریفک علامات کی معلومات موجود ہیں۔
ماخذ: https://trafficpolice.ajk.gov.pk/`,
  "Gilgit-Baltistan":`## گلگت بلتستان — ڈرائیونگ لائسنس
سرکاری DLMIS پر ریگولر لائسنس، تجدید، ڈپلیکیٹ، انٹرنیشنل لائسنس، میڈیکل فارم اور لائسنسنگ مراکز کی معلومات موجود ہیں۔
ماخذ: https://dlmis.gbp.gov.pk/`
 };
 return (language==="Urdu"?ur:en)[jurisdiction]||en.Punjab;
}


function armsLicenceEvidence(question:string,jurisdiction:WorkingJurisdiction|null,language:"English"|"Urdu"):{answer:string,sources:string[]}{
 const q=normalize(question);
 const en:Record<string,string>={
  "Islamabad Capital Territory":`## Islamabad Capital Territory — Arms Licence

The ICT Administration states that a new application requires a completed application, 3 passport-size photographs, 3 attested CNIC copies, 3 attested NTN copies, proof of residence in Islamabad, and a departmental NOC for government servants. The applicant must appear in person with original documents. The published procedure is to complete the application, submit it at the Citizen Facilitation Center, receive a token, and collect the licence on the date given on the receipt.

**Official source:** https://ictadministration.gov.pk/new-arms-license/`,
  "Sindh":`## Sindh — Arms Licence

The Sindh Home Department states that for a new arms licence, an applicant visits the Home Department with the original CNIC and a copy, submits the application and receives a token. The process then includes photograph/biodata capture, police verification and payment through a bank challan. The FAQ lists Sindh domicile and age 25 among the basic criteria.

**Official source:** https://home.sindh.gov.pk/faqs`,
  "Khyber Pakhtunkhwa":`## Khyber Pakhtunkhwa — Arms Licence

The KP Right to Public Services Commission describes issuance through the Arms License Branch, including biometric/electronic processing and police verification, followed by the applicable approval and fee/dealer steps. The official page lists age 21 or above and distinguishes Provincial and All-Pakistan licence routes.

**Official source:** https://www.kprts.gov.pk/services/issuance-of-arms-license/`,
  "Balochistan":`## Balochistan — Arms Licence

The Government of Balochistan Home Department identifies arms licensing as a provincial service and publishes the Balochistan Arms Act 2022 and current arms-licence renewal notices.

For a current application or renewal, only the applicable provincial Home Department procedure should be stated when supported by official evidence.

**Official sources:** https://home.balochistan.gov.pk/ and https://balochistan.gov.pk/departments-acts/`,
  "Azad Jammu and Kashmir":`## Azad Jammu and Kashmir — Arms Licence

The official AJK E-Facilitation Center lists Arms License as a service for acquiring an arms licence in AJK. It identifies the AJK Interior Department as the issuance authority and lists a computerized certificate issuance fee of Rs. 1,500; the service page also lists an application form and fitness certificate.

**Official source:** https://efc.ajk.gov.pk/instructionservice/3`,
  "Punjab":`## Punjab — Arms Licence

Punjab government district portals identify Arms Licensing Branches and list services including new-arm-licence issuance, revalidation/renewal, duplicate copies, transfer, correction, verification and cancellation. Punjab e-Khidmat Markaz also provides renewal of Federal Arms Licenses issued by the Federal Government.

For a new Punjab licence, the exact current district procedure should be confirmed from the relevant official Punjab Arms Licensing Branch rather than inferred from another province.

**Official sources:** https://punjab.gov.pk/DGKhan_ALO and https://ekhidmat.punjab.gov.pk/services/e-khidmat-marakaz/federal-arms-license-fal`,
  "Gilgit-Baltistan":`## Gilgit-Baltistan — Arms Licence

A sufficiently detailed current GB Arms Licence procedure was not established from the retrieved official evidence. Verified information for the exact GB procedure could not be established without inventing requirements.`
 };
 const ur:Record<string,string>={
  "Islamabad Capital Territory":`## اسلام آباد — اسلحہ لائسنس

اسلام آباد انتظامیہ کے سرکاری صفحے کے مطابق نئی درخواست کے لیے مکمل درخواست، 3 پاسپورٹ سائز تصاویر، CNIC کی 3 تصدیق شدہ نقول، NTN کی 3 تصدیق شدہ نقول، اسلام آباد میں رہائش کا ثبوت، اور سرکاری ملازمین کے لیے محکمانہ NOC درکار ہے۔ اصل دستاویزات کے ساتھ ذاتی حاضری ضروری ہے۔ طریقہ کار میں درخواست مکمل کرنا، Citizen Facilitation Center میں جمع کرانا، ٹوکن لینا اور رسید پر دی گئی تاریخ کو لائسنس وصول کرنا شامل ہے۔

**سرکاری ماخذ:** https://ictadministration.gov.pk/new-arms-license/`,
  "Sindh":`## سندھ — اسلحہ لائسنس

سندھ ہوم ڈیپارٹمنٹ کے مطابق نئی درخواست کے لیے اصل CNIC اور اس کی نقل کے ساتھ Home Department جانا، درخواست جمع کرانا اور ٹوکن لینا شامل ہے۔ اس کے بعد تصویر/بائیو ڈیٹا، پولیس تصدیق اور بینک چالان کے ذریعے فیس کا عمل ہوتا ہے۔ بنیادی معیار میں سندھ ڈومیسائل اور عمر 25 سال درج ہیں۔

**سرکاری ماخذ:** https://home.sindh.gov.pk/faqs`,
  "Khyber Pakhtunkhwa":`## خیبر پختونخوا — اسلحہ لائسنس

KP Right to Public Services Commission کے مطابق Arms License Branch میں بائیومیٹرک/الیکٹرانک پراسیسنگ اور پولیس تصدیق کے مراحل شامل ہیں، اس کے بعد متعلقہ منظوری اور فیس کے مراحل مکمل کیے جاتے ہیں۔ سرکاری صفحہ کم از کم عمر 21 سال بیان کرتا ہے اور Provincial اور All-Pakistan لائسنس روٹس الگ کرتا ہے۔

**سرکاری ماخذ:** https://www.kprts.gov.pk/services/issuance-of-arms-license/`,
  "Balochistan":`## بلوچستان — اسلحہ لائسنس

حکومت بلوچستان کا Home Department اسلحہ لائسنسنگ کو صوبائی سروس کے طور پر ظاہر کرتا ہے اور Balochistan Arms Act 2022 اور موجودہ renewal notices شائع کرتا ہے۔ موجودہ درخواست یا تجدید کے لیے صرف مصدقہ سرکاری طریقہ کار ہی بیان کیا جائے گا۔

**سرکاری ماخذ:** https://home.balochistan.gov.pk/`,
  "Azad Jammu and Kashmir":`## آزاد جموں و کشمیر — اسلحہ لائسنس

AJK E-Facilitation Center اسلحہ لائسنس کو سروس کے طور پر درج کرتا ہے اور Interior Department کو issuing authority بتاتا ہے۔ سروس صفحے پر computerized certificate issuance fee Rs. 1,500 اور application form اور fitness certificate درج ہیں۔

**سرکاری ماخذ:** https://efc.ajk.gov.pk/instructionservice/3`,
  "Punjab":`## پنجاب — اسلحہ لائسنس

پنجاب کے سرکاری ضلعی پورٹلز Arms Licensing Branches کو متعلقہ دفاتر کے طور پر ظاہر کرتے ہیں اور نئی لائسنس issuance، revalidation/renewal، duplicate، transfer، correction، verification اور cancellation جیسی خدمات درج کرتے ہیں۔ پنجاب e-Khidmat Markaz وفاقی حکومت کے جاری کردہ Federal Arms License کی renewal سروس بھی فراہم کرتا ہے۔

نئے پنجاب لائسنس کے لیے کسی دوسرے صوبے کے طریقہ کار کو پنجاب پر لاگو نہیں کیا جائے گا۔

**سرکاری ماخذ:** https://punjab.gov.pk/DGKhan_ALO`,
  "Gilgit-Baltistan":`## گلگت بلتستان — اسلحہ لائسنس

دستیاب سرکاری شواہد سے گلگت بلتستان کے مخصوص موجودہ Arms Licence طریقہ کار کی مکمل تصدیق نہیں ہو سکی۔ غیر مصدقہ دستاویزات یا فیس شامل نہیں کی جائیں گی۔`
 };
 if(!jurisdiction) return {answer:language==="Urdu"?"## اسلحہ لائسنس\n\nپاکستان میں اسلحہ لائسنس کا طریقہ کار صوبے/علاقے کے مطابق مختلف ہے۔ براہ کرم صوبہ یا علاقہ بتائیں تاکہ متعلقہ سرکاری طریقہ کار دیا جا سکے۔":"## Arms Licence\n\nArms-licensing procedure is jurisdiction-specific in Pakistan. Please specify the province or territory so the applicable official procedure can be provided without mixing provincial rules.",sources:[]};
 const answer=(language==="Urdu"?ur:en)[jurisdiction]||en.Punjab;
 const sources:Record<string,string[]>={
  "Islamabad Capital Territory":["https://ictadministration.gov.pk/new-arms-license/"],
  "Sindh":["https://home.sindh.gov.pk/faqs"],
  "Khyber Pakhtunkhwa":["https://www.kprts.gov.pk/services/issuance-of-arms-license/"],
  "Balochistan":["https://home.balochistan.gov.pk/","https://balochistan.gov.pk/departments-acts/"],
  "Azad Jammu and Kashmir":["https://efc.ajk.gov.pk/instructionservice/3"],
  "Punjab":["https://punjab.gov.pk/DGKhan_ALO","https://ekhidmat.punjab.gov.pk/services/e-khidmat-marakaz/federal-arms-license-fal"],
  "Gilgit-Baltistan":["https://gilgitbaltistan.gov.pk/"]
 };
 return {answer,sources:sources[jurisdiction]||[]};
}

function exciseEvidence(question:string,jurisdiction:string,language:"English"|"Urdu"):string{
 const q=normalize(question);
 const isToken=q.includes("token")||q.includes("motor vehicle tax")||q.includes("vehicle tax")||q.includes("ٹوکن");
 const isRegistration=q.includes("new registration")||q.includes("vehicle registration")||q.includes("register a vehicle")||q.includes("رجسٹریشن")||q.includes("نئی گاڑی");
 const isTransfer=q.includes("transfer")||q.includes("ownership")||q.includes("ملکیت")||q.includes("منتقلی");
 const isPayment=q.includes("pay")||q.includes("payment")||q.includes("online payment")||q.includes("ادائیگی");
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
 const isMutation=q.includes("mutation")||q.includes("intiqal")||q.includes("انتقال");
 const isRegistry=q.includes("registry")||q.includes("رجسٹری")||q.includes("property registration")||q.includes("register property");
 const isOwnership=q.includes("ownership")||q.includes("owner")||q.includes("ملکیت");
 const isSDC=q.includes("service delivery centre")||q.includes("service delivery center")||q.includes("sdc")||q.includes("ایس ڈی سی")||q.includes("سروس ڈیلیوری سنٹر")||q.includes("سروس ڈیلیوری سینٹر");
 const hasLandTopic=isFard||isMutation||isRegistry||isOwnership||isSDC||q.includes("land")||q.includes("property")||q.includes("revenue")||q.includes("زمین")||q.includes("جائیداد")||q.includes("ریونیو")||q.includes("رجسٹری")||q.includes("انتقال")||q.includes("لینڈ ریکارڈ");
 if(language==="Urdu"){
  if(isPunjab){
   if(isMutation)return "## پنجاب — انتقال (Mutation / Intiqal)\n\nPLRA کے مطابق انتقال زمین کی ملکیت میں تبدیلی کو سرکاری لینڈ ریکارڈ میں درج کرنے کا عمل ہے۔ متعلقہ Arazi Record Centre (ARC) پر CNIC کی بایومیٹرک تصدیق کے بعد ٹوکن لیا جاتا ہے، مطلوبہ دستاویزات اور جائیداد کی تفصیلات جمع کی جاتی ہیں، مقررہ فیس/ٹیکس ادا کیے جاتے ہیں، اور متعلقہ Revenue Officer کے سامنے بیان/تصدیق کے بعد انتقال منظور کیا جاتا ہے۔\n\n**سرکاری ذرائع:**\nhttps://www.punjab-zameen.gov.pk/mutationsInfo\nhttps://www.punjab-zameen.gov.pk/entryMutationsInfo";
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
 if(isPunjab&& (q.includes("peef")||q.includes("punjab educational endowment"))){
  return "## Punjab — PEEF Scholarship\n\nThe Punjab Higher Education Department states that the Punjab Educational Endowment Fund (PEEF) provides scholarships/financial assistance to talented and needy students. Its published scholarship levels include secondary, intermediate, graduation, master's and PhD.\n\n**Official source:** https://hed.punjab.gov.pk/peef";
 }
 if(isPunjab&& (q.includes("honhaar")||q.includes("honhar"))){
  return "## Punjab — Honhaar Scholarship\n\nThe Punjab Higher Education Department describes the Honhaar Scholarship Program as support for deserving students enrolled in public-sector universities, graduate colleges and medical colleges. The program is intended to expand access to higher education and currently covers 68 disciplines. The department's published information also states that 30,000 scholarships are planned annually.\n\nFor the latest eligibility and application details, use the official program information and portal.\n\n**Official source:** https://hed.punjab.gov.pk/node/1674\n**Official portal:** https://honhaarscholarship.punjabhec.gov.pk/";
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

 return NextResponse.json({answer:cleanAnswer(answer),source,agent:true,goalFocused:true,webSearch:false});
}

function vaccinationWorkVisaResponse(language:"English"|"Urdu"){
 const answer=language==="Urdu"
  ? `## سعودی ورک ویزا — ویکسینیشن

دستیاب سرکاری شواہد یہ ثابت نہیں کرتے کہ ہر پاکستانی کے لیے عام سعودی employment visa پر ایک مخصوص ویکسین لازمی ہے۔

حج یا عمرہ کی ویکسینیشن شرائط کو عام employment visa پر لاگو نہیں کیا جانا چاہیے۔

موجودہ medical اور health-screening requirements متعلقہ سعودی اور پاکستانی سرکاری حکام سے verify کی جائیں۔`
  : `## Ordinary Saudi Work Visa — Vaccination

The available official evidence does not establish that every Pakistani travelling on an ordinary Saudi employment visa must receive a specific vaccine.

Do not transfer Hajj or Umrah vaccination requirements to ordinary employment visas.

Current medical and health-screening requirements should be checked against current Saudi and Pakistani official requirements.`;

 return NextResponse.json({answer:cleanAnswer(answer),source:{department:"Vaccination for Travelling Abroad",title:"Government of Pakistan / BEOE — Work Visa Vaccination Policy",url:"https://beoe.gov.pk/files/policyguideliness/51.pdf"},agent:true,goalFocused:true,webSearch:false});
}

export async function POST(request:NextRequest){try{
 if(!SUPABASE_URL||!SUPABASE_ANON_KEY||!GROQ_API_KEY)return NextResponse.json({error:"Server configuration is incomplete. Check the Vercel environment variables."},{status:500});
 const body=await request.json();const question=String(body.question??"").trim();const requested=canonicalDepartment(String(body.service??"").trim());const langInput=String(body.language??"").trim();if(!question)return NextResponse.json({error:"Please enter a question."},{status:400});const language:"English"|"Urdu"=langInput.toLowerCase()==="urdu"||isUrdu(question)?"Urdu":"English";
 const url=`${SUPABASE_URL}/rest/v1/verified_information?select=id,service_name,category,title,content,service_name_urdu,province,title_urdu,content_urdu,official_department,official_source_title,official_source_url,last_verified,active&active=eq.true&order=last_verified.desc`;const db=await fetch(url,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${SUPABASE_ANON_KEY}`},cache:"no-store"});if(!db.ok){console.error(await db.text());return NextResponse.json({error:"Unable to retrieve verified information from Supabase."},{status:500});}
 const all=(await db.json()) as VerifiedRecord[];const selected=selectRecords(question,requested,all);
 const workingJurisdiction=workingDetectJurisdiction(question);
 const workingTargetJurisdiction=workingDetectTargetJurisdiction(question);
 if(workingTargetJurisdiction){selected.jurisdiction=workingTargetJurisdiction;}
 else if(workingJurisdiction && !selected.jurisdiction){selected.jurisdiction=workingJurisdiction;}
 const civilTargetJurisdiction=workingTargetJurisdiction||workingJurisdiction||detectTargetJurisdiction(question);

 // EARLY VACCINATION ROUTE: import the proven Streamlit Hajj/Umrah/work-visa handling without changing frozen departments.
 if(requested==="Vaccination for Travelling Abroad"){
  if(isVaccinationPilgrimQuestion(question)){
   return vaccinationPilgrimResponse(question,language);
  }
  if(isSaudiVaccinationWorkVisaQuestion(question)){
   return vaccinationWorkVisaResponse(language);
  }
 }

 // EARLY DOMICILE ROUTE: use verified provincial evidence for domicile questions.
 if(requested==="Domicile" && (workingTargetJurisdiction||workingJurisdiction)==="Punjab"){
  const answer=language==="Urdu"
   ?"پنجاب میں ڈومیسائل کے لیے CNIC/Form-B، والد/شوہر کا CNIC، پیدائش یا اسکول سرٹیفکیٹ، بینک رسید، 2 تصاویر، اور جائیداد کی دستاویز یا یوٹیلیٹی بل درکار ہو سکتے ہیں۔ درخواست e-Khidmat Markaz یا متعلقہ Domicile Branch/Assistant Commissioner دفتر کے ذریعے دی جا سکتی ہے۔ پنجاب حکومت کے مطابق Domicile Management کے لیے سہولت مراکز اور آن لائن طریقہ موجود ہے۔"
   :"For a Punjab domicile certificate, official Punjab government information lists these documents: CNIC/Form-B, father’s or husband’s NIC, birth certificate or school certificate, bank receipt, two photographs, and property documents or a utility bill. Applications can be submitted through the Domicile Branch/facilitation center, and Punjab also provides an online Domicile Management option. The Punjab government describes a process in which the application/documents are checked, the domicile is processed by the concerned office, and the certificate is issued after approval.";
  return NextResponse.json({answer:cleanAnswer(answer),source:{department:"Domicile",title:"Punjab Government — Domicile Certificate",url:"https://hed.punjab.gov.pk/student-affairs",lastVerified:"",province:"Punjab"},agent:true,goalFocused:true});
 }
 // EARLY BALOCHISTAN DOMICILE ROUTE: use only directly verified Balochistan government evidence.
 if(requested==="Domicile" && (workingTargetJurisdiction||workingJurisdiction)==="Balochistan"){
  const answer=language==="Urdu"
   ?"## بلوچستان — ڈومیسائل سرٹیفکیٹ\n\nسرکاری بلوچستان حکومت کی موجودہ معلومات کے مطابق صوبے میں **Computerized Local Domicile Management System (CLDMS)** قائم کرنے کا منصوبہ منظور شدہ ترقیاتی منصوبوں میں شامل ہے۔ سرکاری Science & Information Technology Department کے ریکارڈ میں یہ منصوبہ Balochistan کے لیے درج ہے۔\n\nسرکاری طور پر دستیاب موجودہ صفحات میں مکمل آن لائن درخواست کے مراحل، دستاویزات، فیس اور موجودہ درخواست پورٹل کی تفصیل واضح طور پر شائع نہیں کی گئی۔ اس لیے میں غیرمصدقہ دستاویزات، فیس یا مراحل شامل نہیں کر رہا۔\n\nمتعلقہ ضلعی دفتر سے رابطے کے لیے سرکاری Board of Revenue Balochistan اپنے تمام Deputy Commissioners کے ضلعی رابطہ نمبرز بھی شائع کرتا ہے۔\n\n**سرکاری ذرائع:**\n- Balochistan Science & Information Technology Department — CLDMS: https://sit.balochistan.gov.pk/ongoing-schemes/\n- Board of Revenue Balochistan — Deputy Commissioner Directory: https://bor.balochistan.gov.pk/phone-directory/"
   :"## Balochistan — Domicile Certificate\n\nCurrent official Government of Balochistan information confirms that a **Computerized Local Domicile Management System (CLDMS)** is an approved provincial development project. The official Science & Information Technology Department lists the CLDMS specifically for Balochistan.\n\nThe current official pages I could verify do not clearly publish the complete online application steps, document checklist, fees, or a current application portal. I am therefore not adding unverified requirements, fees, or procedures.\n\nFor district-level contact, the official Board of Revenue Balochistan publishes contact numbers for all Deputy Commissioners.\n\n**Official sources:**\n- Balochistan Science & Information Technology Department — CLDMS: https://sit.balochistan.gov.pk/ongoing-schemes/\n- Board of Revenue Balochistan — Deputy Commissioner Directory: https://bor.balochistan.gov.pk/phone-directory/";
  return NextResponse.json({answer:cleanAnswer(answer),source:{department:"Domicile",title:"Government of Balochistan — Local Domicile Management System",url:"https://sit.balochistan.gov.pk/ongoing-schemes/",lastVerified:"",province:"Balochistan"},agent:true,goalFocused:true,webSearch:false});
 }

// EARLY ICT DOMICILE ROUTE: use directly verified ICT Administration evidence.
 if(requested==="Domicile" && (workingTargetJurisdiction||workingJurisdiction)==="Islamabad Capital Territory"){
  const answer=language==="Urdu"
   ?"## اسلام آباد — ڈومیسائل سرٹیفکیٹ\n\nICT Administration کے سرکاری صفحے کے مطابق ڈومیسائل سرٹیفکیٹ کے لیے **Citizen Facilitation Center, G-11/4, Islamabad** میں درخواست جمع کی جاتی ہے۔ طریقہ کار یہ ہے:\n1. عمر کے مطابق مطلوبہ دستاویزات مکمل کریں۔\n2. Citizen Facilitation Center, G-11/4 جائیں اور درخواست اور دستاویزات جمع کریں۔\n3. ٹوکن حاصل کریں اور اپنی باری کا انتظار کریں۔\n4. ڈیٹا انٹری کے بعد ضروری فیس ادا کریں اور e-receipt حاصل کریں۔\n5. ڈومیسائل درخواست پر کارروائی کی جاتی ہے۔\n6. e-receipt پر دی گئی تاریخ کو ڈومیسائل سرٹیفکیٹ وصول کریں۔\n\n**21 سال یا اس سے زیادہ عمر کے درخواست گزار کے لیے سرکاری فہرست:** درخواست گزار کے CNIC کی کاپی (CNIC کم از کم 1 سال پرانا)، والد/شوہر کے CNIC کی کاپی، اسلام آباد میں رہائش کا ثبوت (Allotment Letter یا Lease Agreement)، اصل Utility Bill (بجلی یا گیس)، اور اگر بچے ہوں تو Form-B کی کاپی۔ اگر کسی دوسرے ضلع کا ڈومیسائل منسوخ کیا گیا ہو تو اس کی بھی کم از کم 1 سال پرانی دستاویز درکار ہے۔ درخواست گزار کو اصل دستاویزات کے ساتھ خود حاضر ہونا ہے۔\n\nاگر CNIC پر دوہرا پتہ ہو تو متعلقہ دوسرے ضلع سے NOC درکار ہے۔\n\n**فیس:** سرکاری صفحہ ضروری فیس ادا کرنے کا ذکر کرتا ہے، لیکن اس صفحے کے معلوماتی خانے میں مخصوص رقم درج نہیں کرتا؛ اس لیے میں رقم فرض نہیں کر رہا۔\n\n**پروسیسنگ ٹائم:** 7 دن۔\n**مقام:** Citizen Facilitation Center, G-11/4, Islamabad۔\n**اوقات:** پیر تا جمعہ 09:00 AM–06:00 PM؛ جمعہ وقفہ 12:30 PM–02:30 PM۔\n**رابطہ:** 051-8899611۔\n\n**سرکاری ماخذ:** https://ictadministration.gov.pk/domicile-certificate/"
   :"## Islamabad Capital Territory — Domicile Certificate\n\nAccording to the official ICT Administration domicile page, applications are submitted at the **Citizen Facilitation Center, G-11/4, Islamabad**. The official process is:\n1. Complete the required documents according to the applicant's age.\n2. Visit the Citizen Facilitation Center, G-11/4 and submit the application with the documents.\n3. Get a token and wait for your turn.\n4. Complete data entry and pay the necessary fee to receive an e-receipt.\n5. ICT Administration processes the domicile application.\n6. Collect the Domicile Certificate on the date stated on the e-receipt.\n\n**For applicants aged 21 or above, the official document list includes:** a copy of the applicant's CNIC (the CNIC must be 1 year old), a copy of the father/husband's CNIC, proof of residence in Islamabad (Allotment Letter or Lease Agreement), one original utility bill (electricity or gas), and a copy of Form-B if the applicant has children. If a domicile from another district has been cancelled, the official page states that the cancellation document should also be 1 year old. The applicant must appear in person with the original documents.\n\nIf the CNIC has dual addresses, an NOC from the other district is required.\n\n**Fee:** The official page says the necessary fee is paid and an e-receipt is issued, but it does not state a specific amount in the information box. I am therefore not inventing a fee amount.\n\n**Processing time:** 7 days.\n**Location:** Citizen Facilitation Center, G-11/4, Islamabad.\n**Hours:** Monday–Friday, 09:00 AM–06:00 PM; Friday break 12:30 PM–02:30 PM.\n**Contact:** 051-8899611.\n\n**Official source:** https://ictadministration.gov.pk/domicile-certificate/";
  return NextResponse.json({answer:cleanAnswer(answer),source:{department:"Domicile",title:"ICT Administration — Domicile Certificate",url:"https://ictadministration.gov.pk/domicile-certificate/",lastVerified:"",province:"Islamabad Capital Territory"},agent:true,goalFocused:true,webSearch:false});
 }

// EARLY SINDH DOMICILE ROUTE: use only directly verified Sindh government evidence.
 if(requested==="Domicile" && (workingTargetJurisdiction||workingJurisdiction)==="Sindh"){
  const answer=language==="Urdu"
   ?"## سندھ — ڈومیسائل سرٹیفکیٹ\n\nسرکاری سندھ حکومت کی معلومات کے مطابق ڈومیسائل اور PRC کے لیے **Domicile & PRC Automation** نظام موجود ہے۔ ضلعی انتظامیہ کے سرکاری پورٹل پر ڈپٹی کمشنر آفس کے تحت **Domicile Branch** بھی درج ہے۔ اس لیے درخواست کے لیے اپنے متعلقہ ضلع کے ڈپٹی کمشنر آفس کی Domicile Branch سے رجوع کیا جا سکتا ہے۔\n\nسرکاری طور پر دستیاب صفحات میں مکمل موجودہ دستاویزات، فیس اور مرحلہ وار درخواست فارم کی تفصیل واضح طور پر فراہم نہیں کی گئی؛ اس لیے میں غیرمصدقہ دستاویزات یا فیس شامل نہیں کر رہا۔\n\n**سرکاری ذرائع:**\n- Sindh Government — Domicile & PRC Automation: https://istd.sindh.gov.pk/initiatives/621\n- District Administration Malir — Domicile Branch, Deputy Commissioner Office: https://dcmalir.sindh.gov.pk/\n- Sindh Home Department — Appeals for Domicile & PRC: https://home.sindh.gov.pk/judicial-i"
   :"## Sindh — Domicile Certificate\n\nOfficial Sindh government information confirms that a **Domicile & PRC Automation** system exists. An official district-administration portal also identifies a **Domicile Branch** under the Deputy Commissioner Office. Therefore, for a Sindh domicile application, the practical official route is to approach the Domicile Branch of the Deputy Commissioner Office of the relevant district.\n\nThe official pages I could verify do not clearly publish a complete current checklist of documents, fees, and step-by-step application form procedure. I am therefore not adding unverified requirements or fees.\n\n**Official sources:**\n- Sindh Government — Domicile & PRC Automation: https://istd.sindh.gov.pk/initiatives/621\n- District Administration Malir — Domicile Branch, Deputy Commissioner Office: https://dcmalir.sindh.gov.pk/\n- Sindh Home Department — Appeals for Domicile & PRC: https://home.sindh.gov.pk/judicial-i";
  return NextResponse.json({answer:cleanAnswer(answer),source:{department:"Domicile",title:"Government of Sindh — Domicile & PRC",url:"https://istd.sindh.gov.pk/initiatives/621",lastVerified:"",province:"Sindh"},agent:true,goalFocused:true,webSearch:false});
 }
 // EARLY LAND & REVENUE ROUTE: keep Fard/Mutation/Registry/SDC queries out of generic AI routing.
 if(requested==="Land & Revenue"){
  const lj=workingTargetJurisdiction||workingJurisdiction||workingDetectTargetJurisdiction(question);
  const answer=landRevenueEvidence(question,lj,language);
  return NextResponse.json({answer:cleanAnswer(answer),source:{department:"Land & Revenue",title:"Official land and revenue source",url:"",lastVerified:"",province:lj||""},agent:true,goalFocused:true,webSearch:false});
 }
 const detectedQuestionService=detectService(question,"");
 if(detectedQuestionService && !belongsToDepartment(detectedQuestionService,requested)){
 const qn=normalize(question);
 const directDepartmentMatch=(requested==="FBR / Taxation"&&(qn.includes("fbr")||qn.includes("ntn")||qn.includes("iris")||qn.includes("income tax")||qn.includes("tax return")||qn.includes("sales tax")||qn.includes("sales-tax")||qn.includes("gst")||qn.includes("tax registration")||qn.includes("taxpayer registration")||qn.includes("withholding tax")||qn.includes("income tax return")))||(requested==="Government Jobs"&&(qn.includes("government job")||qn.includes("government jobs")||qn.includes("national jobs portal")||qn.includes("njp")||qn.includes("vacancy")||qn.includes("job")||qn.includes("apply for a job")||qn.includes("job application")||qn.includes("نوکری")||qn.includes("ملازمت")||qn.includes("درخواست")))||(requested==="Excise & Taxation"&&(qn.includes("excise")||qn.includes("vehicle")||qn.includes("token tax")||qn.includes("vehicle registration")||qn.includes("ownership transfer")))||(requested==="Land & Revenue"&&(qn.includes("land")||qn.includes("fard")||qn.includes("mutation")||qn.includes("intiqal")||qn.includes("revenue")))||(requested==="Police Services"&&(qn.includes("police")||qn.includes("fir")||qn.includes("character certificate")||qn.includes("police clearance")||qn.includes("verification")))||(requested==="Education & Scholarships"&&(qn.includes("scholarship")||qn.includes("hec")||qn.includes("education")))||(requested==="Driving Licence"&&(qn.includes("driving")||qn.includes("learner")||qn.includes("license")||qn.includes("licence")||qn.includes("ڈرائیونگ")||qn.includes("لائسنس")))||(requested==="Vaccination for Travelling Abroad"&&(qn.includes("vaccination")||qn.includes("vaccine")||qn.includes("polio")||qn.includes("yellow fever")||qn.includes("hajj")||qn.includes("haj")||qn.includes("umrah")||qn.includes("umra")||qn.includes("ویکسین")||qn.includes("حج")||qn.includes("عمرہ")))||(requested==="Arms Licence"&&(qn.includes("arms licence")||qn.includes("arms license")||qn.includes("weapon licence")||qn.includes("weapon license")||qn.includes("gun licence")||qn.includes("gun license")||qn.includes("اسلحہ")||qn.includes("ہتھیار")||qn.includes("لائسنس")));
 if(!directDepartmentMatch)return NextResponse.json({answer:language==="Urdu"?"یہ سوال منتخب شعبے سے متعلق نہیں لگتا۔ براہ کرم اسی شعبے سے متعلق سوال پوچھیں۔":"This question does not appear to belong to the selected government department. Please ask a question related to the selected department.",source:null});
}
if(requested==="Education & Scholarships"){
 const ej=workingTargetJurisdiction||workingJurisdiction||workingDetectTargetJurisdiction(question);
 const answer=educationEvidence(question,ej,language);
 return NextResponse.json({answer:cleanAnswer(answer),source:{department:"Education & Scholarships",title:"Official education/scholarship source",url:"",lastVerified:"",province:ej||""},agent:true,goalFocused:true,webSearch:false});
}
const isNadra=requested==="NADRA Services";
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
 "Government Jobs":["njp.gov.pk","kp.gov.pk"],
 "Arms Licence":["gov.pk","punjab.gov.pk","sindh.gov.pk","kp.gov.pk","balochistan.gov.pk","ajk.gov.pk","gilgitbaltistan.gov.pk"]
};
const allowedHints=jurisdictionSourceHints[requested]||[];const alternateOfficialUrls:string[]=[];
if(requested==="Passport Services"){
 alternateOfficialUrls.push("https://www.dgip.gov.pk/passport/ordinary-passport.php","https://www.dgip.gov.pk/passport/process.php","https://www.dgip.gov.pk/eServices/online-passport.php");
}
if(requested==="Government Jobs"){alternateOfficialUrls.push("https://www.njp.gov.pk/index.php/jobs","https://www.njp.gov.pk/index.php/jobs/live","https://www.njp.gov.pk/index.php/jobs/search");}
if(requested==="Domicile"&&selected.jurisdiction==="Punjab"){alternateOfficialUrls.push("https://punjab.gov.pk/node/6239");}
// EARLY PROTECTOR ROUTE: use directly verified BE&OE evidence and do not invent fees or OEP steps.
if(requested==="Protector & Overseas Employment"){
 const fq=normalize(question);
 const isTourist=/tourist|visit visa|visitor visa|holiday|سیاحت|وزٹ/.test(fq);
 const isOep=/oep|overseas employment promoter|promoter|recruitment agency|through an agent|ایجنٹ|او ای پی/.test(fq);
 const isFee=/fee|fees|cost|charges|فیس|چارج/.test(fq);
 const isOffice=/office|offices|location|where|دفتر|کہاں|مقام/.test(fq);
 const isDocs=/document|documents|requirements|papers|دستاویز|کاغذات/.test(fq);
 const isDirect=/direct employment|direct-employment|direct visa|براہ راست/.test(fq);
 const requestedJurisdiction=workingTargetJurisdiction||workingJurisdiction||workingDetectTargetJurisdiction(question);
 const policySource="https://beoe.gov.pk/files/policyguideliness/58.pdf";
 const procedureSource="https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf";
 let answer="";
 if(isTourist){
  answer=language==="Urdu"
   ?"## پروٹیکٹر کلیئرنس\n\nعام سیاحتی یا وزٹ ویزا کے لیے اوورسیز ایمپلائمنٹ والا پروٹیکٹر رجسٹریشن طریقہ لاگو نہیں ہوتا۔ BE&OE کی یہ سروس بیرون ملک ملازمت/ایمیگریشن سے متعلق ہے۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/"
   :"## Protector of Emigrants\n\nThe BE&OE Protector registration process is for overseas employment/emigration cases. It is not an employment-clearance requirement for an ordinary tourist or visit visa.\n\n**Official source:** https://beoe.gov.pk/";
 } else if(isOffice){
  if(requestedJurisdiction==="Islamabad Capital Territory"){
   answer=language==="Urdu"
    ?"## پروٹیکٹر آف ایمیگرنٹس دفتر\n\nسرکاری BE&OE دائرۂ اختیار کی جدول کے مطابق **اسلام آباد**، Protector of Emigrants, **Rawalpindi** کے دائرۂ اختیار میں ہے۔ سرکاری رابطہ گائیڈ میں Rawalpindi دفتر کا پتہ **20-B1, Summer Plaza, Chandni Chowk, Rawalpindi** اور فون نمبرز **+92-51-9290439-40** اور **+92-51-9290569** درج ہیں۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf"
    :"## Protector of Emigrants Office — Islamabad\n\nThe official BE&OE jurisdiction table places **Islamabad** under the **Protector of Emigrants, Rawalpindi**. The official contact guide lists the Rawalpindi office at **20-B1, Summer Plaza, Chandni Chowk, Rawalpindi**, telephone **+92-51-9290439-40** and **+92-51-9290569**.\n\n**Official sources:** https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf";
  } else if(requestedJurisdiction==="Khyber Pakhtunkhwa"){
   answer=language==="Urdu"
    ?"## خیبر پختونخوا — پروٹیکٹر دفاتر\n\nسرکاری BE&OE رابطہ گائیڈ میں خیبر پختونخوا کے لیے **Peshawar** اور **Malakand** کے Protector of Emigrants دفاتر درج ہیں۔ متعلقہ دفتر درخواست گزار کے علاقے کے دائرۂ اختیار پر منحصر ہے۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/files/a-guide-for-pakistani-migrant-workers-in-the-united-arab-emirates.pdf"
    :"## Khyber Pakhtunkhwa — Protector Offices\n\nThe official BE&OE contact guide lists **Peshawar** and **Malakand** Protector of Emigrants offices for Khyber Pakhtunkhwa. The applicable office depends on the applicant's area of jurisdiction.\n\n**Official source:** https://beoe.gov.pk/files/a-guide-for-pakistani-migrant-workers-in-the-united-arab-emirates.pdf";
  } else {
   answer=language==="Urdu"
    ?"## پروٹیکٹر آف ایمیگرنٹس دفتر\n\nBE&OE دائرۂ اختیار کے مطابق Protector of Emigrants کے دفاتر کے ذریعے رجسٹریشن ہوتی ہے۔ متعلقہ دفتر اپنے علاقے کے مطابق منتخب کیا جاتا ہے۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf"
    :"## Protector of Emigrants Office\n\nBE&OE handles registration through Protector of Emigrants offices according to area jurisdiction. The applicable office should be selected according to the applicant's area.\n\n**Official source:** https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf";
  }
 } else if(isFee){
  answer=language==="Urdu"
   ?"## پروٹیکٹر فیس\n\nسرکاری Emigration Rules کے مطابق **Direct Employment** کے لیے Protector registration fee **Rs. 2,500 فی شخص** ہے اور **Welfare Fund** کے لیے **Rs. 4,000 فی شخص** ہے۔ اس کے علاوہ State Life insurance اور، جہاں لاگو ہو، OEP service charges/دیگر متعلقہ اخراجات الگ ہو سکتے ہیں۔\n\nاس لیے ایک ہی مجموعی رقم ہر کیس کے لیے فرض نہیں کی جانی چاہیے۔ ادائیگی سے پہلے اپنے کیس کے مطابق موجودہ BE&OE/Protector office instructions سے باقی قابلِ اطلاق charges کی تصدیق کریں۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/files/legal-framework/Emigration_Rules_1979_Updated_2023.pdf"
   :"## Protector Fees\n\nAccording to the official Emigration Rules, the **Direct Employment** Protector registration fee is **Rs. 2,500 per emigrant**, and the **Welfare Fund** contribution is **Rs. 4,000 per emigrant**. State Life insurance and, where applicable, OEP service charges/other case-specific costs are separate.\n\nTherefore, the app should not present one universal total for every case. Confirm any remaining applicable charges with the current BE&OE/Protector office instructions before payment.\n\n**Official source:** https://beoe.gov.pk/files/legal-framework/Emigration_Rules_1979_Updated_2023.pdf";
 } else if(isOep){
  answer=language==="Urdu"
   ?"## OEP کے ذریعے پروٹیکٹر رجسٹریشن\n\nاگر ملازمت **Overseas Employment Promoter (OEP)** کے ذریعے حاصل ہوئی ہے تو BE&OE کی سرکاری ہدایات کے مطابق رجسٹریشن میں درج ذیل شامل ہیں:\n- درست ویزا\n- درست پاسپورٹ\n- درست CNIC\n- آجر کا دستخط شدہ Employment Contract/Agreement یا منظور شدہ Undertaking\n- Registration Fee کی رسید\n- Welfare Fund کی رسید\n- Emigration Promotion Fee\n- OEP کے ذریعے بھرتی کی صورت میں Service Charges\n- State Life Insurance کا سرٹیفکیٹ\n- متعلقہ صورت میں NOC، Police Character Verification اور Medical Fitness Report\n\nBE&OE کی ہدایات کے مطابق متعلقہ OEP/Protector office کے ذریعے رجسٹریشن مکمل کی جاتی ہے اور غیر ضروری دستاویزات طلب نہیں کی جانی چاہئیں۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/files/policyguideliness/58.pdf"
   :"## Protector Registration Through an OEP\n\nIf the job was obtained through an **Overseas Employment Promoter (OEP)**, official BE&OE instructions state that registration includes:\n- valid visa\n- valid passport\n- valid CNIC\n- employer-signed employment contract/agreement or an approved undertaking\n- registration-fee receipt\n- welfare-fund receipt\n- emigration promotion fee\n- OEP service charges where recruitment is through an OEP\n- State Life insurance certificate\n- where applicable, NOC, police character verification and medical fitness report\n\nBE&OE instructs Protector offices not to demand unnecessary documents.\n\n**Official source:** https://beoe.gov.pk/files/policyguideliness/58.pdf";
 } else if(isDocs || isDirect){
  if(isDirect && !isDocs){
   answer=language==="Urdu"
    ?"## ای-پروٹیکٹر — براہ راست ملازمت\n\nBE&OE کی سرکاری ویب سائٹ پر **Apply Online for e-Protector** سہولت موجود ہے۔ براہ راست ملازمت کے لیے:\n1. BE&OE کی ویب سائٹ کھولیں اور **Apply Online for e-Protector** منتخب کریں۔\n2. آن لائن direct-emigrant registration فارم میں اپنی ملازمت اور ذاتی معلومات درج کریں اور مطلوبہ دستاویزات/تفصیلات فراہم کریں۔\n3. آن لائن رجسٹریشن مکمل کرکے حاصل ہونے والی confirmation/registration information محفوظ کریں۔\n4. سرکاری ہدایات کے مطابق متعلقہ Protector office کے اگلے verification/registration steps مکمل کریں۔\n\nبنیادی دستاویزات میں درست ویزا، پاسپورٹ، CNIC، employer-signed employment contract/agreement یا approved undertaking، registration fee، Welfare Fund اور State Life insurance شامل ہیں۔ مخصوص ممالک/حالات میں NOC، Police Character Verification اور Medical Fitness Report بھی درکار ہو سکتے ہیں۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/\nhttps://beoe.gov.pk/files/legal-framework/Emigration_Rules_1979_Updated_2023.pdf"
    :"## e-Protector — Direct Employment\n\nBE&OE's official website provides an **Apply Online for e-Protector** facility. For direct employment:\n1. Open the BE&OE website and select **Apply Online for e-Protector**.\n2. Complete the online direct-emigrant registration form with the required employment and personal information and provide the requested details/documents.\n3. Complete the online registration and save the confirmation/registration information issued by the system.\n4. Follow the official instructions for the applicable verification/registration steps with the relevant Protector office.\n\nCore requirements include a valid visa, passport, CNIC, employer-signed employment contract/agreement or approved undertaking, registration fee, Welfare Fund and State Life insurance. For specified countries/circumstances, an NOC, Police Character Verification Certificate or Medical Fitness Report may also be required.\n\n**Official sources:** https://beoe.gov.pk/\nhttps://beoe.gov.pk/files/legal-framework/Emigration_Rules_1979_Updated_2023.pdf";
  } else {
   answer=language==="Urdu"
    ?"## براہ راست اوورسیز ملازمت — پروٹیکٹر رجسٹریشن\n\nBE&OE کی سرکاری ہدایات کے مطابق بنیادی دستاویزات میں درست ویزا، درست پاسپورٹ، درست CNIC، آجر کا دستخط شدہ Employment Contract/Agreement یا منظور شدہ Undertaking، Registration Fee کی رسید، Welfare Fund کی رسید، Emigration Promotion Fee، State Life Insurance Certificate شامل ہیں۔ مخصوص ممالک/حالات میں Police Character Verification، Medical Fitness Report اور متعلقہ NOC بھی درکار ہو سکتے ہیں۔\n\nبراہ راست ملازمت کے ویزا رکھنے والے فرد کی رجسٹریشن Protector of Emigrants کرتا ہے؛ سرکاری طریقہ کار کے مطابق کاغذات مکمل ہونے کی صورت میں رجسٹریشن اسی دن کی جا سکتی ہے۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf\nhttps://beoe.gov.pk/files/policyguideliness/58.pdf"
    :"## Direct Overseas Employment — Protector Registration\n\nAccording to official BE&OE instructions, the core documents include a valid visa, valid passport, valid CNIC, an employer-signed employment contract/agreement or approved undertaking, registration-fee receipt, welfare-fund receipt, emigration promotion fee, and State Life Insurance Certificate. For specified countries/circumstances, a Police Character Verification Certificate, Medical Fitness Report, and relevant NOC may also be required.\n\nA holder of a direct employment visa is registered by the Protector of Emigrants; the official procedure states that registration is done the same day when the papers are in order.\n\n**Official sources:**\n- https://beoe.gov.pk/files/legal-framework/procedure-for-overseas-employment.pdf\n- https://beoe.gov.pk/files/policyguideliness/58.pdf";
  }
 } else {
  answer=language==="Urdu"
   ?"## پروٹیکٹر آف ایمیگرنٹس\n\nبیرون ملک ملازمت کے لیے Protector registration درکار ہے۔ BE&OE کے مطابق رجسٹریشن کے لیے درست ویزا، پاسپورٹ، CNIC، ملازمت کا معاہدہ/منظور شدہ undertaking، فیس اور Welfare Fund کی رسید، Emigration Promotion Fee، انشورنس اور کیس کے مطابق دیگر دستاویزات درکار ہو سکتی ہیں۔\n\n**سرکاری ماخذ:** https://beoe.gov.pk/"
   :"## Protector of Emigrants\n\nFor overseas employment, Protector registration is required. BE&OE identifies the visa, passport, CNIC, employment contract/approved undertaking, registration and welfare-fund receipts, emigration promotion fee, insurance, and case-specific documents as part of the registration requirements.\n\n**Official source:** https://beoe.gov.pk/";
 }
 return NextResponse.json({answer:cleanAnswer(answer),source:{department:"Protector & Overseas Employment",title:"Bureau of Emigration & Overseas Employment — Emigrant Protection",url:"https://beoe.gov.pk/",lastVerified:"",province:requestedJurisdiction||""},agent:true,goalFocused:true,webSearch:false});
}

if(requested==="Arms Licence"){
 const aj=workingTargetJurisdiction||workingJurisdiction||workingDetectTargetJurisdiction(question);
 const result=armsLicenceEvidence(question,aj,language);
 return NextResponse.json({answer:cleanAnswer(result.answer),source:{department:"Arms Licence",title:"Official government arms-licensing information",url:result.sources[0]||"",lastVerified:"",province:aj||""},sources:result.sources,agent:true,goalFocused:true,webSearch:false,jurisdiction:aj||""});
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


if(requested==="Excise & Taxation"){
 const ej=workingTargetJurisdiction||workingJurisdiction||workingDetectTargetJurisdiction(question);
 if(ej){
  const answer=exciseEvidence(question,ej,language);
  return NextResponse.json({answer:cleanAnswer(answer),source:{department:"Excise & Taxation",title:"Official Excise & Taxation source",url:"",lastVerified:"",province:ej},agent:true,goalFocused:true,webSearch:false});
 }
 return NextResponse.json({answer:language==="Urdu"?"## ایکسائز اینڈ ٹیکسیشن\n\nبراہ کرم صوبہ/علاقہ اور مطلوبہ گاڑی کی سروس بتائیں، مثلاً پنجاب میں ٹوکن ٹیکس، نئی رجسٹریشن یا ملکیت کی منتقلی۔":"## Excise & Taxation\n\nPlease specify the province/territory and vehicle service, for example Punjab token tax, new vehicle registration, or ownership transfer.",source:null,agent:true,goalFocused:true,webSearch:false});
}
const officialUrls=isNadra?[]:Array.from(new Set([sourceUrl,...alternateOfficialUrls].filter(Boolean)));
let officialText="";
for(const u of officialUrls){const t=await fetchOfficialPage(u);if(t)officialText+=("\n\nOFFICIAL SOURCE PAGE: "+u+"\n"+t);}
const domains=isNadra?[]:(departmentDomains[canonicalDepartment(requested)]||[]);
const skipSearch=false;
if(domains.length && !skipSearch){
 const searchText=await fetchOfficialSearch(question,domains);
 if(searchText)officialText+=searchText;
}
officialText=officialText.slice(0,10000);
const isVaccination=requested==="Vaccination for Travelling Abroad"; const dbContext=isNadra?"Supabase records intentionally excluded for NADRA answers; use NADRA POLICY RAG EVIDENCE only.":isVaccination?"Supabase records intentionally excluded for vaccination answers; use verified official health/travel sources only.":(selected.records.length?context(selected.records,language):"No matching verified database record was found.");
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
 if(!ai.ok){const providerStatus=ai.status;const providerBody=(await ai.text()).slice(0,500);console.error("Groq request failed",providerStatus,providerBody);return NextResponse.json({error:`AI provider request failed (HTTP ${providerStatus}).`,errorType:"ai_service_error",providerStatus},{status:502});}const data=await ai.json();let answer=cleanAnswer(data?.choices?.[0]?.message?.content||"")||noInfo(language);
 const referralOnly=/(search|look for|find|check|use the search|visit (the|this) (website|portal)|go to (the|this) (website|portal)|website.*to find|portal.*to find|تلاش کریں|ویب سائٹ.*تلاش|پورٹل.*تلاش)/i.test(answer);
 const evidenceAvailable=selected.records.length>0||officialText.length>200||ragEvidence.length>200;
 if(referralOnly&&evidenceAvailable){
   const retryMessages=[...messages,{role:"assistant",content:answer},{role:"user",content:"Rewrite your previous answer. It improperly referred the citizen to search a website. Answer the citizen directly using the supplied verified database and official government evidence. Do not instruct the citizen to search, look for, find, check, or visit a portal to obtain the answer. Give the actual verified information. The official URL is only a source citation."}];
   const retry=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${GROQ_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify(makeAiBody("openai/gpt-oss-120b",retryMessages))});
   if(retry.ok){const rd=await retry.json();answer=cleanAnswer(rd?.choices?.[0]?.message?.content||"")||answer;}
 }
 return NextResponse.json({answer,source:{department:sourceMeta.department,title:sourceMeta.title,url:sourceUrl,lastVerified:selected.records[0]?.last_verified||"",province:selected.jurisdiction||selected.records[0]?.province||""},agent:true,goalFocused:true,webSearch:true});
 }catch(error){console.error("API /api/ask error:",error);return NextResponse.json({error:"An unexpected error occurred. Please try again."},{status:500});}}
