import express, { type Request, type Response } from 'express';
import {
    type Heartbeat, HeartbeatSchema,
    type Agent, AgentSchema,
    type AgentRegisterRequest, AgentRegisterRequestSchema,
    type AgentUpdateRequest, AgentUpdateRequestSchema,
    type HeartbeatRequest, HeartbeatRequestSchema,
    type AgentInfo, AgentInfoSchema,
    type AgentDocument,
    type HeartbeatDocument,
    type EnrollmentToken
} from '@better-nexus/shared';
import { isIP } from 'node:net';
import crypto from 'node:crypto';
import { writeFile, readFile } from "node:fs/promises";
import { generateSecret, generate, verify, generateURI } from "otplib";

import { initDb, agents, heartbeats, enrollmentTokens } from "./db.js";
import { agentAuth } from './middleware/agentAuth.js';

export const admin = express();
const port = process.env.PORT ? Number(process.env.PORT) : 8082;

admin.use(express.json());

admin.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'Server is running' });
});

admin.get('/health', (_req: Request, res: Response) => {
    return res.status(200).json({ success: true, nexus: true });
});


//#region /server

//issue temporary enrollment token. SHOULD ONLY BE DONE BY THE CLI
admin.post('/admin/register', async (_req: Request, res: Response) => {

    const secretContent = await readFile("./server.token", "utf8");

    const secret = secretContent.trim()

    const authHeader = _req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const TOTPToken: string = authHeader.slice(7)

    if (!(await verify({ secret, token: TOTPToken })).valid) {
        return res.status(401).json({ success: false, error: "Unauthorized." })
    }

    const enrollmentToken = crypto.randomBytes(32).toString('hex');
    const hashedEnrollmentToken = crypto.createHash('sha256').update(enrollmentToken).digest('hex');

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes!

    const token: EnrollmentToken = {
        hashedEnrollmentToken,
        expiresAt
    }

    try {
        await enrollmentTokens.insertOne(token)
        return res.status(201).json({
            success: true, data: {
                enrollmentToken,
                expiresAt
            }
        })
    } catch (e) {
        res.status(500).json({ success: false, error: "Unknown database error" })
    }
})

//#endregion