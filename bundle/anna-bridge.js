// Anna bridge for Solarchik CLOCK IN.
// The game already talks to a host through window.SolarchikNative (the same
// bridge its Android app uses). Here we implement that bridge on top of the
// Anna App runtime, so Sol (the AI friend) thinks with Anna's LLM
// (anna.llm.complete), hears with anna.audio.transcribe and speaks with
// anna.audio.speak. No API keys live in this bundle.
import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";

let anna = null;
const ready = AnnaAppRuntime.connect()
  .then((rt) => {
    anna = rt;
    window.anna = rt;
    try { rt.window.set_title({ title: "Solarchik CLOCK IN" }); } catch (_) {}
    return rt;
  })
  .catch((e) => {
    console.warn("[solarchik] Anna host not available, offline mode:", e && e.message);
    return null;
  });

function reply(id, obj) {
  const fn = window.SolarchikNativeReply;
  if (typeof fn === "function") fn(String(id), JSON.stringify(obj));
}

function errCode(e) {
  const c = e && (e.code || e.error || "");
  if (c === "quota_exceeded") return "busy";
  if (c === "permission_denied" || c === "not_implemented") return "offline";
  return "offline";
}

// Gemini-style payload from the game -> Anna messages.
function toMessages(p) {
  const msgs = [];
  for (const c of p.contents || []) {
    const text = (c.parts || []).map((x) => x.text || "").join("\n").trim();
    if (!text) continue;
    msgs.push({ role: c.role === "model" ? "assistant" : "user", content: { type: "text", text } });
  }
  if (!msgs.length) msgs.push({ role: "user", content: { type: "text", text: "Hi." } });
  if (p.system) {
    const first = msgs.find((m) => m.role === "user");
    if (first) first.content.text = `[Character rules: ${p.system}]\n\n${first.content.text}`;
  }
  return msgs;
}

async function ask(payload, id) {
  try {
    const rt = await ready;
    if (!rt) return reply(id, { ok: false, error: "offline" });
    const p = JSON.parse(payload || "{}");
    const out = await rt.llm.complete({
      messages: toMessages(p),
      maxTokens: Math.max(64, Math.min(400, Number(p.maxTokens) || 140)),
    });
    const text = String((out && out.content && out.content.text) || "").trim();
    reply(id, text ? { ok: true, text } : { ok: false, error: "empty" });
  } catch (e) {
    reply(id, { ok: false, error: errCode(e) });
  }
}

async function hear(audio, mime, id) {
  try {
    const rt = await ready;
    if (!rt) return reply(id, { ok: false });
    const fmt = /ogg/.test(mime) ? "ogg" : /mp4|m4a|aac/.test(mime) ? "m4a" : /wav/.test(mime) ? "wav" : "webm";
    const b64 = String(audio || "").replace(/^data:[^,]*,/, "");
    const out = await rt.audio.transcribe({ audioBase64: b64, format: fmt });
    const text = String((out && out.text) || "").trim();
    reply(id, text ? { ok: true, text } : { ok: false });
  } catch (_) {
    reply(id, { ok: false });
  }
}

let player = null;
let speakGen = 0;
function hush() {
  speakGen++;
  try { if (player) { player.pause(); player.src = ""; } } catch (_) {}
  player = null;
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) {}
}
function deviceSpeak(text, locale) {
  try {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = { uk: "uk-UA", de: "de-DE", ja: "ja-JP", es: "es-ES", fr: "fr-FR" }[locale] || "en-US";
    window.speechSynthesis.speak(u);
  } catch (_) {}
}
async function speak(text, locale) {
  hush();
  const gen = speakGen;
  try {
    const rt = await ready;
    if (!rt) throw new Error("offline");
    const out = await rt.audio.speak({ text: String(text).slice(0, 900), format: "mp3", delivery: "inline" });
    if (gen !== speakGen) return;
    if (!out || !out.audioBase64) throw new Error("no audio");
    const bin = atob(out.audioBase64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    player = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" })));
    await player.play();
  } catch (_) {
    if (gen === speakGen) deviceSpeak(text, locale);
  }
}

// Stable per-user player id (Anna user scope via storage when available).
let pid = "";
try { pid = localStorage.getItem("solarchik.anna.pid") || ""; } catch (_) {}
if (!pid) {
  pid = "anna-" + Math.random().toString(36).slice(2, 12);
  try { localStorage.setItem("solarchik.anna.pid", pid); } catch (_) {}
}

window.SolarchikNative = {
  ask,
  hear,
  speak: (t, l) => { void speak(t, l); },
  hush,
  playerId: () => pid,
  bindPlayer: () => {},
};
window.SolarchikAnna = { ready };
