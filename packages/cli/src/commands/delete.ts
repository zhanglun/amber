import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { buildServices } from "../wiring.js";

export const deleteCommand = defineCommand({
  meta: { name: "delete", description: "Delete a capture and its blobs" },
  args: {
    id: { type: "positional", description: "Capture id to delete", required: true },
    yes: { type: "boolean", description: "Skip confirmation prompt", default: false },
  },
  async run({ args }) {
    const { readService, deleteCapture } = buildServices();

    const capture = await readService.get(args.id);
    if (!capture) {
      p.log.error(`Capture not found: ${args.id}`);
      process.exitCode = 1;
      return;
    }

    if (!args.yes) {
      const confirmed = await p.confirm({
        message: `Delete "${capture.title}" (${args.id})?`,
      });
      if (p.isCancel(confirmed) || !confirmed) {
        p.log.info("Cancelled.");
        return;
      }
    }

    await deleteCapture(args.id);
    p.log.success(`Deleted ${args.id}`);
  },
});
