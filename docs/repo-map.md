# repo-map

Keep under 5KB. No code. Update by 2 lines after every change.

## Files
- `index.html` — كل التطبيق (~7350 سطر، CSS+JS مضمّن): PWA كفالة أيتام، RTL، IndexedDB، مزامنة Firestore REST.
- `sw.js` service worker · `version.json` إشعار التحديث · `README.md`+صور (svg/jpg) للعرض فقط · `.claude/skills/*` مراجع · `.claude/session-handoff.md` حالة آخر جلسة.

## Sections (SECTION markers)
فواصل `/* ══ N العنوان ══ */` بالعربية؛ المعتمَد نص العنوان لا الرقم (ترقيم فيه فجوات/تكرار قديم غير مُصلَح؛ أسطر JS تقريبية).

CSS(29-953): رموز·أساس·خلفية حيّة·شعار وافتتاحية·هيكل·مكوّنات·لوحة إعلان·سحب وتحديث·حركة·إعدادات وفحص·بوابة ونماذج·حسابات ونسخ·أيتام·مالية ومستندات·لوحة وتقارير·سحابة وبوابة·تسجيل وفحص مدير

JS(~1124-7350): ثوابت1126·أدوات1152·إشارات1188·حالة1209·مسارات1237·هيكل وتنقل1264·واجهات1349·تفاعلات1469·تحديثات1606·PWA1639·عمال1669·تشفير وتطبيع1697·ساعة منطقية1776·مخطط وترحيل1790·أدوار وصلاحيات1863·مستودع1927·بوابة وجلسة2800(DONOR_SCHEMA)·حسابات ونسخ2955·نموذج يتيم3251·Excel/CSV3366(`Xlsx.read/write`,`readTable`,`importTemplate`)·ضغط وصور3488·منطق أيتام3563·مكوّنات يتيم3734·شاشات أيتام3781(`orphanImportView`)·متابعات4162·مالية4188·منطق مالية ومساعدات4247·PDF ورسم4375·واجهات مستندات وكفالة4637·مساعدات ومتبرعون4940·تحليلات5206·استعلام ذكي5319·رسوم وتصدير5384·تقارير5510·رئيسية5691·سحابة Firestore5745·سحابة واجهات6159·تسجيل6363·تسجيل رموز6545·٤٥ محرك schema~6716·٤٦ استيراد بالكود~6830·٤٧ محرك قوائم~6925·٤٨ محرك تفصيل~6985·موظفون/مشاريع/مصروفات~7000·(تكرار١٣)إقلاع~7280·(تكرار٤١)test~7300

## Key functions and IDs
- `APP`(=CONFIG) `ROUTES`(=وحدات/nav) `SCHEMA`(IndexedDB v1-v3) `DB_VERSION` `ROLE_CAPS`
- `repo`(`openIDB`)، صلاحيات `capSet/can/need/isSelf`
- `entityForm`+`FieldKinds`(قسم ٤٥) — نماذج staff/projects/expenses/donors
- `entityList`(قسم ٤٧): قائمة من schema (virtual/دفعات، embed داخل تبويب، `destroy()`) + `listOrEmpty` — الأيتام/المصروفات/شهر الكفالات/سجل المساعدات/المتابعات
- `entityDetail`(قسم ٤٨): صفحة سجل (hero+KPIs+أقسام+حذف عام؛ hooks: load/actions/kpis/sections/on) — `donorView/staffView/projectView`
- `codeImportDlg`(قسم ٤٦) — محرك استيراد Excel عام بالكود؛ يستخدمه `openAidImport`/`openSponsorImport` (يعيد استخدام `Finance.addAid`/`Finance.record` نفسها، فلا تحقّق مكرر)
- `#/test` — اختبار ذاتي مخفي للمدير
- IDs أساسية: `#gate #splash #shell #rail-nav #topbar #page-title #theme-btn #sync-chip #net-chip #me-btn #update-banner #main #outlet #dock #more-sheet #me-sheet #dyn-sheet #scrim #toasts`
- أدوار: admin/officer/accountant/viewer/orphan

## Decisions
- ملف واحد بلا بناء، CSP صارم. IndexedDB: `SCHEMA[]` تراكمي. Firestore REST عبر Worker. صلاحيات: route guard+`capSet`+قواعد Firestore.
- نماذج staff/projects/expenses/donors أصبحت schema-driven (قسم ٤٥)؛ القوائم/التفصيل/التقارير وaid/followups بقيت كما هي (غير CRUD بسيط).
- استيراد Excel دفعي بالكود (قسم ٤٦) للمساعدات والكفالات الشهرية، على نمط `orphanImportView` الموجود أصلاً: قالب+دليل أعمدة، معاينة جاهز/خطأ قبل الحفظ، استمرار على الصفوف الصحيحة، تقرير أخطاء قابل للتنزيل. الحفظ الفعلي عبر `Finance.addAid`/`Finance.record` نفسها (دفاع مزدوج، لا تكرار تحقق).

## Solved bugs (never reintroduce)
- (لا سجل Git لإصلاحات سابقة بعد)

## Open issues
- ترقيم أقسام JS فيه فجوات وتكرار (١٣،٤١) — للعلم فقط.
- تعميم schema (مراحل): ✅١ أيتام+مصروفات ✅٢ نسخ احتياطي+كفالات(شهر) ✅٣ تفصيل المتبرعين+سجل المساعدات ✅٤ تفصيل الموظفين/المشاريع+المتابعات. ⏳٥ حسابات+كفالات دفعي/FX ٦ تفصيل الأيتام ٧ التقارير
