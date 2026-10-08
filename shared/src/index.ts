import { unknown, z } from "zod";

export const StatusSchema = z.enum({ UP: "UP", DEGRADED: "DEGRADED", DOWN: "DOWN" } as const);
export const ReasonSchema = z.enum({ TEMP_HI: "TEMP_HI", CPU_HI: "CPU_HI", MEM_HI: "MEM_HI", TIMEOUT: "TIMEOUT", UNKNOWN: "UNKNOWN" } as const);
export const PlatformSchema = z.enum({ windows: "windows", mac: "mac", linux: "linux" } as const);

export type Status = z.infer<typeof StatusSchema>;
export type Reason = z.infer<typeof ReasonSchema>;

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
  platform: PlatformSchema,
  registeredOn: z.number().int(), // U t i m
  lastSeenOn: z.number().int(), // Unix timestamp in milliseconds
  sourceIP: z.string(), // ipv4 or ipv6, supply by server
  ipType: z.enum({ ipv4: "ipv4", ipv6: "ipv6" } as const),
  status: StatusSchema
})

export type Agent = z.infer<typeof AgentSchema>;

export const AgentDocumentSchema = AgentSchema.extend({
  hashedAgentSecret: z.string(),
})

export type AgentDocument = z.infer<typeof AgentDocumentSchema>

export const AgentRegisterRequestSchema = z.object({
  agentName: z.string(),
  agentNexusVersion: z.string(),
  platform: PlatformSchema,
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
  searchTSFrom: z.coerce.number().optional(),
  searchTSTo: z.coerce.number().optional(),
  hbCountCap: z.coerce.number().int().positive().optional(),

  range: z.enum({ "1M": "1M", "1H": "1H", "1D": "1D", "1W": "1W" } as const).optional(),
}).refine(
  data =>
    !(
      data.range &&
      (data.searchTSFrom !== undefined || data.searchTSTo !== undefined)
    ),
  {
    message: "range cannot be combined with searchTSFrom/searchTSTo",
  }
);

export type HeartbeatRequest = z.infer<typeof HeartbeatRequestSchema>


//for agent side config.json
export const AgentInfoSchema = AgentSchema.pick({
  agentId: true,
  agentName: true,
  agentNexusVersion: true,
  platform: true,
}).extend({
  serverUrl: z.url()
});

export type AgentInfo = z.infer<typeof AgentInfoSchema>;

export const AgentStatusChangeSchema = z.object({
  agentId: z.string(),
  newStatus: StatusSchema,
  reason: ReasonSchema.optional(),
  timestamp: z.date()
})

export type AgentStatusChange = z.infer<typeof AgentStatusChangeSchema>;

export const IncidentStatusSchema = z.enum([
  "open",
  "resolved",
]);

export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const IncidentSeveritySchema = z.enum([
  "DEGRADED",
  "DOWN",
]);

export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

export const IncidentReasonSchema = ReasonSchema

export type IncidentReason = z.infer<typeof IncidentReasonSchema>;

export const IncidentSchema = z.object({
  incidentId: z.uuid(),
  title: z.string(),
  agentId: z.uuid(),

  status: IncidentStatusSchema,
  severity: IncidentSeveritySchema,
  reason: IncidentReasonSchema,

  startedAt: z.date(),
  resolvedAt: z.date().nullable(),

  messages: z.object({
    message: z.string(),
    timestamp: z.date()
  }).array(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Incident = z.infer<typeof IncidentSchema>;

export const IncidentRequestSchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),
  pagination: z.union([
    z.object({
      countCap: z.number().int().positive(),
      batch: z.undefined(),
      page: z.undefined(),
    }),

    z.object({
      countCap: z.undefined(),
      batch: z.number().int().positive(),
      page: z.number().int().positive(),
    }),

    z.object({
      countCap: z.undefined(),
      batch: z.undefined(),
      page: z.undefined(),
    })])
})

export type IncidentRequest = z.infer<typeof IncidentRequestSchema>

export const IncidentEditRequestSchema = z.object({
  field: z.string(),
  value: z.string(),
  incidentId: z.uuidv4()
})

export type IncidentEditRequest = z.infer<typeof IncidentEditRequestSchema>
