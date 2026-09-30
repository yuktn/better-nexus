import express, {type Request, type Response } from 'express';
import { success, z } from 'zod';
import {
	type Heartbeat,
	type Agent, AgentSchema,
	type AgentRegisterRequest, AgentRegisterRequestSchema,
	type AgentUpdateRequest, AgentUpdateRequestSchema
} from '@better-nexus/shared';

import { initDb, agents } from "./db.js";

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
	res.json({ message: 'Server is running' });
});

app.get('/health', (_req: Request, res: Response) => {
	res.json({ status: 'ok' });
});

app.post('/registerRequest', async (_req: Request, res: Response) => {
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
	const agentIp = _req.ip;

	if (!agentIp) {
		return res.status(500).json({ success: false, error: "Network Error." })
	}

	if (agentIp?.includes(":")) {
		ipType = "ipv6"
	} else {
		ipType = "ipv4"
	}

	const currentTime: number = Date.now() // = registeredOn, = lastSeenOn

	const agent: Agent = {
		agentId,
		agentName,
		agentNexusVersion,
		platform,
		registeredOn: currentTime,
		lastSeenOn: currentTime,
		sourceIp: agentIp,
		ipType
	}

	try {
		await agents.insertOne(agent);
		return res.status(201).json({success: true, agent})
	} catch (e) {
		res.status(400).json({success: false, error: "Unknown database error"})
	}
});

const MutableAgentKeySchema = AgentSchema
  .pick({
    agentName: true,
    agentNexusVersion: true,
    platform: true,
  })
  .keyof();

// /updateInfo?field="", body should include agentId
app.patch('/updateInfo', (_req: Request, res: Response) => {
	const result = MutableAgentKeySchema.safeParse(_req.query.field);
	const bodyResult = AgentUpdateRequestSchema.safeParse(_req.body)

	if (!result.success) {
		return res.status(400).json({
			success: false,
			error: `Field ${String(_req.query.field)} does not exist or is immutable.`,
		});
	}

	if (!bodyResult.success) {
		return res.status(400).json({
			success: false,
			error: `Bad Request.`,
		});
	}

	const field = result.data;
	const { agentId, oldValue, newValue} = bodyResult.data

	//TODO: check if agentId exists, and if it doesn't, return error
	//TODO: check if agent's field's default value is oldValue, if not, return error
	//TODO: update and return success
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