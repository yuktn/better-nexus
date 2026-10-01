import type { NextFunction, Request, Response } from 'express';
import { agents } from '../db.js';
import crypto from "node:crypto"

export async function agentAuth(_req: Request, res: Response, next: NextFunction) {
    const authHeader = _req.headers.authorization;
    const agentId = _req.header("X-Nexus-Agent-ID");

    if (!authHeader || !agentId || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const secret = authHeader.slice(7);

    const result = await agents.findOne({ agentId })

    if (!result) return res.status(401).json({ success: false, error: 'Unauthorized.' });

    const hashProvidedAgentSecret = crypto.createHash('sha256').update(secret).digest('hex');

    const providedHashBuffer = Buffer.from(hashProvidedAgentSecret, "hex");
    const storedHashBuffer = Buffer.from(result.hashedAgentSecret, "hex");

    if (
        providedHashBuffer.length !== storedHashBuffer.length ||
        !crypto.timingSafeEqual(providedHashBuffer, storedHashBuffer)
    ) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    _req.authenticatedAgentId = agentId;

    next();
}
