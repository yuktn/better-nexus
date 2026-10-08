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
    type AgentStatusChange
} from '@better-nexus/shared';
import { initDb, heartbeats, enrollmentTokens, agents, agentStatusChanges, incidents } from "./db.js";
import { addSseClient, removeSseClient, sendSseEvent } from './sse.js';
import { incidentManager } from './incidentManager.js';

async function changeAgentStatus(agentId: string, newStatus: Status, reason?: Reason) {
    const statusChange: AgentStatusChange = {
        agentId,
        newStatus,
        ...(reason && { reason }),
        timestamp: new Date()
    }

    await agents.findOneAndUpdate({ agentId },
        { $set: { status: newStatus } },
        { returnDocument: 'after' })

    await agentStatusChanges.insertOne(statusChange)

    sendSseEvent("statusChange", statusChange)
}

export class StatusManager {
    async onHeartbeat(agentId: string, heartbeat: Heartbeat) {
        const agent = await agents.findOne({ agentId });

        if (!agent) return;

        const conditions = [
            {
                active: heartbeat.cpu >= 90,
                reason: "CPU_HI" as const,
                severity: "DEGRADED" as const,
                message: "The system automatically detected an incident, caused by high CPU usage.",
                title: "High CPU Usage"
            },
            {
                active: heartbeat.memory >= 90,
                reason: "MEM_HI" as const,
                severity: "DEGRADED" as const,
                message: "The system automatically detected an incident, caused by high memory usage.",
                title: "High Memory Usage"
            },
            {
                active: heartbeat.temp >= 90,
                reason: "TEMP_HI" as const,
                severity: "DEGRADED" as const,
                message: "The system automatically detected an incident, caused by high temperature.",
                title: "High Temperature"
            }
        ];

        for (const condition of conditions) {
            const existing = await incidents.findOne({
                agentId,
                reason: condition.reason,
                status: "open"
            });

            if (condition.active && !existing) {
                await incidentManager.addIncident(
                    agentId,
                    condition.message,
                    condition.reason,
                    new Date(),
                    condition.severity,
                    condition.title,
                );
            }

            if (!condition.active && existing) {
                await incidentManager.resolveIncident(
                    existing.incidentId,
                    agentId
                );
            }
        }

        const timeoutIncident = await incidents.findOne({
            agentId,
            reason: "TIMEOUT",
            status: "open"
        });

        if (timeoutIncident) {
            await incidentManager.resolveIncident(
                timeoutIncident.incidentId,
                agentId
            );
        }

        const activeIncidents = await incidents.find({
            agentId,
            status: "open"
        }).toArray();

        let nextStatus: Status = "UP";

        if (activeIncidents.some(i => i.severity === "DOWN")) {
            nextStatus = "DOWN";
        } else if (activeIncidents.some(i => i.severity === "DEGRADED")) {
            nextStatus = "DEGRADED";
        }

        if (agent.status !== nextStatus) {
            await changeAgentStatus(agentId, nextStatus);
        }
    }

    async intervalCheckup() {
        //if agent lastSeenOn is larger than 10s, down
        const agentArray = await agents.find().toArray()

        for (const agent of agentArray) {
            if (Date.now() - agent.lastSeenOn > 10_000 && agent.status !== "DOWN") {
                await changeAgentStatus(agent.agentId, "DOWN", "TIMEOUT")
                await incidentManager.addIncident(agent.agentId, "The server isn't getting responses from this agent.", "TIMEOUT", new Date(), "DOWN", "Agent Unreachable")
            }
        }
    }
}

export const statusManager = new StatusManager();