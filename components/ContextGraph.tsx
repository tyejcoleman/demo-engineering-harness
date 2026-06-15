"use client";

import { useEffect, useRef, useState } from "react";

export type GNode = { id: string; type: string; label: string };
export type GEdge = { from: string; to: string; rel?: string };
export type Graph = { nodes: GNode[]; edges: GEdge[]; trail?: string[] };

// Palette: each entity type owns a colour; the active trail glows, everything else dims.
const COLOR: Record<string, string> = {
  account: "#6d4bff", // the hero record
  ticket: "#8593ad",
  concern: "#e89a16",
  policy: "#4f7df0",
  strategy: "#7c5cff",
  chosen: "#15a35b", // best / selected
  twin: "#e85ada", // the simulated customer (digital twin)
  action: "#0f9d8f",
  outcome: "#15a35b",
};
const DIM = "#aeb8cc"; // off-trail nodes/links, muted on the light canvas
const LEGEND: [string, string][] = [
  ["account", "account"],
  ["ticket", "ticket"],
  ["concern", "concern"],
  ["policy", "policy"],
  ["strategy", "strategy"],
  ["chosen", "best fit"],
  ["twin", "customer twin"],
  ["action", "action"],
  ["outcome", "outcome"],
];
const EXPLAIN: Record<string, string> = {
  account: "The customer's live CRM account — fetched via MCP crm.read the moment the call connected.",
  ticket: "An open support ticket on this account, giving the agent prior context before they speak.",
  concern: "What the customer actually raised on the call, captured live from the transcript.",
  policy: "A grounding policy pulled from the knowledge base so the next action is justified, not improvised.",
  strategy: "A candidate resolution, scored against a simulated model of this specific customer.",
  chosen: "The strategy the outcome simulation predicts is most likely to keep this customer.",
  twin: "A digital twin of this customer — each candidate strategy is scored against it to predict the save rate before acting.",
  action: "The concrete action taken — requested, approved and audited through the governance ledger.",
  outcome: "The post-call disposition and QA score for this contact.",
};

type Detail =
  | { kind: "node"; id: string; type: string; label: string; conns: { rel: string; id: string; type: string; label: string }[] }
  | { kind: "edge"; rel: string; sourceLabel: string; targetLabel: string };

