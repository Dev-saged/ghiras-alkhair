# قاعدة مجموعة `audit` (مطلوبة لمزامنة سجل التدقيق)

بدونها يعمل التطبيق كالمعتاد لكن يبقى سجل كل جهاز محلياً (الرفع يُرفض 403 فيُعاد بعد 30 دقيقة).
أضف داخل `match /orgs/{org}` بجانب قواعد المجموعات الأخرى، واستبدل `isAdmin()` و`isWriter()` بدوال الأدوار الموجودة عندك (admin / officer / accountant للكتابة):

```
match /audit/{id} {
  allow read: if isAdmin();
  allow create: if isWriter()
    && request.resource.data.d is string && request.resource.data.d.size() < 20000
    && request.resource.data.h is string;
  allow update, delete: if false;   // سجل لا يُعدَّل
}
```

- الوثيقة `{d: JSON الصف, h: HLC, ts}`؛ المعرّف = HLC فيمنع التكرار.
- `meta/pulse` يزداد عدّاد `audit` عند كل رفع (القاعدة الحالية لـpulse تكفي).
