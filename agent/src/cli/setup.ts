import { configDir, configPath, tokenPath } from "../config.js";
import { intro, cancel, text, outro, log, spinner, select, isCancel } from '@clack/prompts';
import { mkdir, writeFile, readFile } from "node:fs/promises";
import {
    type AgentRegisterRequest, AgentRegisterRequestSchema,
    type AgentInfo, AgentInfoSchema,
} from '@better-nexus/shared';

const s = spinner();

intro(`setup your nexus agent`);

try {
    await mkdir(configDir, { recursive: true });
    let serverUrl;

    while (true) {
        serverUrl = await text({ message: 'what is the address of your server?', placeholder: 'https://nexus.yuktn.dev' })

        if (isCancel(serverUrl)) {
            cancel('SIGINT');
            process.exit(0);
        }

        try {
            const url = new URL(serverUrl);

            if (url.protocol !== "http:" && url.protocol !== "https:") {
                throw new Error();
            }
        } catch {
            log.error("invalid server URL");
            continue;
        }

        s.start('verifying server')

        try {
            const response = await fetch(`${serverUrl}/health`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            s.stop('Success!')

            if (!response.ok) {
                throw new Error(`server check failed: ${response.status}`);
            }

            if ((await response.json()).nexus) {
                break;
            } else {
                log.message(`it seems like we can't reach ${serverUrl} or it isn't a valid nexus server url.. (is the main server on?)`)
            }
        } catch (e) {
            log.error('an error occurred while fetching.. try again')
            s.stop()
            continue;
        }
    }

    const token = await text({ message: 'insert enrollment token here! (run nexus-server on the server machine enroll if you do not have one!)' })

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

    const response = await fetch(`${serverUrl}/agents`, {
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

    const responseData = await response.json();

    s.stop('Success!');

    const {
        agentName: spAgentName,
        agentSecret,
        agentId,
        agentNexusVersion,
        platform: spPlatform
    } = responseData.data;

    const agentInfo = {
        agentName: spAgentName,
        agentNexusVersion,
        agentId,
        platform: spPlatform,
        serverUrl
    }


    await writeFile(
        configPath,
        JSON.stringify(agentInfo, null, 2),
        "utf8"
    );

    await writeFile(
        tokenPath,
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