import { sseEvent } from "@/core/sse.mjs";
import { streamDemo } from "@/core/demo.mjs";
import { getUsage } from "@/core/usage.mjs";
import { rateLimit, clientIp } from "@/core/ratelimit.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 180;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const live = url.searchParams.get("live") === "1";
  const premise = url.searchParams.get("premise");
  const title = url.searchParams.get("title");
  const starter = url.searchParams.get("starter") || undefined;
  const situation = premise ? { title: title || "Custom situation", premise, starter } : undefined;
  const encoder = new TextEncoder();

  // Cost guard + rate limit: a public link can't blow the daily budget or be hammered. Degrade
  // gracefully — emit one notice so the client can prompt Safe mode (deterministic replay).
  const rl = rateLimit(clientIp(req), { max: 12, windowMs: 60000 });
  const usage = getUsage();
  if (live && (usage.over || !rl.ok)) {
    const msg = usage.over
      ? `Daily demo budget reached ($${usage.usd}/$${usage.cap}). Turn on Safe mode to replay the last run, or try again tomorrow.`
      : `Too many calls in a short window. Use Safe mode (replay) or retry in ~${rl.retryAfter}s.`;
    const notice = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseEvent("ev", { kind: "notice", title: usage.over ? "Daily budget reached" : "Rate limited", body: msg })));
        controller.enqueue(encoder.encode(sseEvent("done", { ok: false })));
        controller.close();
      },
    });
    return new Response(notice, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      await streamDemo(
        (ev: unknown) => {
          try {
            controller.enqueue(encoder.encode(sseEvent("ev", ev)));
          } catch {
            /* client disconnected — enqueue on a closed stream */
          }
        },
        { live, situation, starter, signal: req.signal }
      );
      try {
        controller.enqueue(encoder.encode(sseEvent("done", { ok: true })));
        controller.close();
      } catch {
        /* already closed */
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform, no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
