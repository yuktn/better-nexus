import {
    type Heartbeat, HeartbeatSchema,
    type Agent, AgentSchema,
    type AgentRegisterRequest, AgentRegisterRequestSchema,
    type AgentUpdateRequest, AgentUpdateRequestSchema,
    type HeartbeatRequest, HeartbeatRequestSchema,
    type AgentInfo, AgentInfoSchema,
    type AgentDocument,
    type HeartbeatDocument,
    type EnrollmentToken,
    type Status, type Reason,
    type AgentStatusChange,
    type Incident,
    type IncidentSeverity,
    type IncidentReason
} from '@better-nexus/shared';
import { initDb, heartbeats, enrollmentTokens, incidents, agents, agentStatusChanges } from "./db.js";
import { addSseClient, removeSseClient, sendSseEvent } from './sse.js';

export class IncidentManager {
    async addIncident(agentId: string, message: string, reason: IncidentReason, startedAt: Date, nextStatus: Status) {
        if (nextStatus == "UP") return;

        const incidentId = crypto.randomUUID();

        if (await incidents.findOne({
            agentId,
            reason,
            status: "open"
        })) return;

        const incident: Incident = {
            incidentId,
            agentId,
            status: "open",
            severity: nextStatus,
            reason,
            messages: [{ message, timestamp: new Date() }],
            startedAt,
            createdAt: new Date(),
            updatedAt: new Date(),
            resolvedAt: null
        }

        sendSseEvent("incidentUpdate", incident)

        await incidents.insertOne(incident)
    }

    async addMessage(incidentId: string, message: string, date: Date) {
        //TODO: implement add message
    }

    async resolveIncident(incidentId: string, agentId: string) {
        const incident = await incidents.findOneAndUpdate(
            {
                incidentId,
                agentId,
                status: "open"
            },
            {
                $set: {
                    status: "resolved",
                    updatedAt: new Date(),
                    resolvedAt: new Date()
                }
            },
            {
                returnDocument: "after"
            }
        );

        if (!incident) return;

        sendSseEvent("incidentUpdate", incident);
    }
}

export const incidentManager = new IncidentManager();