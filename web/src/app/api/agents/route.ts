import { getDashboardSnapshot } from "@/lib/nexus";

export async function GET() {
  try {
    return Response.json(await getDashboardSnapshot(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Agents unavailable." }, { status: 502 });
  }
}
