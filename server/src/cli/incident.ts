import { intro, cancel, outro, text, log, spinner, isCancel } from '@clack/prompts';
import { writeFile, readFile } from "node:fs/promises";
import { generateSecret, generate, verify, generateURI } from "otplib";
import { IncidentManager } from '../incidentManager.js';
import { cliPort } from "../config.js";

const s = spinner();

intro(`enroll your nexus agent`);

try {

} catch (e) {
    cancel('error while enrolling: ' + e);
    process.exit(1);
}


outro(`See you next time..`)