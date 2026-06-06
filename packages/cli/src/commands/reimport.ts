import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { buildServices } from "../wiring.js";

export const reimportCommand = defineCommand({
  meta: { name: "reimport", description: "Re-capture a URL by capture id, keeping the original id" },
  args: {
    id: { type: "positional", description: "Capture id to re-import", required: true },
  },
  async run({ args }) {
    const { readService, importService, deleteCapture, dataDir, dispose } = buildServices();
    try {
      const capture = await readService.get(args.id);
      if (!capture) {
        p.log.error(`Capture not found: ${args.id}`);
        process.exitCode = 1;
        return;
      }

      const spin = p.spinner();
      spin.start(`Re-importing "${capture.title}" from ${capture.sourceUrl}`);
      try {
        await deleteCapture(args.id);
        await importService.run(capture.sourceUrl, { forceId: args.id });
        spin.stop(`Re-imported as ${args.id}`);
        p.log.info(`Saved to ${dataDir}/captures/${args.id}.json`);
      } catch (err) {
        spin.stop("Re-import failed");
        p.log.error((err as Error).message);
        process.exitCode = 1;
      }
    } finally {
      await dispose();
    }
  },
});
