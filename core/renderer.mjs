// Framework-agnostic generative-UI contract.
// The agent (Claude Code / an LLM) emits PanelSpec JSON; repair() validates, coerces,
// and ALWAYS returns a renderable panel — unknown/hostile input degrades to a safe note.
// There is no code-exec path by construction. Imported by the React renderer AND node probes.

export const STREAM_TYPES = ["note", "plan", "step", "metric", "card", "citation"];
export const CANVAS_TYPES = ["doc", "table", "graph"];
export const KNOWN_TYPES = [...STREAM_TYPES, ...CANVAS_TYPES];

export function surface(type) {
  return CANVAS_TYPES.includes(type) ? "canvas" : "stream";
}

const str = (v, fallback = "") => (typeof v === "string" ? v : fallback);
const arr = (v) => (Array.isArray(v) ? v : []);

const NOTE_KINDS = ["info", "warn", "success", "error"];
const STEP_STATUS = ["pending", "active", "done", "failed"];

function safeNote(reason, original) {
  return {
    type: "note",
    kind: "warn",
    title: "Unrenderable panel",
    body: reason,
    _from: original && typeof original === "object" ? original.type ?? null : null,
  };
}

const repairers = {
  note: (p) => ({
    type: "note",
    kind: NOTE_KINDS.includes(p.kind) ? p.kind : "info",
    title: str(p.title) || undefined,
    body: str(p.body),
  }),
  plan: (p) => ({
    type: "plan",
    title: str(p.title) || undefined,
    steps: arr(p.steps).map((s) => str(s)).filter(Boolean),
  }),
  step: (p) => ({
    type: "step",
    label: str(p.label, "(step)"),
    status: STEP_STATUS.includes(p.status) ? p.status : "pending",
  }),
  metric: (p) => ({
    type: "metric",
    label: str(p.label, "(metric)"),
    value: p.value == null ? "—" : String(p.value),
    unit: str(p.unit) || undefined,
  }),
  card: (p) => ({
    type: "card",
    title: str(p.title, "(card)"),
    body: str(p.body),
    badge: str(p.badge) || undefined,
  }),
  citation: (p) => ({
    type: "citation",
    source: str(p.source, "source"),
    quote: str(p.quote),
    url: str(p.url) || undefined,
  }),
  doc: (p) => ({
    type: "doc",
    title: str(p.title) || undefined,
    body: str(p.body),
  }),
  table: (p) => ({
    type: "table",
    columns: arr(p.columns).map((c) => str(c)),
    rows: arr(p.rows).map((r) => arr(r).map((c) => (c == null ? "" : String(c)))),
  }),
  graph: (p) => ({
    type: "graph",
    nodes: arr(p.nodes).filter((n) => n && typeof n === "object"),
    links: arr(p.links).filter((l) => l && typeof l === "object"),
  }),
};

export function repair(panel) {
  if (!panel || typeof panel !== "object") return safeNote("Panel was not an object.", panel);
  if (!KNOWN_TYPES.includes(panel.type)) {
    return safeNote(`Unknown panel type: ${String(panel.type)}`, panel);
  }
  try {
    return repairers[panel.type](panel);
  } catch (e) {
    return safeNote(`Panel failed validation: ${String(e && e.message)}`, panel);
  }
}

export function repairAll(specs) {
  return arr(specs).map(repair);
}
