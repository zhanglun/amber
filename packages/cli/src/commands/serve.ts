import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { startServer } from "@amber/web";
import { buildServices } from "../wiring.js";

export const serveCommand = defineCommand({
  meta: { name: "serve", description: "Start the local web UI to read captures" },
  args: {
    port: { type: "string", description: "Port", default: process.env.AMBER_PORT ?? "7788" },
  },
  async run({ args }) {
    const { readService, blobsDir } = buildServices();
    const port = Number(args.port);
    startServer(readService, { blobsDir, port });
    p.log.success(`Amber is running at http://localhost:${port}`);
    p.log.info("Press Ctrl+C to stop.");
  },
});
