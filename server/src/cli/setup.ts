import { configDir, tokenPath } from "../config.js";
import { intro, cancel, outro, log, spinner } from '@clack/prompts';
import { generateSecret, generate, verify, generateURI } from "otplib";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import encodeQR from 'qr';

const s = spinner();

intro(`setup your nexus main server`);

try {
    await mkdir(configDir, { recursive: true });

    log.message('Welcome to nexus!')

    log.message(`let's get your OTP set up.`);

    // Generate a secret
    const secret = generateSecret();

    // // Verify a token — returns VerifyResult, not a boolean
    // const result = await verify({ secret, token });
    // console.log(result.valid); // true or false

    // Generate QR code URI for authenticator apps
    const uri = generateURI({
        issuer: "nexus",
        label: "admin",
        secret,
    });

    await writeFile(
        tokenPath,
        secret,
        {
            encoding: "utf8",
            mode: 0o600,
        }
    );

    log.message(`scan this qr code with your preferred authenticator app: \n`);

    log.message(encodeQR(uri, 'ascii'));
    log.message(`or.. ` + uri);

    log.message('\n this is the raw secret, it will come in handy when you lose your qr code. \n')
    log.message(secret);

    log.message('\n both the qr code and the secret will only be shown once! \n')

} catch (e) {
    cancel('error while enrolling: ' + e);
    process.exit(1);
}

outro(`See you next time...`);