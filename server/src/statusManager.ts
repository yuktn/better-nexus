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
import { initDb, heartbeats, enrollmentTokens, agents, agentStatusChanges } from "./db.js";
import { addSseClient, removeSseClient, sendSseEvent } from './sse.js';

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

        let nextStatus: Status = "UP";
        let reason: Reason | undefined;
        let message: string | undefined;

        if (heartbeat.cpu >= 90) {
            nextStatus = "DEGRADED";
            reason = "CPU_HI";
            message = "CPU usage is too high.";
        } else if (heartbeat.memory >= 90) {
            nextStatus = "DEGRADED";
            reason = "MEM_HI";
            message = "Memory usage is too high.";
        } else if (heartbeat.temp >= 90) {
            nextStatus = "DEGRADED";
            reason = "TEMP_HI";
            message = "Temperature is too high."
        }

        //genius
        if (agent.status !== nextStatus) {
            await changeAgentStatus(
                agentId,
                nextStatus,
                reason
            );
        }
    }

    async intervalCheckup() {
        //if agent lastSeenOn is larger than 10s, down
        const agentArray = await agents.find().toArray()

        for (const agent of agentArray) {
            if (Date.now() - agent.lastSeenOn > 10_000 && agent.status !== "DOWN") 
                {changeAgentStatus(agent.agentId, "DOWN", "TIMEOUT")}
        }
    }
}

export const statusManager = new StatusManager();