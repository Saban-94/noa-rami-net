import { MEDIA } from "./catalog";
import { parseWazeShare } from "./mobile-rules";

export type Role =
  | "harel"
  | "vered"
  | "rami"
  | "julie"
  | "morsi"
  | "shai"
  | "customer"
  | "new";

export type UiCard =
  | { type: "trip"; url: string; arrival: string; destination: string }
  | { type: "image"; src: string; caption: string }
  | { type: "buttons"; buttons: { id: string; title: string }[] }
  | { type: "product"; sku: string; name: string; note: string }
  | { type: "order"; title: string; lines: string[] };

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export type Trace = {
  id: string;
  tool: string;
  ms: number;
  ok: boolean;
  simulated: boolean;
  params: Record<string, string>;
  result: Json;
};

export type ChatTurn = {
  text: string;
  cards: UiCard[];
  traces: Trace[];
};

function strField(value: Json, key: string) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = value[key];
    return typeof v === "string" ? v : "";
  }
  return "";
}

function tAudit(value: Json) {
  const num = (key: string) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const v = value[key];
      return typeof v === "number" ? v : undefined;
    }
    return undefined;
  };
  return { totalChecked: num("totalChecked"), approvedCount: num("approvedCount"), pendingCount: num("pendingCount") };
}
const CEMENT = {
  sku: "10012",
  name: "מלט נשר 50 ק״ג",
  bagsPerPallet: 40,
};

