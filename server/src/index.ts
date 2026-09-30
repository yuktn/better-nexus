import express, { type Request, type Response } from 'express';
import {
	type Heartbeat, HeartbeatSchema,
	type Agent, AgentSchema,
	type AgentRegisterRequest, AgentRegisterRequestSchema,
	type AgentUpdateRequest, AgentUpdateRequestSchema,
	type HeartbeatRequest, HeartbeatRequestSchema
} from '@better-nexus/shared';
import { isIP } from 'node:net';

import { initDb, agents, heartbeats } from "./db.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
	res.json({ message: 'Server is running' });
});

app.get('/health', (_req: Request, res: Response) => {
	res.json({ status: 'ok' });
});

//#region /agents

app.post('/agents/register', async (_req: Request, res: Response) => {
	let ipType: 'ipv4' | 'ipv6';

	const result = AgentRegisterRequestSchema.safeParse(_req.body);

	if (!result.success) {
		return res.status(400).json({
			success: false,
			error: `Bad Request.`,
		});
	}

	const { agentName, agentNexusVersion, platform } = result.data

	const agentId = crypto.randomUUID()
	const agentIP = _req.ip;

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

	const agent: Agent = {
		agentId,
		agentName,
		agentNexusVersion,
		platform,
		registeredOn: currentTime,
		lastSeenOn: currentTime,
		sourceIP: agentIP,
		ipType
	}

	try {
		await agents.insertOne(agent);
		return res.status(201).json({ success: true, data: agent })
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


// /agents/:id?field=agentName
app.patch('/agents/:id', async (_req: Request, res: Response) => {
	const result = MutableAgentKeySchema.safeParse(_req.query.field);
	const bodyResult = AgentUpdateRequestSchema.safeParse(_req.body)
	const agentId = _req.params.id;

	if (!result.success) {
		return res.status(400).json({
			success: false,
			error: `Field ${String(_req.query.field)} does not exist or is immutable.`,
		});
	}

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


	const field = result.data;
	const { oldValue, newValue } = bodyResult.data

	try {
		const result = await agents.updateOne(
			{
				agentId,
				[field]: oldValue,
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
	} finally {
		return res.status(500).json({ success: false, error: "This shouldn't happen." })
	}
})

app.delete('/agents/:id', async (_req: Request, res: Response) => {
	const agentId = _req.params.id;

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
	} finally {
		return res.status(500).json({ success: false, error: "This shouldn't happen." })
	}
})

//#endregion

//#region /hb

app.post('/hb', async (_req: Request, res: Response) => {
	const result = HeartbeatSchema.safeParse(_req.body)

	if (!result.success) {
		return res.status(400).json({
			success: false,
			error: `Unrecognized request schema.`,
		});
	}

	const { agentId, temp, cpu, memory, timestamp } = result.data

	const hb: Heartbeat = {
		agentId,
		temp,
		cpu,
		memory,
		timestamp
	}

	if (!agentId) {
		return res.status(400).json({
			success: false,
			error: "No ID provided.",
		});
	}

	const dbLookupResult = await agents.findOne({ agentId })

	if (!dbLookupResult) {
		return res.status(404).json({
			success: false,
			error: `No such agent.`,
		});
	}

	try {
		const lastSeenOnUpdate = await agents.updateOne({ agentId }, { $set: { lastSeenOn: Date.now() } })
		const result = await heartbeats.insertOne(hb)

		if (result.insertedId && lastSeenOnUpdate.matchedCount === 1) {
			const id = result.insertedId

			return res.status(201).json({
				success: true,
				data: { hb, id },
			});
		} else {
			res.status(500).json({ success: false, error: "Server Database Failure." })
		}
	} catch (e) {
		res.status(500).json({ success: false, error: "Server Database Failure." })
	} finally {
		return res.status(500).json({ success: false, error: "This shouldn't happen." })
	}
})

//get timestamp based on count, start or finish.
app.get('/hb/:id', async (_req: Request, res: Response) => {
	const agentId = _req.params.id

	const result = HeartbeatRequestSchema.safeParse(_req.body)

	if (!result.success) {
		return res.status(400).json({
			success: false,
			error: `Bad Request.`,
		});
	}

	let tsTo: number

	if (!result.data.searchTSTo) { tsTo = Date.now() } else { tsTo = result.data.searchTSTo }

	//TODO: THIS AMOUNT OF NESTED IFS ARE NOT NORMAL. ROBERT C MARTIN IS COMING.

	try {
		if (!result.data.hbCountCap) {
			if (!result.data.searchTSFrom) {
				const results = await heartbeats.find({ agentId, timestamp: { "$lte": tsTo } }).sort({ timestamp: -1 })
				return res.status(200).json({
					success: true,
					data: results
				});
			} else {
				const results = await heartbeats.find({ agentId, timestamp: { "$lte": tsTo, "$gte": result.data.searchTSFrom } }).sort({ timestamp: -1 })
				return res.status(200).json({
					success: true,
					data: results
				});
			}
		} else {
			if (!result.data.searchTSFrom) {
				const results = await heartbeats.find({ agentId, timestamp: { "$lte": tsTo } }).sort({ timestamp: -1 }).limit(result.data.hbCountCap)
				return res.status(200).json({
					success: true,
					data: results
				});
			} else {
				const results = await heartbeats.find({ agentId, timestamp: { "$lte": tsTo, "$gte": result.data.searchTSFrom } }).sort({ timestamp: -1 }).limit(result.data.hbCountCap)
				return res.status(200).json({
					success: true,
					data: results
				});
			}
		}
	} catch (e) {
		return res.status(500).json({ success: false, error: "Server Database Failure." })
	} finally {
		return res.status(500).json({ success: false, error: "This shouldn't happen." })
	}
})

async function start() {
	await initDb();

	app.listen(port, () => {
		console.log(`Server listening on port ${port}`);
	});
}

start().catch((error) => {
	console.error("Failed to start server:", error);
	process.exit(1);
});