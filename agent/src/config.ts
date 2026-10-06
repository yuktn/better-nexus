import { join } from "node:path";

export const configDir =
    process.env.NEXUS_CONFIG_DIR ?? process.cwd();

export const configPath = join(configDir, "config.json");
export const tokenPath = join(configDir, "agent.token");