// 3D force-graph: white-pill labels rendered on top, a glowing
// reasoning trail with streaming particles, click-to-fly, and a node detail popup. Non-trail nodes dim
// and drop their labels so the active path stays legible instead of turning into a hairball.
export function ContextGraph({ graph }: { graph: Graph }) {
  const elRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<any>(null);
  const graphRef = useRef<Graph>(graph);
  graphRef.current = graph;
  const [detail, setDetail] = useState<Detail | null>(null);
  const nodeMap = useRef<Map<string, any>>(new Map());
  // Persistent node/link objects keyed by id — reusing the SAME object across updates lets the force
  // engine keep each node's position, so NEW nodes animate in (grow) instead of the whole graph snapping.
  const nodeObjs = useRef<Map<string, any>>(new Map());
  const linkObjs = useRef<Map<string, any>>(new Map());
  const prevCount = useRef(0);

  const connsOf = (id: string) => {
    const g = graphRef.current;
    const out: { rel: string; id: string; type: string; label: string }[] = [];
    g.edges.forEach((e) => {
      if (e.from === id) {
        const n = g.nodes.find((x) => x.id === e.to);
        if (n) out.push({ rel: e.rel || "→", id: n.id, type: n.type, label: n.label });
      } else if (e.to === id) {
        const n = g.nodes.find((x) => x.id === e.from);
        if (n) out.push({ rel: e.rel || "→", id: n.id, type: n.type, label: n.label });
      }
    });
    return out;
  };

  const flyTo = (n: any) => {
    const fg = fgRef.current;
    if (!fg || n?.x == null) return;
    const hyp = Math.hypot(n.x, n.y, n.z || 0) || 1;
    const r = (hyp + 210) / hyp;
    fg.cameraPosition({ x: n.x * r, y: n.y * r, z: (n.z || 1) * r }, n, 800);
  };

  const focusNode = (id: string) => {
    const n = nodeMap.current.get(id);
    const g = graphRef.current;
    const meta = g.nodes.find((x) => x.id === id);
    if (!meta) return;
    if (n) flyTo(n);
    setDetail({ kind: "node", id, type: meta.type, label: meta.label, conns: connsOf(id) });
  };

  const apply = () => {
    const fg = fgRef.current;
    if (!fg) return;
    const g = graphRef.current;
    const trail = new Set(g.trail || []);
    // Reuse existing node objects (keeps x/y/z) and only mint new ones — so the graph GROWS smoothly.
    const nodes = g.nodes.map((n) => {
      const ex = nodeObjs.current.get(n.id);
      if (ex) {
        ex.type = n.type;
        ex.label = n.label;
        ex.onTrail = trail.has(n.id);
        return ex;
      }
      const nn = { id: n.id, type: n.type, label: n.label, onTrail: trail.has(n.id) };
      nodeObjs.current.set(n.id, nn);
      return nn;
    });
    const liveIds = new Set(g.nodes.map((n) => n.id));
    for (const id of [...nodeObjs.current.keys()]) if (!liveIds.has(id)) nodeObjs.current.delete(id);
    const links = g.edges.map((e) => {
      const key = e.from + ">" + e.to;
      const lit = trail.has(e.from) && trail.has(e.to);
      const ex = linkObjs.current.get(key);
      if (ex) {
        ex.rel = e.rel || "";
        ex.lit = lit;
        return ex;
      }
      const nl = { source: e.from, target: e.to, rel: e.rel || "", lit };
      linkObjs.current.set(key, nl);
      return nl;
    });
    const liveLinks = new Set(g.edges.map((e) => e.from + ">" + e.to));
    for (const k of [...linkObjs.current.keys()]) if (!liveLinks.has(k)) linkObjs.current.delete(k);
    fg.graphData({ nodes, links });
    nodeMap.current = new Map(nodes.map((n: any) => [n.id, n]));
    // Only refit the camera when the graph actually grew, so it doesn't jump on every refresh.
    if (g.nodes.length !== prevCount.current) {
      prevCount.current = g.nodes.length;
      setTimeout(() => {
        try {
          fg.zoomToFit(700, 40);
        } catch {
          /* ignore */
        }
      }, 700);
    }
  };

  useEffect(() => {
    let dead = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      const ForceGraph3D: any = (await import("3d-force-graph")).default;
      const SpriteText: any = (await import("three-spritetext")).default;
      if (dead || !elRef.current) return;
      const el = elRef.current;
      const fg = new ForceGraph3D(el)
        .backgroundColor("rgba(0,0,0,0)")
        .showNavInfo(false)
        .nodeRelSize(4)
        .nodeResolution(18)
        .nodeOpacity(0.96)
        .nodeColor((n: any) => (n.onTrail ? COLOR[n.type] || "#9aa6c0" : DIM))
        .nodeVal((n: any) => (n.type === "account" ? 16 : n.onTrail ? 7 : 2.4))
        .nodeLabel((n: any) =>
          `<div style="background:#fff;border:1px solid #e4e9f2;box-shadow:0 8px 22px rgba(16,24,48,.12);padding:6px 9px;border-radius:8px;font:600 12px Inter,system-ui;color:#16213e"><span style="color:${COLOR[n.type] || "#64748b"}">${n.type}</span> · ${n.label}</div>`
        )
        .nodeThreeObjectExtend(true)
        .nodeThreeObject((n: any) => {
          // focus mode: only label the active trail, so the graph never turns into a hairball
          if (!n.onTrail) return undefined;
          const s: any = new SpriteText(String(n.label || "").slice(0, 26));
          s.color = "#16213e";
          s.backgroundColor = "rgba(255,255,255,0.95)";
          s.borderColor = "#dfe6f2";
          s.borderWidth = 0.6;
          s.borderRadius = 3;
          s.padding = 2.6;
          s.fontFace = "Inter, system-ui, sans-serif";
          s.fontWeight = "600";
          s.textHeight = n.type === "account" ? 6 : 4.6;
          s.position.set(0, n.type === "account" ? 13 : 8.5, 0);
          const mat = s.material;
          if (mat) {
            mat.depthTest = false;
            mat.depthWrite = false;
            mat.transparent = true;
          }
          s.renderOrder = 999;
          return s;
        })
        .linkLabel((l: any) => (l.rel ? `<div style="background:#fff;border:1px solid #e4e9f2;padding:4px 7px;border-radius:7px;font:600 11px Inter;color:#16213e">${l.rel}</div>` : ""))
        .linkColor((l: any) => (l.lit ? "#6d4bff" : "#d6deec"))
        .linkWidth((l: any) => (l.lit ? 1.7 : 0.4))
        .linkDirectionalParticles((l: any) => (l.lit ? 3 : 0))
        .linkDirectionalParticleWidth(2.3)
        .linkDirectionalParticleSpeed(0.011)
        .onNodeClick((n: any) => focusNode(n.id))
        .onLinkClick((l: any) =>
          setDetail({ kind: "edge", rel: l.rel || "relates", sourceLabel: l.source?.label || "", targetLabel: l.target?.label || "" })
        )
        .onBackgroundClick(() => setDetail(null))
        .dagMode("td")
        .dagLevelDistance(46)
        .width(el.clientWidth)
        .height(el.clientHeight);
      try {
        const c = fg.controls();
        c.autoRotate = true;
        c.autoRotateSpeed = 0.32;
      } catch {
        /* controls not ready */
      }
      try {
        fg.cooldownTicks(120);
        fg.onEngineStop(() => {
          try {
            fg.zoomToFit(500, 36);
          } catch {
            /* ignore */
          }
        });
        fg.d3Force("charge").strength(-95);
      } catch {
        /* layout tuning best-effort */
      }
      fgRef.current = fg;
      apply();
      ro = new ResizeObserver(() => {
        if (elRef.current) {
          fg.width(elRef.current.clientWidth);
          fg.height(elRef.current.clientHeight);
        }
      });
      ro.observe(el);
    })();
    return () => {
      dead = true;
      ro?.disconnect();
      try {
        fgRef.current?._destructor?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    apply();
    // if the selected node still exists, refresh its connections; otherwise drop the popup
    setDetail((d) => {
      if (d?.kind === "node") {
        const still = graphRef.current.nodes.find((x) => x.id === d.id);
        return still ? { ...d, conns: connsOf(d.id) } : null;
      }
      return d;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={elRef} className="h-full w-full" />

      {/* hint */}
      <div className="pointer-events-none absolute right-3 top-3 text-[10px] text-muted/80">click a node to trace it</div>

      {/* legend */}
      <div className="pointer-events-none absolute bottom-2.5 left-3 flex max-w-[60%] flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted">
        {LEGEND.map(([t, l]) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[t] }} />
            {l}
          </span>
        ))}
      </div>

      {/* detail popup */}
      {detail && (
        <div className="fadeup card absolute bottom-3 right-3 z-20 w-72 p-3.5 shadow-xl">
          <div className="flex items-center justify-between">
            {detail.kind === "node" ? (
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fg/90">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[detail.type] || "#9aa6c0" }} />
                {detail.type}
              </span>
            ) : (
              <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[11px] text-accent2">relation · {detail.rel}</span>
            )}
            <button onClick={() => setDetail(null)} className="text-xs text-muted transition hover:text-fg">
              close ✕
            </button>
          </div>

          {detail.kind === "node" ? (
            <>
              <div className="mt-2 text-sm font-semibold text-fg">{detail.label}</div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{EXPLAIN[detail.type] || "A node in the live reasoning graph."}</p>
              {detail.conns.length > 0 && (
                <>
                  <div className="mb-1 mt-3 text-[10px] uppercase tracking-wider text-muted">connections · {detail.conns.length}</div>
                  <div className="max-h-36 space-y-1 overflow-auto pr-1">
                    {detail.conns.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => focusNode(c.id)}
                        className="flex w-full items-center gap-2 rounded-lg border border-edge bg-panel2 px-2 py-1.5 text-left transition hover:bg-panel"
                      >
                        <span className="shrink-0 rounded-full border border-accent/40 px-1.5 py-0.5 text-[9px] text-accent2">{c.rel}</span>
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR[c.type] || "#9aa6c0" }} />
                        <span className="truncate text-xs text-fg/90">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="mt-2 text-sm font-semibold text-fg">
                {detail.sourceLabel} <span className="text-muted">—{detail.rel}→</span> {detail.targetLabel}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">How this fact feeds the next step in the reasoning trail.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
