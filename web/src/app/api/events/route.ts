import { nexusUrl } from "@/lib/nexus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  // Timeout only the connection attempt, not the long-lived response.
  const timeout = setTimeout(abort, 10_000);
  const cleanup = () => {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
    controller.abort();
  };

  try {
    const upstream = await fetch(nexusUrl("events"), {
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!upstream.ok || !upstream.body || !upstream.headers.get("content-type")?.includes("text/event-stream")) {
      cleanup();
      return new Response("Event stream unavailable", { status: 502 });
    }
    const reader = upstream.body.getReader();
    const stream = new ReadableStream<Uint8Array>({
      async pull(destination) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            cleanup();
            destination.close();
          } else destination.enqueue(value);
        } catch (error) {
          cleanup();
          destination.error(error);
        }
      },
      async cancel() {
        cleanup();
        await reader.cancel().catch(() => {});
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    cleanup();
    return new Response("Event stream unavailable", { status: 502 });
  }
}
