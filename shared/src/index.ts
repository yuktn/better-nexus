import { z } from "zod";

export const HeartbeatSchema = z.object({
  temp: z.number(), // Celsius
  cpu: z.number().min(0).max(100), // Percentage
  memory: z.number().min(0).max(100),
  timestamp: z.number().int(), // Unix timestamp in milliseconds
});

export type Heartbeat = z.infer<typeof HeartbeatSchema>;

export const HeartbeatDocumentSchema = z.object({
  agentId: z.uuidv4(), // UUIDv4
  temp: z.number(), // Celsius
  cpu: z.number().min(0).max(100), // Percentage
  memory: z.number().min(0).max(100),
  timestamp: z.date(), // WE need to aggregate
});

export type HeartbeatDocument = z.infer<typeof HeartbeatDocumentSchema>;

export const EnrollmentTokenSchema = z.object({
  hashedEnrollmentToken: z.string(),
  expiresAt: z.date() //date because mongodb ttl
})

export type EnrollmentToken = z.infer<typeof EnrollmentTokenSchema>

export const AgentSchema = z.object({
  agentId: z.uuidv4(), // UUIDv4
  agentName: z.string(), // set by agent
  agentNexusVersion: z.string(),
  platform: z.enum(["windows", "mac", "linux"]),
  registeredOn: z.number().int(), // U t i m
  lastSeenOn: z.number().int(), // Unix timestamp in milliseconds
  sourceIP: z.string(), // ipv4 or ipv6, supply by server
  ipType: z.enum(["ipv4", "ipv6"])
})

export type Agent = z.infer<typeof AgentSchema>;

export type AgentDocument = Agent & {
  hashedAgentSecret: string;
};

export const AgentRegisterRequestSchema = z.object({
  agentName: z.string(),
  agentNexusVersion: z.string(),
  platform: z.enum(["windows", "mac", "linux"]),
})

export type AgentRegisterRequest = z.infer<typeof AgentRegisterRequestSchema>;

//mutable parts

export const AgentUpdateRequestSchema = z.object({
  field: AgentSchema
    .pick({
      agentName: true,
      agentNexusVersion: true,
    })
    .keyof(),

  newValue: z.string(),
});

export type AgentUpdateRequest = z.infer<typeof AgentUpdateRequestSchema>

// all are coerced to numbers because queries are passed as strings.
export const HeartbeatRequestSchema = z.object({
  hbCountCap: z.coerce.number().int().positive().optional(), // defaults to no counts
  searchTSTo: z.coerce.number().optional(),// utim, defaults to first hb
  searchTSFrom: z.coerce.number().optional(), //utim, defaults to date.now
})

export type HeartbeatRequest = z.infer<typeof HeartbeatRequestSchema>


//for agent side config.json
export const AgentInfoSchema = AgentSchema.pick({
  agentId: true,
  agentName: true,
  agentNexusVersion: true,
  platform: true,
});

export type AgentInfo = z.infer<typeof AgentInfoSchema>;