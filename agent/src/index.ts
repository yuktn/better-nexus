import { writeFile, readFile } from "node:fs/promises";

import {
    type AgentRegisterRequest,
    type Heartbeat,
} from "@better-nexus/shared";

const port = process.env.PORT ? Number(process.env.PORT) : 8081;

let agentId: string | undefined;
let agentSecret: string | undefined;

try {
    const fileContent = await readFile("./config.json", "utf8");
    const config = JSON.parse(fileContent);

    agentId = config.agentId;
    agentSecret = config.agentSecret;

    console.log("Successfully retrieved Agent ID:", agentId);
} catch {
    console.log("No existing config found.");
}

async function registerAgent(): Promise<{
    agentId: string;
    agentSecret: string;
}> {
    const reg: AgentRegisterRequest = {
        agentName: "testDevice",
        agentNexusVersion: "0.1.0",
        platform: "linux",
    };

    const response = await fetch(`http://localhost:${port}/agents`, {
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
    const newAgentSecret = responseData.data.agentSecret;

    await writeFile(
        "./config.json",
        JSON.stringify(
            {
                agentId: newAgentId,
                agentSecret: newAgentSecret,
            },
            null,
            2
        ),
        "utf8"
    );

    console.log("Successfully registered:", newAgentId);

    return {
        agentId: newAgentId,
        agentSecret: newAgentSecret,
    };
}

const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

async function sendHeartbeat() {
    if (!agentId || !agentSecret) {
        throw new Error("Agent credentials are missing");
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
            "X-Nexus-Agent-ID": agentId,
            "Authorization": `Bearer ${agentSecret}`,
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

if (!agentId || !agentSecret) {
    const credentials = await registerAgent();

    agentId = credentials.agentId;
    agentSecret = credentials.agentSecret;
}

await heartbeatLoop();