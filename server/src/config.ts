import { join } from "node:path";

export const configDir =
    process.env.NEXUS_CONFIG_DIR ?? process.cwd();

export const tokenPath = join(configDir, "server.token");
