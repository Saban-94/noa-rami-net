export type ToolKind = "read" | "write" | "ui";

export type ToolDef = {
  id: string;
  title: string;
  method: "GET" | "POST";
  kind: ToolKind;
  endpoint: string;
  summary: string;
  params: { name: string; hint: string; sample: string }[];
};

export const TOOLS: ToolDef[] = [
  {
    id: "find_customer",
    title: "זיהוי לקוח",
    method: "POST",
    kind: "read",
    endpoint: "find_customer",
    summary: "חובה ראשונה בכל הודעה. מחזיר פרופיל, הרשאה ו-toneRules.",
    params: [
      { name: "phone", hint: "972…", sample: "972508861080" },
      { name: "message", hint: "טקסט ההודעה", sample: "שלום" },
    ],
  },
  {
    id: "harel_inquiry_link",
    title: "קישור בירור הראל",
    method: "POST",
    kind: "write",
    endpoint: "harel_inquiry_link",
    summary: "מפיק קישור חתום לדף Invest להעלאת תעודה.",
    params: [{ name: "noteNumber", hint: "מספר תעודה", sample: "6710123" }],
  },
  {
    id: "harel_inquiry_upload_notify",
    title: "התראת העלאה",
    method: "POST",
    kind: "write",
    endpoint: "harel_inquiry_upload_notify",
    summary: "עדכון אחרי העלאה: Drive, גיליון, תצוגה לראמי והראל.",
    params: [
      { name: "noteNumber", hint: "מספר תעודה", sample: "152290" },
      { name: "fileUrl", hint: "קישור Drive", sample: "https://drive.google.com/file/d/demo/view" },
    ],
  },
  {
    id: "vered_delivery_audit",
    title: "בקרת תעודות ורד",
    method: "POST",
    kind: "read",
    endpoint: "vered_delivery_audit",
    summary: "הצלבה מול גליה, פקדונות 1:1 (60060 / 60002), חתימות נהג.",
    params: [{ name: "status", hint: "ממתין_לאישור או הכל", sample: "ממתין_לאישור" }],
  },
  {
    id: "lookup_catalog",
    title: "מילון לוגיסטי",
    method: "POST",
    kind: "read",
    endpoint: "lookup_catalog",
    summary: "מק״טים, משקלים, סלנג ותמונות.",
    params: [{ name: "q", hint: "חיפוש", sample: "מלט" }],
  },
  {
    id: "send_product_buttons",
    title: "כרטיס מוצר",
    method: "POST",
    kind: "ui",
    endpoint: "send_product_buttons",
    summary: "כרטיס מוצר בוואטסאפ עם כפתורי פעולה.",
    params: [{ name: "sku", hint: "מק״ט", sample: "10012" }],
  },
  {
    id: "inject_order",
    title: "הזרקת הזמנה",
    method: "POST",
    kind: "write",
    endpoint: "inject_order",
    summary: "לגיליון הזמנות — רק אחרי אישור מפורש של הלקוח.",
    params: [
      { name: "customerName", hint: "שם", sample: "יוסי כהן" },
      { name: "itemsText", hint: "פריטים", sample: "20 שקי מלט" },
    ],
  },
  {
    id: "get_delivery_note",
    title: "עותק תעודה",
    method: "GET",
    kind: "read",
    endpoint: "get_delivery_note",
    summary: "איתור תעודה חתומה לפי מספר וטלפון.",
    params: [{ name: "noteNumber", hint: "מספר", sample: "152299" }],
  },
  {
    id: "get_inquiries_stats",
    title: "סטטיסטיקת בירורים",
    method: "GET",
    kind: "read",
    endpoint: "get_inquiries_stats",
    summary: "כמות בירורים פתוחים להנהלה.",
    params: [],
  },
  {
    id: "get_media",
    title: "נכסי מדיה",
    method: "GET",
    kind: "read",
    endpoint: "get_media",
    summary: "קישורי תמונות רשמיות: invest, welcome, סניפים.",
    params: [{ name: "key", hint: "מפתח נכס", sample: "WELCOME_CARD_INVEST" }],
  },
  {
    id: "schedule_meeting",
    title: "תיאום פגישה",
    method: "POST",
    kind: "write",
    endpoint: "schedule_meeting",
    summary: "יומן Google — סניף התלמיד 6, הוד השרון.",
    params: [
      { name: "subject", hint: "נושא", sample: "הצעת מחיר שלד" },
      { name: "when", hint: "מועד", sample: "יום ג׳ 10:00" },
    ],
  },
  {
    id: "ui_skills",
    title: "UI Skills",
    method: "POST",
    kind: "ui",
    endpoint: "ui_skills",
    summary: "welcome_buttons, welcome_reply_buttons, product_actions, site_buttons, send_media_image.",
    params: [{ name: "skill", hint: "שם הרכיב", sample: "welcome_reply_buttons" }],
  },
];

export const WRITE_IDS = new Set([
  "inject_order",
  "schedule_meeting",
  "harel_inquiry_upload_notify",
]);

export const MEDIA: Record<string, { label: string; url: string }> = {
  WELCOME_CARD_INVEST: {
    label: "לקוח חדש",
    url: "https://raw.githubusercontent.com/Saban-94/noa-invest/main/public/images/invest.jpg",
  },
  WELCOME_CARD: {
    label: "לקוח חוזר",
    url: "https://raw.githubusercontent.com/Saban-94/noa-invest/main/public/images/welcom.jpeg",
  },
  WELCOME_CARD_VERED: {
    label: "ורד",
    url: "https://raw.githubusercontent.com/Saban-94/noa-invest/main/public/images/rami-noa.jpeg",
  },
  BRANCH_HATALMID: {
    label: "התלמיד 6",
    url: "https://raw.githubusercontent.com/Saban-94/noa-invest/main/public/images/talmed.jpg",
  },
  SUCCESS_ORDER: {
    label: "הזמנה נקלטת",
    url: "https://raw.githubusercontent.com/Saban-94/noa-invest/main/public/images/Designer.png",
  },
};
