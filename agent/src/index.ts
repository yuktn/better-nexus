import { writeFile, readFile } from "node:fs/promises";

import {
    type AgentRegisterRequest,
    type Heartbeat,
} from "@better-nexus/shared";

const port = process.env.PORT ? Number(process.env.PORT) : 8081;

let agentId: string | undefined;

try {
    const fileContent = await readFile("./config.json", "utf8");
    const config = JSON.parse(fileContent);

    agentId = config.agentId;

    console.log("Successfully retrieved Agent ID:", agentId);
} catch {
    console.log("No existing config found.");
}

async function registerAgent(): Promise<string> {
    const reg: AgentRegisterRequest = {
        agentName: "testDevice",
        agentNexusVersion: "0.1.0",
        platform: "linux",
    };

    const response = await fetch(`http://localhost:${port}/agents/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(reg),
    });

    if (!response.ok) {
        throw new Error(`Registration failed: ${response.status}`);
    }

    const responseData = await response.json();

    const newAgentId = responseData.data.agentId;

    await writeFile(
        "./config.json",
        JSON.stringify(responseData.data, null, 2),
        "utf8"
    );

    console.log("Successfully registered:", newAgentId);

    return newAgentId;
}

const sleep = (ms: number) =>
    new Promise(resolve => setTimeout(resolve, ms));

async function sendHeartbeat() {
    if (!agentId) {
        throw new Error("Agent ID is missing");
    }

    const heartbeat: Heartbeat = {
        agentId,
        temp: 42,
        cpu: 10,
        memory: 25,
        timestamp: Date.now(),
    };

    const response = await fetch(`http://localhost:${port}/hb`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(heartbeat),
    });

    if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.status}`);
    }

    console.log("heartbeat sent");
}

async function heartbeatLoop() {
    while (true) {
        try {
            await sendHeartbeat();
        } catch (err) {
            console.error(err);
        }

        await sleep(3000);
    }
}

if (!agentId) {
    agentId = await registerAgent();
}

await heartbeatLoop();