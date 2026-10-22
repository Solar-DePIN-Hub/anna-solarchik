// Sol retention hooks (separate from game code). Reads game save
// (localStorage "solarchik-clock-in-v8"), stores own state in "solarchik-sol-hooks".
const GAME_KEY = "solarchik-clock-in-v8", KEY = "solarchik-sol-hooks";
const today = () => new Date().toISOString().slice(0, 10);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (_) { return d; } };
const game = () => load(GAME_KEY, {});
let st = load(KEY, { mission: null, missionStreak: 0, lastDone: "", badges: 0 });
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (_) {} };

async function solSays(prompt, fallback) {
  try {
    const rt = await (window.SolarchikAnna && window.SolarchikAnna.ready);
    if (!rt) return fallback;
    const out = await Promise.race([
      rt.llm.complete({ maxTokens: 80, messages: [{ role: "user", content: { type: "text", text:
        "[You are Sol, a cheerful tiny solar robot friend in the rooftop running game Solarchik CLOCK IN. Reply in ONE short sentence, max 22 words, no emojis spam, no quotes.]\n\n" + prompt } }] }),
      new Promise((_, r) => setTimeout(() => r(new Error("t")), 9000)),
    ]);
    const t = String((out && out.content && out.content.text) || "").trim();
    return t || fallback;
  } catch (_) { return fallback; }
}

// ---- UI ----
const css = document.createElement("style");
css.textContent = `#solhooks{position:fixed;top:max(8px,env(safe-area-inset-top));right:8px;z-index:9999;font:600 13px/1.3 system-ui,sans-serif;display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:none}
#solhooks .chip{pointer-events:auto;background:rgba(11,22,32,.88);color:#fff6d6;border:1px solid #f5b83d;border-radius:14px;padding:6px 10px;max-width:260px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.4)}
#solhooks .chip.done{border-color:#5fd38a}#solhooks .toast{pointer-events:auto;background:#f5b83d;color:#1a1305;border-radius:14px;padding:8px 12px;max-width:280px;animation:solin .3s ease}
#solhooks .toast b{display:block;font-size:11px;opacity:.7}#solhooks .min{opacity:.55}@keyframes solin{from{transform:translateY(-8px);opacity:0}}`;
document.head.appendChild(css);
const box = document.createElement("div"); box.id = "solhooks";
const chip = document.createElement("div"); chip.className = "chip"; box.appendChild(chip);
let open = true;
chip.onclick = () => { open = !open; render(); };
document.addEventListener("DOMContentLoaded", () => document.body.appendChild(box));
if (document.body) document.body.appendChild(box);

function render() {
  const m = st.mission;
  if (!m) { chip.textContent = "☀ Sol is thinking of today's mission…"; return; }
  chip.classList.toggle("done", !!m.done);
  chip.classList.toggle("min", !open);
  chip.innerHTML = open
    ? `☀ <b>Sol's mission:</b> run ${m.goal} m in one run${m.done ? " ✅" : ""}<br><span style="opacity:.8;font-weight:500">${m.line}</span><br>🔥 Mission streak ${st.missionStreak} · 🏅 ${st.badges} <span data-share style="text-decoration:underline;margin-left:6px">Share best</span>`
    : `☀ ${m.done ? "✅" : m.goal + " m"} · 🔥${st.missionStreak}`;
  const s = chip.querySelector("[data-share]");
  if (s) s.onclick = (e) => { e.stopPropagation(); shareCard(); };
}
function toast(title, text) {
  const t = document.createElement("div"); t.className = "toast";
  t.innerHTML = `<b>${title}</b>`; t.appendChild(document.createTextNode(text));
  t.onclick = () => t.remove(); box.appendChild(t);
  setTimeout(() => t.remove(), 9000);
  try { if (window.SolarchikNative && window.SolarchikVoice && window.SolarchikVoice.autoSpeak) window.SolarchikNative.speak(text, "en"); } catch (_) {}
}

