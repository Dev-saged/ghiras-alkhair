# repo-map

Keep under 5KB. No code. Update by 2 lines after every change.

## Files
- `index.html` — كل التطبيق (~7140 سطر، CSS+JS مضمّن): PWA كفالة أيتام، RTL، IndexedDB، مزامنة Firestore REST.
- `sw.js` — service worker (تخزين الصفحة+خطوط Google، يتجاهل raw.githubusercontent.com).
- `version.json` — `{version,url,notes,date}` لإشعار التحديث.
- `README.md` — عرض فقط، لا منطق.
- صور العرض (`banner.svg hero.jpg gallery.jpg stats.svg card-*.svg sec-*.svg`) — لـREADME فقط.
- `.claude/skills/design-system|firebase-rules` — مراجع تصميم/Firestore.
- `.claude/session-handoff.md` — حالة آخر جلسة.

## Sections (SECTION markers)
فواصل موجودة بصيغة `/* ══ N العنوان ══ */` بالعربية. المعتمَد: نص العنوان لا الرقم (ترقيم JS فيه فجوات ١٢/٢١/٤٣ وتكرار ١٣/٤١ من تعديلات سابقة، غير مُصلَح).

CSS(29-953): رموز30·أساس94·خلفية حيّة116·شعار وافتتاحية119·هيكل135·مكوّنات197·لوحة إعلان353·سحب وتحديث377·حركة396·إعدادات وفحص410·بوابة ونماذج421·حسابات ونسخ495·أيتام538·مالية ومستندات690·لوحة وتقارير781·سحابة وبوابة868·تسجيل وفحص مدير893

JS(تقريباً — انزاحت الأسطر ~69 بعد إضافة قسم ٤٥): ثوابت1126·أدوات1152·إشارات1188·حالة1209·مسارات1237·هيكل وتنقل1264·واجهات1349·تفاعلات1469·تحديثات1606·PWA1639·عمال1669·تشفير وتطبيع1697·ساعة منطقية1776·مخطط وترحيل1790·أدوار وصلاحيات1863·مستودع1927·بوابة وجلسة2800(DONOR_SCHEMA+openDonorEdit هنا أيضاً)·حسابات ونسخ وبوابة شخصية2955·نموذج يتيم3251·Excel/CSV3366·ضغط وصور3488·منطق أيتام3563·مكوّنات يتيم3734·شاشات أيتام3781·متابعات وحسابات أيتام4162·مالية: ثوابت وعملات4188·منطق مالية ومساعدات4247·مستندات PDF ورسم4375·واجهات مستندات وكفالة4637·مساعدات ومتبرعون4940·تحليلات: لقطة وتقارير5206·استعلام ذكي5319·رسوم وتصدير5384·شاشة تقارير5510·لوحة: رئيسية حيّة5691·سحابة: Firestore REST ومزامنة5745·سحابة: واجهات وحسابات وبوابة يتيم6159·تسجيل: مفتاح عام وبوابة عامة6363·تسجيل: رموز وطلبات فريق6545·٤٥ محرك نماذج schema(FieldKinds/entityForm)~6716·موظفون ومشاريع ومصروفات~6773(STAFF/PROJECT/expenseSchema هنا)·(تكرار١٣)إقلاع~7140·(تكرار٤١)اختبار ذاتي #/test~7166

## Key functions and IDs
- `APP_VERSION`1127 `CLOUD_PRESET`1129 `APP`1134(=CONFIG: brand/repo/keys) `ROUTES`1238(=وحدات/nav) `SCHEMA`1793(IndexedDB v1-v3) `DB_VERSION`1836 `DATA_MIGRATIONS`1839(فارغة) `ROLE_CAPS`1867
- `signal/effect/batch/computed`1190-1207 — إشارات تفاعلية مكتوبة يدوياً
- `repo`(يبدأ `openIDB`1841)، صلاحيات `capSet/can/need/isSelf`1929-1948
- سحابة Firestore REST + تشفير + تسجيل: أقسام 39-42 (5745-6690)
- `#/test`7096 — اختبار ذاتي مخفي للمدير، لا يمسّ البيانات
- IDs أساسية: `#gate #splash #shell #rail-nav #topbar #page-title #theme-btn #sync-chip #net-chip #me-btn #update-banner #main #outlet #dock #more-sheet #me-sheet #dyn-sheet #scrim #toasts`
- أدوار: admin/officer/accountant/viewer/orphan
- وحدات ROUTES.id: dashboard,orphans,sponsorships,aid,registration,requests,donors,reports,staff,projects,expenses,followups,accounts,settings,backup

## Decisions
- ملف واحد بلا بناء؛ CSP صارم `script-src 'self' 'unsafe-inline'`.
- لا مكتبة UI خارجية؛ إشارات تفاعلية يدوية بدل reactive library.
- IndexedDB: `SCHEMA[]` تراكمي (تُضاف دالة جديدة، لا تُعدَّل القديمة) + `DATA_MIGRATIONS` لترحيل السجلات.
- مزامنة Firestore REST مباشر (لا SDK) عبر Cloudflare Worker للتوقيع.
- صلاحيات 3 طبقات: route guard، `capSet` بالعميل، قواعد Firestore (خارج هذا الملف).
- نماذج الإضافة/التعديل لـ staff/projects/expenses/donors أصبحت schema-driven عبر `entityForm`+`FieldKinds` (قسم ٤٥)؛ القوائم والتفصيل والتقارير وaid/followups بقيت كما هي (غير CRUD بسيط، لم تُحوَّل).

## Solved bugs (never reintroduce)
- (لا سجل Git لإصلاحات سابقة بعد)

## Open issues
- ترقيم أقسام JS فيه فجوات (١٢،٢١،٤٣) وتكرار (١٣،٤١) — للعلم فقط.
