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

import { initDb, heartbeats, enrollmentTokens, agents, incidents } from "./db.js";
import { agentAuth } from './middleware/agentAuth.js';
import { statusManager } from './statusManager.js';
import { addSseClient, removeSseClient, sendSseEvent } from './sse.js';

export const api = express();

api.use(express.json());

api.get('/', (_req: Request, res: Response) => {
	res.json({ message: 'Server is running' });
});

api.get('/health', (_req: Request, res: Response) => {
	return res.status(200).json({ success: true, nexus: true });
});

//#region /agents

api.get('/agents', async (_req: Request, res: Response) => {
	let agentList: Agent[] | undefined;

	try {
		agentList = await agents.find().toArray()
	} catch (e) {
		return res.status(500).json({ success: false, error: "Unknown database error" })
	}

	const data = agentList.map(item => {
		return {
			agentId: item.agentId,
			agentName: item.agentName,
			agentNexusVersion: item.agentNexusVersion,
			platform: item.platform,
			registeredOn: item.registeredOn,
			lastSeenOn: item.lastSeenOn,
			status: item.status
		};
	});

	return res.status(200).json({ success: true, data })
})

api.get('/agents/:id', async (_req: Request, res: Response) => {
	const id = _req.params.id

	let agent

	try {
		agent = await agents.findOne({ agentId: id })

		if (!agent) {
			return res.status(404).json({ success: false, error: "Not Found" })
		}
	} catch (e) {
		return res.status(500).json({ success: false, error: "Unknown database error" })
	}

	const data = {
		agentId: agent.agentId,
		agentName: agent.agentName,
		agentNexusVersion: agent.agentNexusVersion,
		platform: agent.platform,
		registeredOn: agent.registeredOn,
		lastSeenOn: agent.lastSeenOn,
	};

	return res.status(200).json({ success: true, data })
})

//requires token from /server/register!
api.post('/agents', async (_req: Request, res: Response) => {
	let ipType: 'ipv4' | 'ipv6';

	const result = AgentRegisterRequestSchema.safeParse(_req.body);

	if (!result.success) {
		return res.status(400).json({
			success: false,
			error: `Bad Request.`,
		});
	}

	const authHeader = _req.headers.authorization;

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return res.status(401).json({ success: false, error: 'Unauthorized.' });
	}

	const secret = authHeader.slice(7)

	const hashedEnrollmentToken = crypto.createHash('sha256').update(secret).digest('hex');

	try {
		const tokenResult = await enrollmentTokens.findOneAndDelete({ hashedEnrollmentToken, expiresAt: { $gt: new Date() } })

		if (!tokenResult) return res.status(401).json({ success: false, error: 'Unauthorized.' });
	} catch (e) {
		return res.status(500).json({ success: false, error: "Unknown database error" })
	}

	const { agentName, agentNexusVersion, platform } = result.data

	const agentId = crypto.randomUUID()
	const agentIP = _req.ip;

	const agentSecret = crypto.randomBytes(32).toString('hex');
	const hashedAgentSecret = crypto.createHash('sha256').update(agentSecret).digest('hex');

	if (!agentIP) {
		return res.status(400).json({ success: false, error: "Network Error" })
	}

	if (isIP(agentIP) == 6) {
		ipType = "ipv6"
	} else if (isIP(agentIP) == 4) {
		ipType = "ipv4"
	} else {
		return res.status(400).json({ success: false, error: "Network Error" })
	}

	const currentTime: number = Date.now() // = registeredOn, = lastSeenOn

	//add status

	const agent: AgentDocument = {
		agentId,
		agentName,
		agentNexusVersion,
		platform,
		registeredOn: currentTime,
		lastSeenOn: currentTime,
		sourceIP: agentIP,
		ipType,
		hashedAgentSecret,
		status: "UP"
	}

	try {
		await agents.insertOne(agent);
		return res.status(201).json({ success: true, data: { agentId, agentName, agentNexusVersion, platform, agentSecret } })
	} catch (e) {
		res.status(500).json({ success: false, error: "Unknown database error" })
	}
});

