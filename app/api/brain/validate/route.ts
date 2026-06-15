import { sseEvent } from "@/core/sse.mjs";
import { validate } from "@/core/brain.mjs";
import { recordAudit } from "@/core/audit.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Stream the generalization test: real Monte-Carlo trials on unseen data, revealed in batches so the
// success rate climbs and the context graph refills live (proving it's computed, not hardcoded).
export async function GET(req: Request) {
  const samples = Math.max(60, Math.min(2000, Number(new URL(req.url).searchParams.get("samples")) || 600));
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseEvent(event, data)));
      const batchQueue: unknown[] = [];
      const result = validate(samples, (ev: unknown) => batchQueue.push(ev));
      if ((result as { error?: string }).error) {
        send("error", result);
        send("done", { ok: false });
        controller.close();
        return;
      }
      // pace the (already-computed) batches so the user watches it test in real time
      for (const ev of batchQueue) {
        send("batch", ev);
        await new Promise((r) => setTimeout(r, 130));
      }
      recordAudit({ actor: "operator", action: "brain.validate", detail: `${result.success}% on ${result.samples} unseen vs ${result.baseline}% baseline` });
      send("result", result);
      send("done", { ok: true });
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform, no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
