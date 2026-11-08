import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Lock, Moon, Sun, Radio } from "lucide-react";
import { TOOLS } from "@/lib/noa/catalog";
import {
  classifyKnowledge,
  findConflict,
  lineDiff,
  screenSensitive,
  type Trace,
  type UiCard,
} from "@/lib/noa/engine";
import { chatTurn, runTool, studioLogin, studioLogout, studioStatus, transcribeAudio } from "@/server/noa.functions";

type Room = "chat" | "studio" | "tools";
type Mode = "sandbox" | "live";
type Msg = { id: string; from: "me" | "noa"; text: string; time: string; cards?: UiCard[]; ticks?: string };

const PERSONAS = [
  { id: "chameleon", name: "זיקית", phone: "972508861080" },
  { id: "harel", name: "הראל", phone: "972505227724" },
  { id: "vered", name: "ורד", phone: "בקרת גליה" },
  { id: "rami", name: "ראמי", phone: "972508860896" },
  { id: "julie", name: "ג'ולי", phone: "972508898001" },
  { id: "morsi", name: "אבו ודיע", phone: "חבר" },
  { id: "shai", name: "שי", phone: "972503454566" },
  { id: "yossi", name: "יוסי כהן", phone: "972501112233" },
  { id: "new", name: "לקוח חדש", phone: "לא בארכיון" },
];

const PROMPT_SEED = `# חוקת נועה · סטודיו
1. find_customer לפני כל כפתור.
2. זיקית 972508861080 — הראל, ורד, ג'ולי, ראמי, מורסי לפי תוכן.
3. ג'ולי: בלי מסחר. שני 15:00, סופ"ש עד שבת 19:00.
4. מורסי: הומור, אפס כסף.
5. משטח מלט = 40 שקים. 60060 עץ, 60002 בלה.
6. כלי כתיבה ב-Sandbox מסומנים [סימולציה].`;

type TableKey = "contacts" | "sensitive" | "tech" | "trivia";
const TABLES: Record<TableKey, { title: string; headers: string[]; rows: string[][] }> = {
  contacts: {
    title: "אנשי קשר וראמי",
    headers: ["שם", "תפקיד", "טלפון"],
    rows: [
      ["הראל אידלסון", "הנהלה", "972505227724"],
      ["ראמי מסארווה", "סידור", "972508860896"],
      ["שי ראובן", "מלקט החרש 10", "972503454566"],
    ],
  },
  sensitive: {
    title: "פרופילים רגישים",
    headers: ["שם", "כלל"],
    rows: [
      ["ג'ולי", "בלי תפריט מכירה · ילדים ניל ואדל"],
      ["מורסי", "אבו ודיע · אפס התחייבות כספית"],
    ],
  },
  tech: {
    title: "ידע טכני",
    headers: ["נושא", "ערך"],
    rows: [
      ["משטח מלט", "40 שקים"],
      ["60060", "משטח עץ"],
      ["60002", "שק ענק בלה"],
    ],
  },
  trivia: {
    title: "טריוויה",
    headers: ["סוג", "טקסט"],
    rows: [["עובדה", "התלמיד 6 פתוח עד 18:00, שישי עד 14:00"]],
  },
};

