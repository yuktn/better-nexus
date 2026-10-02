import { intro, cancel, outro, log, spinner } from '@clack/prompts';

const s = spinner();

intro(`enroll your nexus agent`);

try {

    s.start('requesting enrollment to server')

    const response = await fetch(`http://localhost:8081/server/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        }
    });

    if (!response.ok) {
        throw new Error(`Registration failed: ${response.status}`);
    }

    const responseData = await response.json();

    log.message(`Token: ${responseData.data.enrollmentToken}`)
    const expiresAt = new Date(responseData.data.expiresAt);

    log.message(
        `Expires at: ${expiresAt.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        })}`
    );

    s.stop('Success!');

} catch (e) {
    cancel('error while enrolling: ' + e);
    process.exit(0);
}

outro(`See you next time...`);