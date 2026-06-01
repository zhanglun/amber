import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { buildServices } from "../wiring.js";

export const importCommand = defineCommand({
  meta: { name: "import", description: "Import a URL into Amber" },
  args: {
    url: { type: "positional", description: "Web page URL to capture", required: true },
    force: { type: "boolean", description: "Skip dedup and re-capture, keeping original id if it exists", default: false },
  },
  async run({ args }) {
    const { importService, readService, deleteCapture, dataDir } = buildServices();
    const spin = p.spinner();
    spin.start(`Importing ${args.url}`);
    try {
      let id: string;
      if (args.force) {
        const existing = await readService.findBySourceUrl(args.url);
        if (existing) {
          await deleteCapture(existing.id);
          id = await importService.run(args.url, { forceId: existing.id });
        } else {
          id = await importService.run(args.url);
        }
      } else {
        id = await importService.run(args.url);
      }

      spin.stop(`Imported as ${id}`);
      p.log.info(`Saved to ${dataDir}/captures/${id}.json`);

      const saved = await readService.get(id);
      if (saved && saved.content.trim().length === 0) {
        p.log.warn("Content is empty — the page may block bots, require login, or be behind a paywall.");
        p.log.info("Tip: try dino with browser mode (patchright) for gated pages.");
      }
    } catch (err) {
      spin.stop("Import failed");
      p.log.error((err as Error).message);
      process.exitCode = 1;
    }
  },
});
