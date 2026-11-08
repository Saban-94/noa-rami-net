import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { MEDIA, TOOLS, WRITE_IDS } from "@/lib/noa/catalog";
import { planReply, type Json, type Trace } from "@/lib/noa/engine";

const COOKIE = "noa_studio";

function password() {
  return process.env.STUDIO_PASSWORD || "saban1994";
}

function assertGate() {
  if (getCookie(COOKIE) !== "ok") {
    throw new Error("נעול");
  }
}

async function callProxy(action: string, params: Record<string, string>): Promise<Json | null> {
  const key = process.env.SABAN_KEY;
  if (!key) return null;
  const url = process.env.SABAN_PROXY_URL || "https://saban-proxy.hsaban2025.workers.dev";
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, key, ...params }),
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as Json;
  } catch {
    return { ok: res.ok, status: res.status, raw: text.slice(0, 400) };
  }
}

function mockResult(id: string, params: Record<string, string>, simulated: boolean): Json {
  const tag = simulated ? "[סימולציה] " : "";
  switch (id) {
    case "find_customer": {
      const phone = params.phone || "";
      if (phone === "972505227724" || /הראל/.test(params.message || "")) {
        return { found: true, isManagement: true, toneRules: "שלום הראל, במה נוכל להתקדם היום?", phone };
      }
      if (phone === "972508860896") {
        return { found: true, isManagement: true, toneRules: "בוקר טוב ראמי, איך לעזור בסידור?", phone };
      }
      if (phone === "972508898001") {
        return { found: true, isFamily: true, toneRules: "שלום ג'ולי", blockCommerceMenu: true, phone };
      }
      if (phone === "972501112233") {
        return { found: true, customerName: "יוסי כהן", firstName: "יוסי", tier: "RETURNING", phone };
      }
      return {
        found: false,
        tier: "NEW_CUSTOMER",
        phone,
        toneRules: "שדרי תמונת invest.jpg ו-3 כפתורי ניווט",
      };
    }
    case "harel_inquiry_link": {
      const note = params.noteNumber || "0";
      return {
        ok: true,
        simulated,
        noteNumber: note,
        url: `https://noa-invest.vercel.app/notes/${encodeURIComponent(note)}?t=studio-demo`,
        expiresInHours: 72,
        message: `${tag}הופק לינק בירור`,
      };
    }
    case "harel_inquiry_upload_notify":
      return { ok: true, simulated: true, message: `${tag}נשלחה התראה לראמי ולהראל`, fileUrl: params.fileUrl || "" };
    case "vered_delivery_audit":
      return { ok: true, totalChecked: 12, approvedCount: 9, pendingCount: 3, depositIssues: 0 };
    case "lookup_catalog":
      return {
        ok: true,
        items: [{ sku: "10012", name: "מלט נשר 50 ק״ג", pallet: 40, slang: ["מלט", "שק מלט"] }],
      };
    case "send_product_buttons":
      return { ok: true, skill: "product_actions", sku: params.sku || "10012" };
    case "inject_order":
      return { ok: true, simulated: true, message: `${tag}הזמנה נרשמה לגיליון`, id: "SIM-1044" };
    case "get_delivery_note":
      return { ok: true, noteNumber: params.noteNumber, found: false, message: "לא נמצא עותק חתום בארכיון המקומי" };
    case "get_inquiries_stats":
      return { ok: true, open: 4, waitingUpload: 1 };
    case "get_media": {
      const key = params.key || "WELCOME_CARD_INVEST";
      const asset = MEDIA[key] || MEDIA.WELCOME_CARD_INVEST;
      return { ok: true, key, ...asset };
    }
    case "schedule_meeting":
      return {
        ok: true,
        simulated: true,
        message: `${tag}פגישה בסניף התלמיד 6`,
        subject: params.subject,
        when: params.when,
      };
    default:
      return { ok: true, skill: params.skill || id, ui: ["welcome_buttons", "welcome_reply_buttons", "product_actions"] };
  }
}

async function executeTool(id: string, params: Record<string, string>, mode: "sandbox" | "live"): Promise<Trace> {
  const started = Date.now();
  const write = WRITE_IDS.has(id);
  const simulated = write && mode !== "live";
  let result: Json = null;
  let ok = true;
  if (!simulated && process.env.SABAN_KEY) {
    try {
      result = (await callProxy(id === "inject_order" ? "inject_order" : id, params)) ?? mockResult(id, params, false);
    } catch (err) {
      ok = false;
      result = { ok: false, message: err instanceof Error ? err.message : "proxy failed" };
    }
  } else {
    result = mockResult(id, params, simulated);
    if (simulated) ok = true;
  }
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (/key|secret|password|token/i.test(k)) continue;
    safe[k] = String(v).slice(0, 240);
  }
  return { id: `${id}-${started}`, tool: id, ms: Date.now() - started, ok, simulated, params: safe, result };
}

export const studioStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    authed: getCookie(COOKIE) === "ok",
    proxyConfigured: Boolean(process.env.SABAN_KEY),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    tools: TOOLS.map((t) => ({ id: t.id, title: t.title, method: t.method, kind: t.kind, summary: t.summary })),
  };
});

export const studioLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    if ((data.password || "") !== password()) return { ok: false as const };
    setCookie(COOKIE, "ok", { httpOnly: true, path: "/", sameSite: "lax", maxAge: 60 * 60 * 14 });
    return { ok: true as const };
  });

export const studioLogout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(COOKIE, { path: "/" });
  return { ok: true };
});

export const runTool = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string; params: Record<string, string>; mode: "sandbox" | "live" }) => data)
  .handler(async ({ data }) => {
    assertGate();
    return executeTool(data.id, data.params || {}, data.mode === "live" ? "live" : "sandbox");
  });

export const chatTurn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { message: string; persona: string; harelMode: "address" | "quiet"; mode: "sandbox" | "live" }) => data,
  )
  .handler(async ({ data }) => {
    assertGate();
    const mode = data.mode === "live" ? "live" : "sandbox";
    return planReply({
      message: data.message || "",
      persona: data.persona || "chameleon",
      harelMode: data.harelMode === "quiet" ? "quiet" : "address",
      tool: (id, params) => executeTool(id, params, mode),
    });
  });

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((data: { mimeType: string; base64: string }) => data)
  .handler(async ({ data }) => {
    assertGate();
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return { ok: false as const, text: "", message: "אין מפתח תמלול בשרת — כתוב את ההודעה." };
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: "תמלל לעברית את ההודעה הקולית. החזר רק את הטקסט." },
                { inline_data: { mime_type: data.mimeType || "audio/webm", data: data.base64 } },
              ],
            },
          ],
        }),
      },
    );
    if (!res.ok) return { ok: false as const, text: "", message: `תמלול נכשל (${res.status})` };
    const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join(" ").trim() || "";
    return { ok: true as const, text, message: "" };
  });
