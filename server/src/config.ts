import { join } from "node:path";

export const configDir =
    process.env.NEXUS_CONFIG_DIR ?? process.cwd();

export const tokenPath = join(configDir, "server.token");

const isDevelopment = process.env.NODE_ENV === "development";

export const apiPort: number = isDevelopment ? Number(process.env.APIPORT) || 8081 : 8081;

export const cliPort: number = isDevelopment ? Number(process.env.CLIPORT) || 8082 : 8082;