function nowTime() {
  return new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export function StudioApp() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [room, setRoom] = useState<Room>("chat");
  const [mode, setMode] = useState<Mode>("sandbox");
  const [confirmLive, setConfirmLive] = useState(0);
  const [dark, setDark] = useState(false);
  const [persona, setPersona] = useState("chameleon");
  const [harelMode, setHarelMode] = useState<"address" | "quiet">("address");
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { id: "hello", from: "noa", text: "סטודיו נועה מוכן. בחרי מי אתה ושלחי הודעה.", time: "", ticks: "✓✓" },
  ]);
  const [traces, setTraces] = useState<Trace[]>([]);
  const [openTrace, setOpenTrace] = useState<Trace | null>(null);
  const [drawer, setDrawer] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const [prompt, setPrompt] = useState(PROMPT_SEED);
  const [savedPrompt, setSavedPrompt] = useState(PROMPT_SEED);
  const [studioText, setStudioText] = useState("");
  const [studioNotes, setStudioNotes] = useState<string[]>([]);
  const [pending, setPending] = useState<{ bucket: string; text: string; conflict: string } | null>(null);
  const [tables, setTables] = useState(TABLES);
  const [activeTable, setActiveTable] = useState<keyof typeof TABLES>("tech");

  const [tester, setTester] = useState<(typeof TOOLS)[number] | null>(null);
  const [testerValues, setTesterValues] = useState<Record<string, string>>({});
  const [testerOut, setTesterOut] = useState<Trace | null>(null);
  const [proxyOn, setProxyOn] = useState(false);

  useEffect(() => {
    studioStatus()
      .then((s) => {
        setAuthed(s.authed);
        setProxyOn(s.proxyConfigured);
      })
      .catch(() => setAuthed(false))
      .finally(() => setReady(true));
    try {
      const p = localStorage.getItem("noa-prompt");
      if (p) {
        setPrompt(p);
        setSavedPrompt(p);
      }
      const modeSaved = localStorage.getItem("noa-mode");
      if (modeSaved === "live" || modeSaved === "sandbox") setMode(modeSaved);
      if (localStorage.getItem("noa-dark") === "1") {
        setDark(true);
        document.documentElement.classList.add("dark");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, typing]);

  function toggleDark() {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("noa-dark", next ? "1" : "0");
      return next;
    });
  }

  async function enter(e: FormEvent) {
    e.preventDefault();
    setAuthError("");
    let res;
    try { res = await studioLogin({ data: { password } }); }
    catch { setAuthError("הכניסה לא זמינה כרגע"); return; }
    if (!res.ok) {
      setAuthError("סיסמה לא נכונה");
      return;
    }
    setPassword("");
    setAuthed(true);
  }

  function askLive() {
    if (mode === "live") {
      setMode("sandbox");
      localStorage.setItem("noa-mode", "sandbox");
      setConfirmLive(0);
      return;
    }
    setConfirmLive((n) => {
      if (n >= 1) {
        setMode("live");
        localStorage.setItem("noa-mode", "live");
        return 0;
      }
      return n + 1;
    });
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    setDraft("");
    setMessages((m) => [...m, { id: crypto.randomUUID(), from: "me", text: clean, time: nowTime(), ticks: "✓✓" }]);
    setTyping(true);
    try {
      const turn = await chatTurn({
        data: { message: clean, persona, harelMode, mode },
      });
      setTraces((t) => [...turn.traces, ...t].slice(0, 40));
      if (turn.text || turn.cards.length) {
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), from: "noa", text: turn.text, time: nowTime(), cards: turn.cards, ticks: "✓✓" },
        ]);
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          from: "noa",
          text: err instanceof Error ? err.message : "שגיאה",
          time: nowTime(),
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  async function onAudio(blob: Blob) {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] ?? 0);
    const base64 = btoa(binary);
    const res = await transcribeAudio({ data: { mimeType: blob.type || "audio/webm", base64 } });
    if (res.ok && res.text) await send(res.text);
    else {
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), from: "noa", text: res.message || "התמלול לא זמין", time: nowTime() },
      ]);
    }
  }

  function stageKnowledge() {
    const gate = screenSensitive(studioText);
    if (!gate.ok) {
      setStudioNotes((n) => [gate.reason, ...n]);
      return;
    }
    const bucket = classifyKnowledge(studioText);
    const conflict = findConflict(studioText);
    setPending({ bucket, text: studioText.trim(), conflict });
  }

  function commitKnowledge() {
    if (!pending) return;
    const key: TableKey = pending.bucket === "prompt" ? "tech" : pending.bucket as TableKey;
    if (key in tables) {
      setTables((prev) => {
        const t = prev[key as keyof typeof prev];
        return { ...prev, [key]: { ...t, rows: [[pending.text.slice(0, 40), "נוסף בסטודיו"], ...t.rows] } };
      });
    }
    setStudioNotes((n) => [`נשמר ב־${pending.bucket}`, ...n]);
    setStudioText("");
    setPending(null);
  }

  const diff = useMemo(() => lineDiff(savedPrompt, prompt), [prompt, savedPrompt]);

  if (!authed) {
    return (
      <main dir="rtl" className="grid min-h-dvh place-items-center px-4">
        <form onSubmit={enter} className="w-full max-w-sm rounded-[var(--radius-card)] border border-line bg-paper p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-pine text-sand">
              <Lock className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold">סטודיו נועה</h1>
              <p className="text-sm text-muted">ח. סבן חומרי בניין · כניסה להנהלה</p>
            </div>
          </div>
          <label className="mb-1 block text-sm font-medium" htmlFor="pw">
            סיסמה
          </label>
          <input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-3 w-full rounded-xl border border-line bg-sand px-3 py-3 outline-none focus:border-pine"
            autoComplete="current-password"
          />
          {authError ? <p className="mb-2 text-sm text-danger">{authError}</p> : null}
          <Button variant="imported" size="imported" type="submit" disabled={!ready} className="h-12 w-full rounded-xl bg-pine font-display font-semibold text-sand disabled:opacity-60">
            כניסה
          </Button>
        </form>
      </main>
    );
  }

  return (
    <div dir="rtl" className="studio-shell flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        {mode === "live" ? (
          <div className="bg-danger px-3 py-1 text-center text-sm font-semibold text-sand">מצב LIVE · קריאות כתיבה אמיתיות לפרוקסי</div>
        ) : null}
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold leading-none">סטודיו נועה</p>
            <p className="truncate text-xs text-muted">{proxyOn ? "פרוקסי מחובר" : "פרוקסי לא הוגדר · נתוני דמו"}</p>
          </div>
          <Button variant="imported" size="imported"
            type="button"
            onClick={askLive}
            className="inline-flex h-11 items-center gap-1 rounded-full border border-line px-3 text-sm font-semibold"
          >
            <Radio className="size-4" />
            {mode === "live" ? "LIVE" : confirmLive ? "לאשר LIVE שוב" : "Sandbox"}
          </Button>
          <Button variant="imported" size="imported" type="button" onClick={toggleDark} className="grid size-11 place-items-center rounded-full border border-line" aria-label="ערכת צבע">
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button variant="imported" size="imported"
            type="button"
            className="h-11 rounded-full px-3 text-sm text-muted"
            onClick={() => studioLogout().then(() => setAuthed(false))}
          >
            יציאה
          </Button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-3 pb-2">
          {(
            [
              ["chat", "חדר צ'אט"],
              ["studio", "סטודיו ידע"],
              ["tools", "12 כלים"],
            ] as const
          ).map(([id, label]) => (
            <Button variant="imported" size="imported"
              key={id}
              type="button"
              onClick={() => setRoom(id)}
              className={`h-10 flex-1 rounded-full text-sm font-semibold ${room === id ? "bg-pine text-sand" : "bg-sand-2 text-ink"}`}
            >
              {label}
            </Button>
          ))}
        </nav>
      </header>

      {room === "chat" ? (
        <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex gap-2 overflow-x-auto border-b border-line bg-paper px-3 py-2">
              {PERSONAS.map((p) => (
                <Button variant="imported" size="imported"
                  key={p.id}
                  type="button"
                  onClick={() => setPersona(p.id)}
                  className={`shrink-0 rounded-full px-3 py-2 text-sm ${persona === p.id ? "bg-pine text-sand" : "bg-sand-2"}`}
                >
                  {p.name}
                </Button>
              ))}
            </div>
            {persona === "harel" ? (
              <div className="flex gap-2 bg-paper px-3 py-2 text-sm">
                <Button variant="imported" size="imported" type="button" className={`rounded-full px-3 py-1 ${harelMode === "address" ? "bg-pine text-sand" : "bg-sand-2"}`} onClick={() => setHarelMode("address")}>
                  על פי פנייה
                </Button>
                <Button variant="imported" size="imported" type="button" className={`rounded-full px-3 py-1 ${harelMode === "quiet" ? "bg-pine text-sand" : "bg-sand-2"}`} onClick={() => setHarelMode("quiet")}>
                  שקט
                </Button>
              </div>
            ) : null}
            <div ref={scroller} className="wa-wallpaper min-h-[50dvh] flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.from === "me" ? "justify-start" : "justify-end"}`}>
                  <div className={m.from === "me" ? "bubble-out" : "bubble-in"}>
                    {m.text ? <p className="whitespace-pre-wrap">{m.text}</p> : null}
                    {m.cards?.map((c, i) => (
                      <CardView key={i} card={c} onPick={(id) => void send(id)} />
                    ))}
                    <p className="mt-1 text-end text-[0.7rem] text-muted">
                      {m.time} {m.ticks || ""}
                    </p>
                  </div>
                </div>
              ))}
              {typing ? (
                <div className="flex justify-end">
                  <div className="bubble-in typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : null}
            </div>
            <form
              className="flex items-end gap-2 border-t border-line bg-paper p-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
              }}
            >
              <AudioButton onBlob={(b) => void onAudio(b)} />
              <textarea
                aria-label="הודעה לנועה"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={1}
                placeholder="הודעה לנועה"
                className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-sand px-3 py-2 outline-none"
              />
              <Button variant="imported" size="imported" type="submit" className="h-11 rounded-full bg-pine px-4 font-semibold text-sand">
                שליחה
              </Button>
            </form>
          </div>
          <aside className={`border-line bg-paper lg:w-80 lg:border-s ${drawer ? "block" : "hidden lg:block"}`}>
            <div className="flex items-center justify-between px-3 py-2">
              <h2 className="font-display font-bold">מה נועה עושה</h2>
              <Button variant="imported" size="imported" type="button" className="text-sm text-muted lg:hidden" onClick={() => setDrawer(false)}>
                סגור
              </Button>
            </div>
            <ul className="max-h-[40dvh] space-y-2 overflow-y-auto px-3 pb-4 lg:max-h-[70dvh]">
              {traces.length === 0 ? <li className="text-sm text-muted">עדיין אין קריאות כלים.</li> : null}
              {traces.map((t) => (
                <li key={t.id} className="rounded-xl border border-line p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{t.tool}</strong>
                    <span className="text-muted">{t.ms}ms</span>
                  </div>
                  <p className="text-muted">{t.ok ? "תקין" : "נכשל"}{t.simulated ? " · סימולציה" : ""}</p>
                  <Button variant="imported" size="imported" type="button" className="mt-1 text-pine-2 underline" onClick={() => setOpenTrace(t)}>
                    הצג JSON
                  </Button>
                </li>
              ))}
            </ul>
          </aside>
          <Button variant="imported" size="imported" type="button" className="fixed bottom-20 start-3 z-10 rounded-full bg-ink px-3 py-2 text-sm text-sand lg:hidden" onClick={() => setDrawer(true)}>
            לוג כלים
          </Button>
        </section>
      ) : null}

      {room === "studio" ? (
        <section className="mx-auto grid w-full max-w-6xl flex-1 gap-4 p-3 lg:grid-cols-2">
          <div className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
            <h2 className="font-display text-lg font-bold">עריכת ידע מול נועה</h2>
            <p className="mb-2 text-sm text-muted">טקסט חופשי יסווג ליעד, ייבדק מול סתירות, ויוצג כ-diff לפני שמירה.</p>
            <textarea value={studioText} onChange={(e) => setStudioText(e.target.value)} rows={5} className="w-full rounded-xl border border-line bg-sand p-3" placeholder="לדוגמה: משטח מלט הוא 50 שקים" />
            <Button variant="imported" size="imported" type="button" onClick={stageKnowledge} className="mt-2 h-11 rounded-xl bg-pine px-4 font-semibold text-sand">
              בדיקה לפני שמירה
            </Button>
            {pending ? (
              <div className="mt-3 rounded-xl border border-line p-3 text-sm">
                <p>יעד: {pending.bucket}</p>
                {pending.conflict ? <p className="mt-1 font-semibold text-danger">{pending.conflict}</p> : <p className="text-muted">אין סתירה מזוהה.</p>}
                <pre className="mt-2 overflow-auto text-xs">
                  <div className="diff-del">- (ללא שורה קודמת)</div>
                  <div className="diff-add">+ {pending.text}</div>
                </pre>
                <div className="mt-2 flex gap-2">
                  <Button variant="imported" size="imported" type="button" className="h-10 rounded-xl bg-pine px-3 text-sand" onClick={commitKnowledge}>אשר שמירה</Button>
                  <Button variant="imported" size="imported" type="button" className="h-10 rounded-xl border border-line px-3" onClick={() => setPending(null)}>בטל</Button>
                </div>
              </div>
            ) : null}
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {studioNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">prompt.v1</h2>
              <Button variant="imported" size="imported"
                type="button"
                className="h-10 rounded-xl bg-pine px-3 text-sm font-semibold text-sand"
                onClick={() => {
                  setSavedPrompt(prompt);
                  localStorage.setItem("noa-prompt", prompt);
                  setRoom("chat");
                }}
              >
                שמירה ובדיקה בצ'אט
              </Button>
            </div>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8} className="w-full rounded-xl border border-line bg-sand p-3 font-mono text-sm" />
            <div className="mt-2 max-h-40 overflow-auto rounded-xl border border-line text-xs">
              {diff.map((row, i) => (
                <div key={i} className={row.kind === "add" ? "diff-add" : row.kind === "del" ? "diff-del" : ""}>
                  {row.kind === "add" ? "+ " : row.kind === "del" ? "- " : "  "}
                  {row.text}
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="mb-2 flex gap-2 overflow-x-auto">
                {(Object.keys(tables) as (keyof typeof tables)[]).map((k) => (
                  <Button variant="imported" size="imported" key={k} type="button" onClick={() => setActiveTable(k)} className={`shrink-0 rounded-full px-3 py-1 text-sm ${activeTable === k ? "bg-pine text-sand" : "bg-sand-2"}`}>
                    {tables[k].title}
                  </Button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {tables[activeTable].headers.map((h) => (
                        <th key={h} className="border-b border-line p-2 text-start">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tables[activeTable].rows.map((r, i) => (
                      <tr key={i}>
                        {r.map((c, j) => (
                          <td key={j} className="border-b border-line p-2">{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="imported" size="imported"
                type="button"
                className="mt-2 text-sm underline"
                onClick={() => {
                  const t = tables[activeTable];
                  const csv = [t.headers.join(","), ...t.rows.map((r) => r.join(","))].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `${activeTable}.csv`;
                  a.click();
                }}
              >
                ייצוא CSV
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {room === "tools" ? (
        <section className="mx-auto grid w-full max-w-6xl flex-1 gap-3 p-3 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <article key={tool.id} className="rounded-[var(--radius-card)] border border-line bg-paper p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="font-display font-bold">{tool.title}</h2>
                <span className="rounded-full bg-sand-2 px-2 py-0.5 text-xs">{tool.method}</span>
              </div>
              <p className="text-sm text-muted">{tool.summary}</p>
              <p className="mt-1 font-mono text-xs text-pine-2">{tool.endpoint}</p>
              <Button variant="imported" size="imported"
                type="button"
                className="mt-3 h-10 rounded-xl bg-pine px-3 text-sm font-semibold text-sand"
                onClick={() => {
                  setTester(tool);
                  setTesterOut(null);
                  const seed: Record<string, string> = {};
                  tool.params.forEach((p) => {
                    seed[p.name] = p.sample;
                  });
                  setTesterValues(seed);
                }}
              >
                הרץ בדיקה
              </Button>
            </article>
          ))}
        </section>
      ) : null}

      {tester ? (
        <div className="fixed inset-0 z-30 grid place-items-end bg-ink/40 p-3 sm:place-items-center" onClick={() => setTester(null)}>
          <form
            className="max-h-[85dvh] w-full max-w-lg overflow-auto rounded-[var(--radius-card)] bg-paper p-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void runTool({ data: { id: tester.id, params: testerValues, mode } }).then(setTesterOut).catch((error: unknown) => setTesterOut({ id: "error", tool: tester.id, ms: 0, ok: false, simulated: false, params: {}, result: { ok: false, message: error instanceof Error ? error.message : "שגיאה" } }));
            }}
          >
            <h3 className="font-display text-lg font-bold">{tester.title}</h3>
            {tester.params.map((p) => (
              <label key={p.name} className="mt-2 block text-sm">
                {p.name}
                <input
                  className="mt-1 w-full rounded-xl border border-line bg-sand px-3 py-2"
                  value={testerValues[p.name] || ""}
                  onChange={(e) => setTesterValues((v) => ({ ...v, [p.name]: e.target.value }))}
                />
              </label>
            ))}
            <div className="mt-3 flex gap-2">
              <Button variant="imported" size="imported" type="submit" className="h-11 flex-1 rounded-xl bg-pine font-semibold text-sand">הרצה</Button>
              <Button variant="imported" size="imported" type="button" className="h-11 rounded-xl border border-line px-4" onClick={() => setTester(null)}>סגור</Button>
            </div>
            {testerOut ? <pre className="mt-3 overflow-auto rounded-xl bg-sand p-3 text-xs">{JSON.stringify(testerOut.result, null, 2)}</pre> : null}
          </form>
        </div>
      ) : null}

      {openTrace ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4" onClick={() => setOpenTrace(null)}>
          <pre className="max-h-[70dvh] w-full max-w-lg overflow-auto rounded-[var(--radius-card)] bg-paper p-4 text-xs" onClick={(e) => e.stopPropagation()}>
            {JSON.stringify(openTrace, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function CardView({ card, onPick }: { card: UiCard; onPick: (id: string) => void }) {
  if (card.type === "image") {
    if (!card.src) return <p className="text-sm text-muted">{card.caption} · התמונה המקורית אינה זמינה</p>;
    return (
      <figure className="mt-2 overflow-hidden rounded-lg">
        <img src={card.src} alt="" className="max-h-44 w-full object-cover" />
        <figcaption className="mt-1 text-xs text-muted">{card.caption}</figcaption>
      </figure>
    );
  }
  if (card.type === "buttons") {
    return (
      <div className="mt-2 grid gap-1">
        {card.buttons.map((b) => (
          <Button variant="imported" size="imported" key={b.id} type="button" onClick={() => onPick(b.id)} className="rounded-lg border border-line bg-paper py-2 text-sm font-semibold text-pine">
            {b.title}
          </Button>
        ))}
      </div>
    );
  }
  if (card.type === "product") {
    return (
      <div className="mt-2 rounded-lg border border-line p-2 text-sm">
        <strong>{card.name}</strong>
        <p>מק״ט {card.sku}</p>
        <p className="text-muted">{card.note}</p>
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-lg border border-line p-2 text-sm">
      <strong>{card.title}</strong>
      {card.lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}

function AudioButton({ onBlob }: { onBlob: (b: Blob) => void }) {
  const [rec, setRec] = useState(false);
  const ref = useRef<MediaRecorder | null>(null);
  async function toggle() {
    if (rec && ref.current) {
      ref.current.stop();
      setRec(false);
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => chunks.push(e.data);
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      onBlob(new Blob(chunks, { type: mr.mimeType || "audio/webm" }));
    };
    ref.current = mr;
    mr.start();
    setRec(true);
  }
  return (
    <Button variant="imported" size="imported" type="button" onClick={() => void toggle().catch(() => setRec(false))} className={`grid size-11 place-items-center rounded-full border border-line ${rec ? "bg-danger text-sand" : ""}`} aria-label="הקלטה">
      {rec ? "■" : "●"}
    </Button>
  );
}
