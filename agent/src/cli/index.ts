#!/usr/bin/env node

const command = process.argv[2];

switch (command) {
    case "setup":
        await import("./setup.js");
        break;

    case "edit":
        await import("./edit.js");
        break;

    case "start":
        await import("../index.js");
        break;

    default:
        console.log(`
nexus-agent v0.1.0

Usage:
  nexus-agent setup
  nexus-agent edit
  nexus-agent start
`);
        process.exit(command ? 1 : 0);
}