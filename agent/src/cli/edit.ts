import { intro, cancel, text, outro, log, spinner, select, isCancel } from '@clack/prompts';
import { writeFile, readFile } from "node:fs/promises";
import {
    type AgentRegisterRequest, AgentRegisterRequestSchema,
    type AgentInfo, AgentInfoSchema,
    type AgentUpdateRequest, AgentUpdateRequestSchema
} from '@better-nexus/shared';

const s = spinner();

intro(`edit the info of your nexus agent`);

try {

    let agentId: string | undefined;
    let agentSecret: string | undefined;
    let agentName: string | undefined;
    let agentNexusVersion: string | undefined;
    let platform: string | undefined;

    try {
        const fileContent = await readFile("./config.json", "utf8");
        const secretContent = await readFile("./agent.token", "utf8");
        const config = JSON.parse(fileContent);

        agentSecret = secretContent.trim();
        agentId = config.agentId;
        agentName = config.agentName;
        agentNexusVersion = config.agentNexusVersion;
        platform = config.platform;
    } catch (e) {
        cancel('no agent credentials - run setup!')
        process.exit(0)
    }

    if (!agentId || !agentSecret || !agentName) {
        cancel('no agent credentials - run setup!')
        process.exit(0)
    }
} catch (e) {
    cancel('error while enrolling: ' + e);
    process.exit(0);
}

outro(`See you next time...`);