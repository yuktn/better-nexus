import { intro, cancel, outro, text, log, spinner, isCancel, autocomplete, select, note } from '@clack/prompts';
import { apiPort, cliPort } from "../config.js";
import type { Incident } from '@better-nexus/shared';

interface SelectedIncidentValue {
    id: string;
    title: string;
    messages: { timestamp: string, message: string }[]
}

const s = spinner();

intro(`manage your incidents`);

try {
    s.start("requesting incidents")
    const response = await fetch(`http://127.0.0.1:${apiPort}/incidents`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    });

    if (!response.ok) {
        throw new Error(`Registration failed: ${response.status} ${await response.text()}`);
    }

    const responseData = await response.json();

    s.stop("")

    const responseInc = await autocomplete({
        message: 'Search and select an item:',
        options: responseData.data.map((incident: Incident) => ({
            value: { id: incident.incidentId, title: incident.title, messages: incident.messages },
            label: incident.title,
            hint: `${incident.status} | ${incident.severity}`,
        })),
        placeholder: 'Type to search...',
        maxItems: 10, // Limits visible rows at once
    });

    if (isCancel(responseInc)) {
        cancel("sigint")
        process.exit(1)
    }

    const selectedItem = responseInc as SelectedIncidentValue;

    const field = await select({
        message: "",
        options: [
            { value: "title", label: "title", hint: "edit the title of the incident" },
            { value: "message", label: "message", hint: "add a message to the incident" }
        ]
    })
    if (isCancel(field)) {
        cancel("sigint")
        process.exit(1)
    }

    switch (field) {
        case "title":

            note(selectedItem.title, 'current title')

            const titleValue = await text({
                message: `editing title to:`
            })

            if (isCancel(titleValue)) {
                cancel("sigint")
                process.exit(1)
            }

            const token = await text({ message: "input your OTP token here!" })

            if (isCancel(token)) {
                cancel("sigint")
                process.exit(1)
            }

            s.start('requesting enrollment to server')

            const apiResponse = await fetch(
                `http://127.0.0.1:${cliPort}/admin/incidents`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        incidentId: selectedItem.id,
                        field,
                        value: titleValue
                    })
                }
            );

            if (!apiResponse.ok) {
                throw new Error(`Incident update failed: ${apiResponse.status}`);
            }

            s.stop('Success!')

            break;
        case "message":

            let existingMessagesSummary = "no previous messages.";

            if (selectedItem.messages && selectedItem.messages.length > 0) {
                existingMessagesSummary = selectedItem.messages
                    .map(msg => {
                        const time = new Date(msg.timestamp).toLocaleString();
                        return `[${time}] ${msg.message}`;
                    })
                    .join('\n');
            }

            note(existingMessagesSummary, "previous messages");

            const messageValue = await text({
                message: `adding message: `
            })

            if (isCancel(messageValue)) {
                cancel("sigint")
                process.exit(1)
            }

            const msgtoken = await text({ message: "input your OTP token here!" })

            if (isCancel(msgtoken)) {
                cancel("sigint")
                process.exit(1)
            }

            s.start('requesting enrollment to server')

            const msgResponse = await fetch(
                `http://127.0.0.1:${cliPort}/admin/incidents`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${msgtoken}`
                    },
                    body: JSON.stringify({
                        incidentId: selectedItem.id,
                        field,
                        value: messageValue
                    })
                }
            );

            if (!msgResponse.ok) {
                throw new Error(`Incident update failed: ${msgResponse.status}`);
            }
            s.stop('Success!')

            break;
    }

} catch (e) {
    cancel('error while managing: ' + e);
    process.exit(1);
}


outro(`See you next time..`)