// ---- daily mission ----
async function ensureMission() {
  const d = today();
  if (st.mission && st.mission.day === d) return render();
  // mission streak breaks if yesterday's mission wasn't completed
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (st.lastDone !== y && st.lastDone !== d) st.missionStreak = 0;
  const best = Number(game().bestDistance) || 0;
  const goal = best < 100 ? 150 : Math.round((best * (0.8 + Math.random() * 0.3)) / 10) * 10;
  st.mission = { day: d, goal, done: false, line: "Let's clock in!" };
  save(); render();
  st.mission.line = await solSays(`Give the player today's mission: run at least ${goal} meters in a single run (their best is ${best} m). Be encouraging.`, `Today: ${goal} m in one run. You've got this!`);
  save(); render();
}

// ---- run end detection ----
let lastRuns = Number(game().runs) || 0, lastBest = Number(game().bestDistance) || 0;
async function check() {
  const g = game(), runs = Number(g.runs) || 0;
  if (runs <= lastRuns) { lastRuns = runs; return; }
  lastRuns = runs;
  const dist = Number(g.lastDistance) || 0, best = Number(g.bestDistance) || 0;
  const newBest = best > lastBest && dist >= best; lastBest = best;
  await ensureMission();
  const m = st.mission;
  if (m && !m.done && dist >= m.goal) {
    m.done = true; st.badges++; st.lastDone = m.day; st.missionStreak++; save(); render();
    toast("🏅 Mission complete!", `${dist} m ≥ ${m.goal} m. Mission streak: ${st.missionStreak}`);
  }
  const fb = newBest ? `New record: ${dist} m! I'm glowing!` : `${dist} m — nice shift. Again?`;
  const line = await solSays(newBest
    ? `The player just set a NEW BEST distance: ${dist} m (old best ${best === dist ? "lower" : best}). Celebrate big.`
    : `The player just finished a roof run: ${dist} m. Their best is ${best} m. ${m && !m.done ? `Today's mission is ${m.goal} m.` : ""} Comment playfully and motivate one more run.`, fb);
  toast(newBest ? "⭐ Sol — NEW BEST!" : "☀ Sol", line);
  if (newBest) setTimeout(() => toast("📸 Share", "Tap 'Share best' on Sol's mission card to get your score card."), 1500);
}
setInterval(check, 1200);
ensureMission();

// ---- shareable PNG card ----
function shareCard() {
  const g = game(), c = document.createElement("canvas"); c.width = 1080; c.height = 1080;
  const x = c.getContext("2d");
  const gr = x.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, "#ffb347"); gr.addColorStop(0.55, "#2a3d66"); gr.addColorStop(1, "#0b1620");
  x.fillStyle = gr; x.fillRect(0, 0, 1080, 1080);
  x.fillStyle = "#ffe27a"; x.beginPath(); x.arc(540, 300, 130, 0, 7); x.fill();
  x.fillStyle = "#0b1620"; for (let i = 0; i < 9; i++) { const h = 120 + ((i * 73) % 160); x.fillRect(i * 125, 1080 - 260 - h, 115, h + 260); }
  x.textAlign = "center"; x.fillStyle = "#fff";
  x.font = "bold 64px system-ui,sans-serif"; x.fillText("SOLARCHIK CLOCK IN", 540, 110);
  x.font = "bold 190px system-ui,sans-serif"; x.fillText(`${Number(g.bestDistance) || 0} m`, 540, 640);
  x.font = "600 52px system-ui,sans-serif"; x.fillText("my best roof run", 540, 715);
  x.font = "500 42px system-ui,sans-serif"; x.fillStyle = "#ffe27a";
  x.fillText(`🔥 streak ${Number(g.streak) || 0} · 🏅 missions ${st.badges} · runs ${Number(g.runs) || 0}`, 540, 800);
  x.fillStyle = "#fff"; x.font = "500 36px system-ui,sans-serif"; x.fillText("Can you beat me? Play with Sol on Anna", 540, 1010);
  c.toBlob(async (b) => {
    const f = new File([b], "solarchik-best.png", { type: "image/png" });
    try { if (navigator.canShare && navigator.canShare({ files: [f] })) return await navigator.share({ files: [f], title: "Solarchik CLOCK IN" }); } catch (_) {}
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "solarchik-best.png"; document.body.appendChild(a); a.click(); a.remove();
  }, "image/png");
}
window.SolHooks = { shareCard, check, state: () => st };
