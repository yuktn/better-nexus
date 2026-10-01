declare global {
    namespace Express {
        interface Request {
            authenticatedAgentId?: string;
        }
    }
}

export {};