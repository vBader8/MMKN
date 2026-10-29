/*
  إعدادات المزامنة السحابية (اختيارية)
  ---------------------------------------
  لتفعيل تسجيل الدخول عبر Google ومزامنة التقدم بين الأجهزة:
  1) أنشئ مشروعاً مجانياً على https://console.firebase.google.com
  2) فعّل Authentication ← Sign-in method ← Google
  3) فعّل Firestore Database (وضع الإنتاج) والصق قواعد الأمان الموجودة في ملف firestore.rules
  4) من Project settings ← Your apps ← Web app انسخ القيم إلى الكائن أدناه
  5) في Authentication ← Settings ← Authorized domains أضف نطاق موقعك (مثل your-site.vercel.app)
  إذا بقيت القيم فارغة يعمل الموقع بالكامل محلياً (يحفظ التقدم في المتصفح)، مع إمكانية النقل عبر "رمز المزامنة".
*/
window.IFCE_CONFIG = {
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    appId: ""
  },
  telegram: "B1Ver",
  author: "بدر خالد"
};
