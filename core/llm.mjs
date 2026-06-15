// Live-LLM layer with per-task model tiering.
// Prefers Gemini over HTTP (fast, no process spawn) when GEMINI_API_KEY is set; falls back to the
// Claude Code CLI (Haiku, zero key). Callers pass { tier: "fast" | "accurate" } so we use speed
// where it's chat and accuracy where it's reasoning (simulation / decision / QA).
import { spawn, spawnSync } from "node:child_process";
import { recordUsage, underCap } from "./usage.mjs";

const GEMINI = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const MODELS = {
  fast: process.env.FORGE_FAST_MODEL || "gemini-3.1-flash-lite",
  accurate: process.env.FORGE_ACCURATE_MODEL || "gemini-3.5-flash",
};
const tierModel = (opts) => opts.model || MODELS[opts.tier || "fast"] || MODELS.fast;

async function gemini(prompt, model, opts = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI}`;
  // Without an explicit temperature the model is effectively deterministic — identical prompt → identical
  // output every call. Default to a lively temperature so situations/conversations actually vary.
  const temperature = opts.temperature != null ? opts.temperature : 0.85;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature } }),
  });
  if (!res.ok) throw new Error("gemini " + res.status);
  const j = await res.json();
  const t = (j?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  if (!t.trim()) throw new Error("gemini empty");
  try {
    recordUsage(model, prompt.length, t.length);
  } catch {
    /* metering best-effort */
  }
  return t.trim();
}

function claudeSync(prompt, model = "haiku") {
  const r = spawnSync("claude", ["-p", "--model", model, prompt], { encoding: "utf8", timeout: 90000, maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0 || !r.stdout) throw new Error("claude unavailable");
  return r.stdout.trim();
}

function claudeAsyncP(prompt, model = "haiku", timeout = 90000) {
  return new Promise((resolve, reject) => {
    const cp = spawn("claude", ["-p", "--model", model, prompt], { env: process.env });
    let o = "";
    const to = setTimeout(() => {
      cp.kill();
      reject(new Error("timeout"));
    }, timeout);
    cp.stdout.on("data", (d) => (o += d.toString()));
    cp.stderr.on("data", () => {});
    cp.on("error", (e) => {
      clearTimeout(to);
      reject(e);
    });
    cp.on("close", (c) => {
      clearTimeout(to);
      c !== 0 || !o.trim() ? reject(new Error("claude unavailable")) : resolve(o.trim());
    });
  });
}

// ── async (used by the live demo) ──
export async function askAsync(prompt, opts = {}) {
  if (GEMINI) {
    // Hard daily cost cap: once today's estimated spend hits the cap, stop calling the paid API.
    if (!underCap()) {
      try {
        return await claudeAsyncP(prompt, "haiku", opts.timeout || 90000); // free fallback if present
      } catch {
        const e = new Error("BUDGET_EXCEEDED");
        e.code = "BUDGET_EXCEEDED";
        throw e;
      }
    }
    try {
      return await gemini(prompt, tierModel(opts), opts);
    } catch (e) {
      if (e && e.code === "BUDGET_EXCEEDED") throw e;
      /* fall back to claude */
    }
  }
  return claudeAsyncP(prompt, "haiku", opts.timeout || 90000);
}
export async function askJsonAsync(prompt, opts = {}) {
  const out = await askAsync(prompt + "\n\nOutput ONLY JSON, no prose.", opts);
  const m = out.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return JSON.parse(m ? m[0] : out);
}

// Claude-Code-ONLY (token-free, subscription auth) async helpers. Used for the platform's own
// self-evolution / development / management intelligence so that layer never spends API tokens —
// distinct from the demo runtime (askAsync), which may use Gemini for low latency.
export async function askClaudeAsync(prompt, opts = {}) {
  return claudeAsyncP(prompt, opts.model || "haiku", opts.timeout || 90000);
}
export async function askClaudeJsonAsync(prompt, opts = {}) {
  const out = await askClaudeAsync(prompt + "\n\nOutput ONLY JSON, no prose.", opts);
  const m = out.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return JSON.parse(m ? m[0] : out);
}

// ── sync (probes / one-shots) ──
export function ask(prompt, opts = {}) {
  return claudeSync(prompt, opts.model || "haiku");
}
export function askJson(prompt, opts = {}) {
  const out = ask(prompt + "\n\nOutput ONLY JSON, no prose.", opts);
  const m = out.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return JSON.parse(m ? m[0] : out);
}

export function provider() {
  return GEMINI ? `gemini (${MODELS.fast} / ${MODELS.accurate})` : "claude-cli (haiku)";
}
export function claudeAvailable() {
  return !!GEMINI || spawnSync("claude", ["--version"], { encoding: "utf8", timeout: 8000 }).status === 0;
}
