import { intro, cancel, text, outro, log, spinner, select, isCancel } from '@clack/prompts';
import { writeFile, readFile } from "node:fs/promises";
import {
    type AgentRegisterRequest, AgentRegisterRequestSchema,
    type AgentInfo, AgentInfoSchema,
} from '@better-nexus/shared';

const s = spinner();

intro(`setup your nexus agent`);

try {

    const token = await text({ message: 'insert enrollment token here! (run nexus-server enroll if you do not have one!)' })

    if (isCancel(token)) {
        cancel('SIGINT');
        process.exit(0);
    }

    const osPlatform = process.platform;

    let platPh: string;

    if (osPlatform === 'win32') {
        platPh = "Windows"
    } else if (osPlatform === 'darwin') {
        platPh = "MacOS"
    } else if (osPlatform === 'linux') {
        platPh = "Linux"
    } else {
        cancel('unsupported platform: ' + osPlatform);
        process.exit(0);
    }

    const agentName = await text({ message: 'what is the name of your agent?' })

    if (isCancel(agentName)) {
        cancel('SIGINT');
        process.exit(0);
    }

    const platform = await select({
        message: `what is the platform of your agent? (we detected ${platPh}!)`,
        options: [
            { value: 'mac', label: 'MacOS' },
            { value: 'linux', label: 'Linux' },
            { value: 'windows', label: 'Windows' },
        ],
    });

    if (isCancel(platform)) {
        cancel('SIGINT');
        process.exit(0);
    }

    const request: AgentRegisterRequest = {
        agentName,
        agentNexusVersion: "v0.1.0",
        platform,
    }

    s.start('requesting to server...')

    const response = await fetch(`http://localhost:8081/agents`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(request)
    });

    if (!response.ok) {
        throw new Error(`Registration failed: ${response.status}`);
    }

    s.stop('Success!');

    const responseData = await response.json();

    const {
        agentName: spAgentName,
        agentSecret,
        agentId,
        agentNexusVersion,
        platform: spPlatform
    } = responseData.data;

    const agentInfo: AgentInfo = {
        agentName: spAgentName,
        agentNexusVersion,
        agentId,
        platform: spPlatform
    }


    await writeFile(
        "../../config.json",
        JSON.stringify(agentInfo, null, 2),
        "utf8"
    );

    await writeFile(
        "../../agent.token",
        agentSecret,
        {
            encoding: "utf8",
            mode: 0o600,
        }
    );
} catch (e) {
    cancel('error while enrolling: ' + e);
    process.exit(0);
}

outro(`See you next time...`);