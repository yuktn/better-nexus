import { intro, cancel, outro, text, log, spinner, isCancel } from '@clack/prompts';
import { writeFile, readFile } from "node:fs/promises";
import { generateSecret, generate, verify, generateURI } from "otplib";
import { apiPort, cliPort } from "../config.js";

const s = spinner();

intro(`manage your incidents`);

try {
    const token = await text({ message: "input your OTP token here!" })

    if (isCancel(token)) {
        cancel("sigint")
        process.exit(1)
    }

    s.start("requesting incidents")
    const response = await fetch(`http://127.0.0.1:${apiPort}/incidents?status=open`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        }
    });

    if (!response.ok) {
        throw new Error(`Registration failed: ${response.status}`);
    }

    const responseData = await response.json();

    s.stop("")

    //todo: add cli editing to incident 

} catch (e) {
    cancel('error while managing: ' + e);
    process.exit(1);
}


outro(`See you next time..`)