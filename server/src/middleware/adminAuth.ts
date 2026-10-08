import type { NextFunction, Request, Response } from 'express';
import { agents } from '../db.js';
import { writeFile, readFile } from "node:fs/promises";
import { generateSecret, generate, verify, generateURI } from "otplib";
import crypto from "node:crypto"
import { tokenPath } from '../config.js';

export async function adminAuth(_req: Request, res: Response, next: NextFunction) {

    const secretContent = await readFile(tokenPath, "utf8");

    const secret = secretContent.trim()

    const authHeader = _req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const TOTPToken: string = authHeader.slice(7)

    if (!(await verify({ secret, token: TOTPToken })).valid) {
        return res.status(401).json({ success: false, error: "Unauthorized." })
    }
    

    next();
}
