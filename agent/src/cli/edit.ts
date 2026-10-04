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
    let serverUrl: string | undefined

    try {
        const fileContent = await readFile("./config.json", "utf8");
        const secretContent = await readFile("./agent.token", "utf8");
        const config = JSON.parse(fileContent);

        agentSecret = secretContent.trim();
        agentId = config.agentId;
        agentName = config.agentName;
        agentNexusVersion = config.agentNexusVersion;
        platform = config.platform;
        serverUrl = config.serverUrl;
    } catch (e) {
        cancel('no agent credentials - run setup!')
        process.exit(0)
    }

    if (!agentId || !agentSecret || !agentName) {
        cancel('no agent credentials - run setup!')
        process.exit(0)
    }

    const field = await select({
        message: `which field do you want to edit?`,
        options: [
            { value: 'agentName', label: `name`, hint: `currently ${agentName}` },
            { value: 'serverUrl', label: `server url`, hint: `currently ${serverUrl}` },
        ],
    });

    if (isCancel(field)) {
        cancel('SIGINT');
        process.exit(0);
    }

    //for only local changes
    if (field === "serverUrl") {
        const newValue = await text({
            message: `what is the new value of ${field}?`
        })

        if (isCancel(newValue)) {
            cancel('SIGINT')
            process.exit(0)
        }

        try {
            const fileContent = await readFile("./config.json", "utf8");

            const config = AgentInfoSchema.parse(JSON.parse(fileContent));

            const newConfig = AgentInfoSchema.parse({
                ...config,
                [field]: newValue,
            });

            await writeFile(
                "./config.json",
                JSON.stringify(newConfig, null, 2),
                "utf8"
            );
            log.message(`agent update was successful, ${field} was changed to ${newValue}!`)
            process.exit(0)
        } catch (e) {
            s.stop('local update failed.');
            cancel('the update was not completed.');
            process.exit(1);
        }
    }

    const newValue = await text({
        message: `what is the new value of ${field}?`
    })

    if (isCancel(newValue)) {
        cancel('SIGINT')
        process.exit(0)
    }

    const req: AgentUpdateRequest = {
        field,
        newValue
    }

    s.start('requesting to server...')

    const response = await fetch(`${serverUrl}/agents`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${agentSecret}`,
            "X-Nexus-Agent-ID": agentId,
        },
        body: JSON.stringify(req)
    });

    if (!response.ok) {
        cancel('error while editing');
        process.exit(0);
    }


    const data = await response.json()

    try {
        const fileContent = await readFile("./config.json", "utf8");

        const config = AgentInfoSchema.parse(JSON.parse(fileContent));

        const newConfig = AgentInfoSchema.parse({
            ...config,
            [data.data.field]: data.data.newValue,
        }); //spread, spread, spread. data.data.data.

        await writeFile(
            "./config.json",
            JSON.stringify(newConfig, null, 2),
            "utf8"
        );
    } catch (e) {
        s.stop('Server updated, local update failed');
        cancel('config.json is stale.');
        process.exit(1);
    }

    s.stop('Success!')

    log.message(`agent update was successful, ${field} was changed to ${newValue}!`)

} catch (e) {
    cancel('error while enrolling: ' + e);
    process.exit(0);
}

outro(`See you next time...`);