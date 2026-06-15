// COST GUARD — meters every Gemini call and enforces a hard daily USD cap so a public demo link can
// never run up a bill. Usage is persisted per-day (UTC) to data/usage.json (gitignored). The cap is
// configurable via DEMO_DAILY_USD_CAP (default $5). Costs are ESTIMATES from token counts × model price.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const FILE = process.env.FORGE_USAGE || path.join(process.cwd(), "data", "usage.json");
const CAP = Number(process.env.DEMO_DAILY_USD_CAP || 5);

// USD per 1M tokens [input, output] — override via env if Google changes pricing. Conservative.
const PRICE = {
  "gemini-3.1-flash-lite": [0.1, 0.4],
  "gemini-3.5-flash": [0.3, 2.5],
};
const DEFAULT_PRICE = [0.3, 1.0];

const today = () => new Date().toISOString().slice(0, 10);

function readRaw() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return null;
  }
}
function writeRaw(d) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(d));
  } catch {
    try {
      fs.writeFileSync(path.join(os.tmpdir(), "forge-usage.json"), JSON.stringify(d));
    } catch {
      /* in-memory only */
    }
  }
}
function load() {
  const d = readRaw();
  if (!d || d.date !== today()) return { date: today(), calls: 0, inTok: 0, outTok: 0, usd: 0 };
  return d;
}

// Record one model call (chars → ~tokens at 4 chars/token) and accumulate the day's estimated spend.
export function recordUsage(model, inChars, outChars) {
  const d = load();
  const inTok = Math.ceil((inChars || 0) / 4);
  const outTok = Math.ceil((outChars || 0) / 4);
  const [pi, po] = PRICE[model] || DEFAULT_PRICE;
  d.calls += 1;
  d.inTok += inTok;
  d.outTok += outTok;
  d.usd += (inTok * pi + outTok * po) / 1e6;
  writeRaw(d);
  return d;
}

export function getUsage() {
  const d = load();
  const usd = Math.round(d.usd * 10000) / 10000;
  return { date: d.date, calls: d.calls, inTokens: d.inTok, outTokens: d.outTok, usd, cap: CAP, remaining: Math.max(0, Math.round((CAP - usd) * 10000) / 10000), pct: CAP ? Math.min(100, Math.round((100 * usd) / CAP)) : 0, over: usd >= CAP };
}

// True while today's estimated spend is under the cap. Gates live LLM calls.
export function underCap() {
  return load().usd < CAP;
}
