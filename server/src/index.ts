import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { type Heartbeat, type Agent, type AgentRegisterRequest, AgentRegisterRequestSchema } from '@better-nexus/shared';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json());

app.get('/', (_req: Request, res: Response) => {
	res.json({ message: 'Server is running' });
});

app.get('/health', (_req: Request, res: Response) => {
	res.json({ status: 'ok' });
});

app.post('/registerRequest', (_req: Request, res: Response) => {
	let ipType: string

	const result = z.parse(AgentRegisterRequestSchema, _req.body)
	const { agentName, agentNexusVersion, platform} = result

	const uuid = crypto.randomUUID()
	const agentId = _req.ip;

	if (agentId?.includes(":")) {
		ipType = "ipv6"
	} else {
		ipType = "ipv4"
	}

	const currentTime: number = Date.now() // = registeredOn, = lastSeenOn

	//TODO: validate if agent name exists
	//TODO: push to DB
	//TODO: return agent object
});

app.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});
