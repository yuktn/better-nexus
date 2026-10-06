import { configPath, tokenPath } from "./config.js";
import { writeFile, readFile } from "node:fs/promises";
import si, { cpuFlags } from 'systeminformation';
import {
    type Heartbeat,
} from "@better-nexus/shared";

async function getMemoryLoad(): Promise<number> {
    const mem = await si.mem();

    return Math.round(
        (mem.active / mem.total) * 100
    );
}

async function getCpuLoad(): Promise<number> {
    const cpu = await si.currentLoad();

    return Math.round(cpu.currentLoad)
}

async function getTemp(): Promise<number> {
    const temp = await si.cpuTemperature();

    return Math.round(temp.main)
}


let agentId: string | undefined;
let agentSecret: string | undefined;
let agentName: string | undefined;
let serverUrl: string | undefined;

try {
    const fileContent = await readFile(configPath, "utf8");
    const secretContent = await readFile(tokenPath, "utf8");
    const config = JSON.parse(fileContent);

    agentSecret = secretContent.trim();
    agentId = config.agentId;
    agentName = config.agentName
    serverUrl = config.serverUrl

    console.log("Successfully retrieved Agent credentials:", agentId, agentName);
} catch (e) {
    console.log(e)
    console.log("No existing config found.");
    process.exit(1)
}

if (!agentId || !agentSecret || !agentName) {
    console.log("No existing config found.");
    process.exit(1)
}


const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

async function sendHeartbeat() {
    if (!agentId || !agentSecret) {
        throw new Error("Agent credentials are missing");
    }

    const heartbeat: Heartbeat = {
        temp: await getTemp(),
        cpu: await getCpuLoad(),
        memory: await getMemoryLoad(),
        timestamp: Date.now(),
    };

    const response = await fetch(`${serverUrl}/hb`, {
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

await heartbeatLoop();