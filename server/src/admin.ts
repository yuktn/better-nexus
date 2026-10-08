import { tokenPath } from "./config.js";
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
    type EnrollmentToken,
    IncidentEditRequestSchema
} from '@better-nexus/shared';
import { isIP } from 'node:net';
import crypto from 'node:crypto';
import { writeFile, readFile } from "node:fs/promises";
import { generateSecret, generate, verify, generateURI } from "otplib";
import { initDb, agents, heartbeats, enrollmentTokens, incidents } from "./db.js";
import { adminAuth } from "./middleware/adminAuth.js";
import { incidentManager } from "./incidentManager.js";
import { success } from "zod";


export const admin = express();

admin.use(express.json());

admin.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'Server is running' });
});

admin.get('/health', (_req: Request, res: Response) => {
    return res.status(200).json({ success: true, nexus: true });
});


//#region /server

//issue temporary enrollment token. SHOULD ONLY BE DONE BY THE CLI
admin.post('/admin/register', adminAuth, async (_req: Request, res: Response) => {

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

//#region /admin/incidents

// /admin/incidents/:id

admin.post('/admin/incidents', adminAuth, async (_req: Request, res: Response) => {
    const result = IncidentEditRequestSchema.safeParse(_req.body)

    if (!result.success) { return res.status(400).json({ success: false, error: "necessary input not provided" }) }

    const { field, value, incidentId } = result.data

    if (!field || !incidentId || !value) { return res.status(400).json({ success: false, error: "necessary input not provided" }) }

    switch (field) {
        case "message":
            await incidentManager.addMessage(incidentId, value, new Date())
            break;
        case "title":
            await incidentManager.editTitle(incidentId, value)
            break;
    }

    const data = await incidents.find({incidentId})

    return res.status(200).json({
        success: true, data
    })
})