const MutableAgentKeySchema = AgentSchema
	.pick({
		agentName: true,
		agentNexusVersion: true,
		platform: true,
	})
	.keyof();


// /agents
api.patch('/agents', agentAuth, async (_req: Request, res: Response) => {
	const agentId = _req.authenticatedAgentId
	const bodyResult = AgentUpdateRequestSchema.safeParse(_req.body)

	if (!agentId) {
		return res.status(400).json({
			success: false,
			error: `No ID Provided!.`,
		});
	}

	if (!bodyResult.success) {
		return res.status(400).json({
			success: false,
			error: `Bad Request.`,
		});
	}


	const { field, newValue } = bodyResult.data

	try {
		const result = await agents.updateOne(
			{
				agentId,
			},
			{
				$set: {
					[field]: newValue,
				},
			}
		);

		if (result.modifiedCount === 1) {
			return res.status(200).json({
				success: true,
				data: { agentId, field, newValue },
			});
		} else if (result.matchedCount === 1 && result.modifiedCount === 0) {
			return res.status(409).json({
				success: false,
				error: "New value is same as old value.",
			});
		} else {
			return res.status(409).json({
				success: false,
				error: "No data matching provided input.",
			});
		}

	} catch (e) {
		return res.status(500).json({
			success: false,
			error: `Database err.`,
		});
	}
})

//rotate key
api.post('/agents/key', agentAuth, async (_req: Request, res: Response) => {

})

api.delete('/agents/', agentAuth, async (_req: Request, res: Response) => {
	const agentId = _req.authenticatedAgentId

	if (!agentId) {
		return res.status(400).json({
			success: false,
			error: `No ID Provided!.`,
		});
	}

	try {
		const result = await agents.deleteOne({ agentId })

		if (result.deletedCount === 1) {
			return res.status(200).json({
				success: true
			});
		} else {
			return res.status(404).json({
				success: false,
				error: `No such agent.`,
			});
		}

	} catch (e) {
		return res.status(500).json({
			success: false,
			error: `Database err.`,
		});
	}
})

//#endregion

//#region /hb

api.post('/hb', agentAuth, async (_req: Request, res: Response) => {
	const result = HeartbeatSchema.safeParse(_req.body)

	const agentId = _req.authenticatedAgentId
	if (!agentId) return res.status(500).json({ success: false, error: "Server Error." })

	if (!result.success) {
		return res.status(400).json({
			success: false,
			error: `Unrecognized request schema.`,
		});
	}

	const { temp, cpu, memory, timestamp } = result.data

	const hb: HeartbeatDocument = {
		agentId,
		temp,
		cpu,
		memory,
		timestamp: new Date(timestamp)
	}

	if (!agentId) {
		return res.status(400).json({
			success: false,
			error: "No ID provided.",
		});
	}

	try {
		const lastSeenOnUpdate = await agents.updateOne({ agentId }, { $set: { lastSeenOn: Date.now() } })
		const result = await heartbeats.insertOne(hb)

		sendSseEvent('heartbeat', hb)
		statusManager.onHeartbeat(agentId, { temp, cpu, memory, timestamp })

		if (result.insertedId && lastSeenOnUpdate.matchedCount === 1) {
			const id = result.insertedId

			return res.status(201).json({
				success: true,
				data: {
					hb: {
						...hb, timestamp: hb.timestamp.getTime()
					}, id
				},
			});
		} else {
			res.status(500).json({ success: false, error: "Server Database Failure." })
		}
	} catch (e) {
		res.status(500).json({ success: false, error: "Server Database Failure." })
	}
})

//get timestamp based on count, start or finish.
//GET /hb/abc123?searchTSFrom=123&searchTSTo=456&hbCountCap=100&range=1M

