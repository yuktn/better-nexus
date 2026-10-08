import { getIncidents } from "@/lib/nexus";
import { INCIDENT_PAGE_SIZE } from "@/lib/incidents";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  if (status !== null && status !== "open" && status !== "resolved") {
    return Response.json({ error: "Invalid incident status." }, { status: 400 });
  }
  const allOpen = status === "open" && !params.has("batch") && !params.has("page");
  let batch: number | undefined;
  let page: number | undefined;
  if (!allOpen) {
    batch = Number(params.get("batch") ?? INCIDENT_PAGE_SIZE);
    page = Number(params.get("page") ?? 1);
    if (!Number.isSafeInteger(batch) || batch < 1 || !Number.isSafeInteger(page) || page < 1) {
      return Response.json({ error: "batch and page must be positive integers." }, { status: 400 });
    }
  }
  try {
    return Response.json(await getIncidents(batch, page, status ?? undefined), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Incidents unavailable." }, { status: 502 });
  }
}
