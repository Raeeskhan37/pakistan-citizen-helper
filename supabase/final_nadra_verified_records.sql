-- Pakistan Citizen Helper
-- Final verified NADRA records for CNIC modification / age correction.
-- Run this file in Supabase SQL Editor.

UPDATE verified_information
SET
  category = 'CNIC Modification - Personal Information Correction',
  title = 'Correction of Personal Information on CNIC',
  content_en = 'NADRA provides CNIC Modification for correction or updating of personal information. For a date-of-birth/age issue, the request must be handled as an identity-record correction and is subject to NADRA verification and applicable rules. NADRA currently publishes a specific FAQ on its CNIC page for citizens who identify an incorrect date of birth. NADRA also publishes a separate age-modification fee schedule. Supporting evidence can depend on the circumstances, so applicants should follow NADRA instructions and provide the documents requested during verification. For a correction request, use NADRA CNIC Update / Modify service or visit a NADRA Registration Centre as directed by NADRA. Do not assume that a normal CNIC modification fee is the same as an age-modification fee.',
  content_ur = 'نادرا CNIC Modification کے ذریعے شناختی معلومات میں درستگی یا تبدیلی کی سہولت فراہم کرتا ہے۔ اگر CNIC پر عمر یا تاریخ پیدائش غلط درج ہو تو اسے شناختی ریکارڈ کی درستگی کے طور پر نادرا کی تصدیق اور متعلقہ قواعد کے مطابق نمٹایا جاتا ہے۔ نادرا اپنی CNIC ویب سائٹ پر غلط تاریخ پیدائش کے بارے میں ایک مخصوص FAQ بھی فراہم کرتا ہے۔ نادرا عمر میں تبدیلی کے لیے الگ فیس شیڈول بھی جاری کرتا ہے۔ مطلوبہ ثبوت اور دستاویزات کیس کی نوعیت کے مطابق مختلف ہو سکتے ہیں، اس لیے درخواست گزار نادرا کی ہدایات کے مطابق مطلوبہ دستاویزات فراہم کرے۔ درستگی کے لیے NADRA CNIC Update / Modify سروس استعمال کریں یا نادرا کی ہدایت کے مطابق NADRA Registration Centre جائیں۔ عام CNIC Modification فیس کو Age Modification فیس کے برابر نہ سمجھیں۔',
  province = 'Pakistan',
  official_department = 'National Database and Registration Authority (NADRA)',
  official_source_title = 'Computerised National Identity Card (CNIC) - NADRA',
  official_source_url = 'https://www.nadra.gov.pk/identityDocument/cnic',
  last_verified = '2026-09-16',
  active = true
WHERE service_name = 'CNIC / NADRA'
  AND title = 'Correction of Personal Information on CNIC';

INSERT INTO verified_information
(service_name, category, title, content_en, content_ur, province, official_department, official_source_title, official_source_url, last_verified, active)
SELECT
  'CNIC / NADRA',
  'CNIC Modification - Age / Date of Birth',
  'Age / Date of Birth Modification Fees',
  'NADRA currently lists the following processing fees for Age Modification in ID Cards for inland applicants: up to 1 year: Rs. 1,000; more than 1 year and up to 2 years: Rs. 2,000; more than 2 years and up to 3 years: Rs. 3,000; more than 3 years: Rs. 5,000; second time age change: Rs. 10,000. For applicants abroad, the published fees are USD 15, USD 25, USD 40, USD 65 and USD 125 respectively. These are age-modification fees and are separate from the ordinary CNIC Modification fee. NADRA''s current CNIC page also identifies an FAQ specifically addressing an incorrect date of birth on a CNIC. The exact supporting documents and verification requirements depend on the individual case; applicants should follow NADRA''s current instructions and the documents requested by NADRA. Source: NADRA Fee Structure and CNIC pages.',
  'نادرا شناختی کارڈ میں عمر کی تبدیلی کے لیے اندرونِ ملک موجودہ فیس یہ بتاتا ہے: ایک سال تک Rs. 1,000؛ ایک سال سے زیادہ اور دو سال تک Rs. 2,000؛ دو سال سے زیادہ اور تین سال تک Rs. 3,000؛ تین سال سے زیادہ Rs. 5,000؛ دوسری مرتبہ عمر کی تبدیلی Rs. 10,000۔ بیرونِ ملک درخواست گزاروں کے لیے متعلقہ فیس بالترتیب USD 15، USD 25، USD 40، USD 65 اور USD 125 ہے۔ یہ Age Modification فیس عام CNIC Modification فیس سے الگ ہے۔ نادرا کی موجودہ CNIC ویب سائٹ پر CNIC میں غلط تاریخ پیدائش کے بارے میں مخصوص FAQ بھی موجود ہے۔ مطلوبہ دستاویزات اور تصدیقی تقاضے کیس کے مطابق مختلف ہو سکتے ہیں؛ درخواست گزار نادرا کی موجودہ ہدایات اور نادرا کی طرف سے طلب کردہ دستاویزات پر عمل کریں۔',
  'Pakistan',
  'National Database and Registration Authority (NADRA)',
  'NADRA Fee Structure',
  'https://www.nadra.gov.pk/feeStructure',
  '2026-09-16',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM verified_information
  WHERE service_name = 'CNIC / NADRA'
    AND category = 'CNIC Modification - Age / Date of Birth'
    AND title = 'Age / Date of Birth Modification Fees'
);
