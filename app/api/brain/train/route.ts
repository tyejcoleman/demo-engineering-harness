import { sseEvent } from "@/core/sse.mjs";
import { trainRounds, judgeBrain, resetBrain, baselineScore } from "@/core/brain.mjs";
import { recordAudit } from "@/core/audit.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

// Stream the brain's learning loop: per-round training on the context graph, then a judge meta-pass.
// MANDATE FRESH: every run resets the brain first (no cached priors) and measures a fresh untrained
// baseline, so the before→after story is always honest and never reflects a previous run.
export async function GET(req: Request) {
  const rounds = Math.max(1, Math.min(20, Number(new URL(req.url).searchParams.get("rounds")) || 8));
  recordAudit({ actor: "operator", action: "brain.train", detail: `${rounds} rounds + judge (fresh)` });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseEvent(event, data)));
      resetBrain(); // wipe any prior training — every run starts cold
      send("baseline", { success: baselineScore(400) }); // honest pre-training answer, computed fresh
      for (let i = 0; i < rounds; i++) {
        trainRounds(1, 160, (ev: unknown) => send("round", ev));
        await new Promise((r) => setTimeout(r, 230));
      }
      send("phase", { name: "judge" });
      const j = await judgeBrain();
      recordAudit({ actor: "claude-code", action: "brain.judge", detail: `success ${j.before}% → ${j.after}%` });
      send("judge", j);
      send("done", { ok: true });
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform, no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
