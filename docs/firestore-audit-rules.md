# قاعدة مجموعة `audit`

القواعد الكاملة المحدّثة (مبنية على المنشورة فعلاً + كتلة audit) في `backend/firestore.rules`؛ انسخها كاملة إلى Firebase Console ← Firestore ← Rules ← Publish.
الـWorker (`backend/ghiras-worker.js`) لا يحتاج أي تعديل لسجل التدقيق: الرفع والسحب يمران مباشرة بين التطبيق وFirestore بتوكن المستخدم.

- الوثيقة `orgs/{o}/audit/{HLC}` = `{d: JSON الصف, h: HLC, ts}`؛ الإنشاء لكل `writer` (admin/officer/accountant)، القراءة للمدير فقط، لا حذف ولا تعديل (يُسمح فقط بإعادة رفع الصف نفسه).
- اختبر في Rules Playground: create كمسؤول حالات ✓، read كمسؤول حالات ✗، read كمدير ✓، update بتغيير d ✗.
- لم تُجرَّب على Firebase Emulator (غير متوفر في بيئة التطوير)؛ جرّبها في Playground قبل الاعتماد.
