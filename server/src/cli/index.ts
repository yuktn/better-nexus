#!/usr/bin/env node

const command = process.argv[2];

switch (command) {
    case "setup":
        await import("./setup.js");
        break;

    case "enroll":
        await import("./enroll.js");
        break;

    case "start":
        await import("../index.js");
        break;

    default:
        console.log(`
nexus-server v0.1.2

Usage:
  nexus-server setup
  nexus-server enroll
  nexus-server start
`);
        process.exit(command ? 1 : 0);
}