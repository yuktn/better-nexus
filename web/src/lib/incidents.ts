import { IncidentSchema } from "@better-nexus/shared";
import { z } from "zod";

// Dates are serialized as ISO strings by both the API and SSE.
export const incidentSchema = IncidentSchema.extend({
  startedAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  messages: z.array(z.object({ message: z.string(), timestamp: z.iso.datetime() })),
});
export const incidentsSchema = z.array(incidentSchema);
export type DashboardIncident = z.infer<typeof incidentSchema>;
export const INCIDENT_PAGE_SIZE = 5;

export function mergeIncidents(current: DashboardIncident[], incoming: DashboardIncident[]) {
  const merged = new Map(current.map((incident) => [incident.incidentId, incident]));
  for (const incident of incoming) {
    const previous = merged.get(incident.incidentId);
    if (!previous || Date.parse(incident.updatedAt) >= Date.parse(previous.updatedAt)) {
      merged.set(incident.incidentId, incident);
    }
  }
  return Array.from(merged.values());
}
