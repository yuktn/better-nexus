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
    async addIncident(agentId: string, message: string, reason: IncidentReason, startedAt: Date, nextStatus: Status ) {
        const incidentId = crypto.randomUUID();

        const incident: Incident = {
            incidentId,
            agentId,
            status: "open",
            severity: "DEGRADED",
            reason,
            message,
            startedAt,
            createdAt: new Date(),
            updatedAt: new Date(),
            resolvedAt: null

        }
    }
}

export const incidentManager = new IncidentManager();