const RANGE_CONFIG = {
	"1M": {
		durationMs: 60 * 1000,
		unit: "second",
		binSize: 5,
	},
	"1H": {
		durationMs: 60 * 60 * 1000,
		unit: "minute",
		binSize: 1,
	},
	"1D": {
		durationMs: 24 * 60 * 60 * 1000,
		unit: "minute",
		binSize: 10,
	},
	"1W": {
		durationMs: 7 * 24 * 60 * 60 * 1000,
		unit: "hour",
		binSize: 1,
	},
} as const;


api.get('/hb/:id', async (_req: Request, res: Response) => {
	const agentId = _req.params.id;

	const result = HeartbeatRequestSchema.safeParse(_req.query);

	if (!result.success) {
		return res.status(400).json({
			success: false,
			error: "Bad Request.",
		});
	}

	try {
		// range = aggregate mode
		if (result.data.range) {
			const config = RANGE_CONFIG[result.data.range];

			const tsTo = new Date();
			const tsFrom = new Date(
				tsTo.getTime() - config.durationMs
			);

			const results = await heartbeats.aggregate([
				{
					$match: {
						agentId,
						timestamp: {
							$gte: tsFrom,
							$lte: tsTo,
						},
					},
				},
				{
					$group: {
						_id: {
							$dateTrunc: {
								date: "$timestamp",
								unit: config.unit,
								binSize: config.binSize,
							},
						},

						cpu: { $avg: "$cpu" },
						memory: { $avg: "$memory" },
						temp: { $avg: "$temp" },

						samples: { $sum: 1 },
					},
				},
				{
					$sort: {
						_id: 1,
					},
				},
			]).toArray();

			const data = results.map(hb => ({
				timestamp: hb._id.getTime(),
				cpu: hb.cpu,
				memory: hb.memory,
				temp: hb.temp,
				samples: hb.samples,
			}));

			return res.status(200).json({
				success: true,
				data,
			});
		}

		// no range -> raw data
		const tsTo = new Date(
			result.data.searchTSTo ?? Date.now()
		);

		const tsFrom = new Date(
			result.data.searchTSFrom ?? 0
		);

		let query = heartbeats
			.find({
				agentId,
				timestamp: {
					$gte: tsFrom,
					$lte: tsTo,
				},
			})
			.sort({ timestamp: -1 });

		if (result.data.hbCountCap) {
			query = query.limit(result.data.hbCountCap);
		}

		const results = await query.toArray();

		const data = results.map(hb => ({
			...hb,
			timestamp: hb.timestamp.getTime(),
		}));

		return res.status(200).json({
			success: true,
			data,
		});

	} catch (e) {
		return res.status(500).json({
			success: false,
			error: "Server Database Failure.",
		});
	}
});

//#region /incidents

//incidents?status=open / resolved
api.get('/incidents', async (_req: Request, res: Response) => {
	const { status } = _req.query;

	if (status === "open" || status === "resolved") {
		const data = await incidents.find({ status }).toArray();
		return res.status(200).json({ success: true, data });
	} else {
		const data = await incidents.find().toArray();
		return res.status(200).json({ success: true, data });
	}
})


//incidents/:id?status=open/resolved
api.get('/incidents/:id', async (_req: Request, res: Response) => {
	const { status } = _req.query;
	const { id: agentId } = _req.params;

	if (status === "open" || status === "resolved") {
		const data = await incidents.find({ status, agentId }).toArray();
		return res.status(200).json({ success: true, data });
	} else {
		const data = await incidents.find({ agentId }).toArray();
		return res.status(200).json({ success: true, data });
	}
})

//SSE for frontend
api.get('/events', (_req, res) => {
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache, no-transform');
	res.setHeader('X-Accel-Buffering', 'no');
	res.setHeader('Connection', 'keep-alive');
	res.flushHeaders();

	res.write('data: Connected to the nexus api!\n\n');

	addSseClient(res)
	const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 15_000);

	res.on("close", () => {
		clearInterval(keepAlive);
		removeSseClient(res);
	});
});
