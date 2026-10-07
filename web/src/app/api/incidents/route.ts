import { getIncidents } from "@/lib/nexus";
import { INCIDENT_PAGE_SIZE } from "@/lib/incidents";

export async function GET(request: Request) {
  const countCap = Number(new URL(request.url).searchParams.get("countCap") ?? INCIDENT_PAGE_SIZE + 1);
  if (!Number.isSafeInteger(countCap) || countCap < 1) {
    return Response.json({ error: "countCap must be a positive integer." }, { status: 400 });
  }
  try {
    return Response.json(await getIncidents(countCap), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Incidents unavailable." }, { status: 502 });
  }
}
