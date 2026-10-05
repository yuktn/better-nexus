import { getHistory } from "@/lib/nexus";
import { z } from "zod";

const rangeSchema = z.enum(["1M", "1H", "1D", "1W"]);

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const range = rangeSchema.safeParse(new URL(request.url).searchParams.get("range"));
  if (!z.uuidv4().safeParse(id).success || !range.success) {
    return Response.json({ error: "Invalid agent or history range." }, { status: 400 });
  }
  try {
    return Response.json({ data: await getHistory(id, range.data) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "History unavailable." }, { status: 502 });
  }
}