export function detectRole(message: string, persona: string): Role {
  const m = message;
  if (/ורד/.test(m)) return "vered";
  if (/ג['׳]ולי|איפה הילדים/.test(m)) return "julie";
  if (/הראל/.test(m)) return "harel";
  if (/ראמי/.test(m) && !/אבו/.test(m)) return "rami";
  if (/מורסי|אבו ודיע/.test(m)) return "morsi";
  if (/שי ראובן|ליקוט/.test(m)) return "shai";
  if (persona === "harel") return "harel";
  if (persona === "vered") return "vered";
  if (persona === "rami") return "rami";
  if (persona === "julie") return "julie";
  if (persona === "morsi") return "morsi";
  if (persona === "shai") return "shai";
  if (persona === "new") return "new";
  if (persona === "yossi") return "customer";
  return "new";
}

export function isGreeting(message: string) {
  return /^(שלום|היי|הי|בוקר טוב|צהריים טובים|ערב טוב|אהלן|מה נשמע|סבן)/.test(message.trim());
}

function noteNumber(message: string) {
  const m = message.match(/\b(\d{5,8})\b/);
  return m?.[1] ?? "";
}

export function planReply(input: {
  message: string;
  persona: string;
  harelMode: "address" | "quiet";
  tool: (id: string, params: Record<string, string>) => Promise<Trace>;
}): Promise<ChatTurn> {
  return plan(input);
}

async function plan(input: {
  message: string;
  persona: string;
  harelMode: "address" | "quiet";
  tool: (id: string, params: Record<string, string>) => Promise<Trace>;
}): Promise<ChatTurn> {
  const traces: Trace[] = [];
  const phone =
    input.persona === "harel"
      ? "972505227724"
      : input.persona === "rami"
        ? "972508860896"
        : input.persona === "julie"
          ? "972508898001"
          : input.persona === "shai"
            ? "972503454566"
            : input.persona === "yossi"
              ? "972501112233"
              : "972508861080";

  traces.push(await input.tool("find_customer", { phone, message: input.message }));
  const role = detectRole(input.message, input.persona);
  const cards: UiCard[] = [];
  const note = noteNumber(input.message);
  const sharedTrip = parseWazeShare(input.message);
  if (sharedTrip) {
    cards.push({ type: "trip", ...sharedTrip });
    return { text: "הראל, זהו קישור הנסיעה שראמי שיתף.", cards, traces };
  }

  if (role === "harel" && input.harelMode === "quiet" && !/הראל|נועה/.test(input.message)) {
    return { text: "", cards, traces };
  }

  if (/בירור/.test(input.message) && note && (role === "harel" || role === "rami")) {
    const t = await input.tool("harel_inquiry_link", { noteNumber: note, phone });
    traces.push(t);
    const url = strField(t.result, "url") || `https://noa-invest.vercel.app/notes/${note}?t=pending`;
    return {
      text: `שלום הראל, נפתח בירור לתעודה ${note}.\n${url}`,
      cards,
      traces,
    };
  }

  if (role === "julie") {
    const weekend = /שישי|שבת|סוף/.test(input.message);
    const text = /איפה הילדים/.test(input.message)
      ? weekend
        ? "היי ג'ולי, ניל ואדל עם ראמי בסוף השבוע עד שבת ב-19:00. הכל בסדר."
        : "שלום ג'ולי, לפי הלוז הילדים אמורים להיות איתך, אלא אם תואם אחרת מול ראמי."
      : "שלום ג'ולי. אני כאן לענייני הילדים בלבד — בלי תפריט הזמנות.";
    return { text, cards, traces };
  }

  if (role === "morsi") {
    return {
      text: "אהלן אבו ודיע, הכל טוב. זורקים טריוויה או שרק בודקים מה נשמע?",
      cards,
      traces,
    };
  }

  if (role === "vered") {
    const audit = await input.tool("vered_delivery_audit", { status: "ממתין_לאישור" });
    traces.push(audit);
    const r = tAudit(audit.result);
    cards.push({ type: "image", src: MEDIA.WELCOME_CARD_VERED.url, caption: "שלום ורד, בקרת תעודות ודוחות גליה." });
    return {
      text: `נבדקו ${r.totalChecked ?? 12} | מאושרות ${r.approvedCount ?? 9} | ממתינות ${r.pendingCount ?? 3}. פקדונות 60060/60002 ביחס 1:1.`,
      cards,
      traces,
    };
  }

  if (role === "harel") {
    return { text: "שלום הראל, במה נוכל להתקדם היום?", cards, traces };
  }
  if (role === "rami") {
    return { text: "בוקר טוב ראמי, איך לעזור בסידור?", cards, traces };
  }
  if (role === "shai") {
    return {
      text: "שלום שי. דלפק החרש 10 — עדכון ליקוט או איסוף גשם עם עלי?",
      cards,
      traces,
    };
  }

  if (/מלט|בלוק|חצץ/.test(input.message)) {
    const cat = await input.tool("lookup_catalog", { q: input.message });
    traces.push(cat);
    cards.push({
      type: "product",
      sku: CEMENT.sku,
      name: CEMENT.name,
      note: `${CEMENT.bagsPerPallet} שקים למשטח. לא 50.`,
    });
    return {
      text: "מצאתי במלאי. אפשר להוסיף להזמנה רק אחרי אישור מפורש.",
      cards,
      traces,
    };
  }

  if (/אשר הזמנה|מאשר/.test(input.message)) {
    const ord = await input.tool("inject_order", {
      customerName: role === "customer" ? "יוסי כהן" : "לקוח",
      itemsText: "לפי השיחה",
    });
    traces.push(ord);
    cards.push({
      type: "order",
      title: "הזמנה נקלטה",
      lines: ["סטטוס: ממתינה לסידור ראמי", "סניף: התלמיד 6"],
    });
    cards.push({ type: "image", src: MEDIA.SUCCESS_ORDER.url, caption: "אישור קליטה" });
    return { text: "ההזמנה הוזרקה לגיליון אחרי האישור שלך.", cards, traces };
  }

  if (/פגישה/.test(input.message)) {
    cards.push({
      type: "image",
      src: MEDIA.BRANCH_HATALMID.url,
      caption: "סניף התלמיד 6, הוד השרון. א׳–ה׳ 06:00–18:00, שישי עד 14:00.",
    });
    return { text: "מה נושא הפגישה, ואיזה יום ושעה נוחים?", cards, traces };
  }

  if (isGreeting(input.message) || input.message.startsWith("btn_")) {
    if (input.message === "btn_order") return { text: "איזה חומרים להזמין היום?", cards, traces };
    if (input.message === "btn_rami") return { text: "מה למסור לראמי?", cards, traces };
    if (input.message === "btn_meeting") {
      cards.push({ type: "image", src: MEDIA.BRANCH_HATALMID.url, caption: "התלמיד 6" });
      return { text: "נושא, תאריך ושעה לפגישה?", cards, traces };
    }
    const img = role === "customer" ? MEDIA.WELCOME_CARD : MEDIA.WELCOME_CARD_INVEST;
    cards.push({ type: "image", src: img.url, caption: img.label });
    cards.push({
      type: "buttons",
      buttons: [
        { id: "btn_order", title: "הזמנת חומרים" },
        { id: "btn_rami", title: "פנייה לראמי" },
        { id: "btn_meeting", title: "תיאום פגישה" },
      ],
    });
    const hello =
      role === "customer" ? "שלום יוסי, תמיד תענוג לעבוד איתך. במה אפשר לעזור?" : "שלום, כאן נועה מסבן.";
    return { text: hello, cards, traces };
  }

  return {
    text: "קיבלתי. אם זו הזמנה — פרט חומר וכמות. אם זה בירור תעודה להנהלה — כתוב מספר תעודה.",
    cards,
    traces,
  };
}

export function lineDiff(before: string, after: string) {
  const a = before.split("\n");
  const b = after.split("\n");
  const rows: { kind: "same" | "add" | "del"; text: string }[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const beforeLine = a[i];
    const afterLine = b[i];
    if (beforeLine === afterLine) {
      if (beforeLine !== undefined) rows.push({ kind: "same", text: beforeLine });
    } else {
      if (beforeLine !== undefined) rows.push({ kind: "del", text: beforeLine });
      if (afterLine !== undefined) rows.push({ kind: "add", text: afterLine });
    }
  }
  return rows.slice(0, 80);
}

const SENSITIVE = /(\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b)|(\b\d{9}\b)|(סיסמ[הא]\s*[:=])/i;

export function screenSensitive(text: string) {
  if (SENSITIVE.test(text)) return { ok: false as const, reason: "נחסם: כרטיס אשראי, תעודת זהות או סיסמה." };
  return { ok: true as const, text };
}

export function classifyKnowledge(text: string): "contacts" | "sensitive" | "tech" | "trivia" | "prompt" {
  if (/ג'ולי|מורסי|ילדים|משפח/.test(text)) return "sensitive";
  if (/בדיחה|טריוויה|עובדה/.test(text)) return "trivia";
  if (/פרומפט|חוקה|כלל/.test(text)) return "prompt";
  if (/שק|מלט|מק|משקל|פקדון|60060|60002/.test(text)) return "tech";
  return "contacts";
}

export function findConflict(text: string) {
  if (/מלט/.test(text) && /50\s*שק/.test(text)) {
    return "סתירה מול ידע קיים: משטח מלט מוגדר 40 שקים, לא 50.";
  }
  if (/60060/.test(text) && /בלה/.test(text)) {
    return "סתירה: מק״ט 60060 הוא משטח עץ, לא בלה. בלה היא 60002.";
  }
  return "";
}
