import { z } from "zod";

export const HeartbeatSchema = z.object({
  agentId: z.uuidv4(), // UUIDv4
  temp: z.number(), // Celsius
  cpu: z.number().min(0).max(100), // Percentage
  memory: z.number().min(0).max(100),
  timestamp: z.number().int(), // Unix timestamp in milliseconds
});

export type Heartbeat = z.infer<typeof HeartbeatSchema>;

export const AgentSchema = z.object({
  agentId: z.uuidv4(), // UUIDv4
  agentName: z.string(), // set by agent
  agentNexusVersion: z.string(),
  platform: z.enum(["windows", "mac", "linux"]),
  registeredOn : z.number().int(), // U t i m
  lastSeenOn: z.number().int(), // Unix timestamp in milliseconds
  sourceIp: z.string(), // ipv4 or ipv6, supply by server
  ipType: z.enum(["ipv4", "ipv6"])
})

export type Agent = z.infer<typeof AgentSchema>;

export const AgentRegisterRequestSchema = z.object({
  agentName: z.string(),
  agentNexusVersion: z.string(),
  platform: z.enum(["windows", "mac", "linux"]),
})

export type AgentRegisterRequest = z.infer<typeof AgentRegisterRequestSchema>;

export const AgentUpdateRequestSchema = z.object({
  agentId: z.string(),
  oldValue: z.string(),
  newValue: z.string()
})

export type AgentUpdateRequest = z.infer<typeof AgentUpdateRequestSchema>