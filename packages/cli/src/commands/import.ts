import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { buildServices } from "../wiring.js";

export const importCommand = defineCommand({
  meta: { name: "import", description: "Import a URL into Amber" },
  args: {
    url: { type: "positional", description: "Web page URL to capture", required: true },
  },
  async run({ args }) {
    const { importService, readService, dataDir } = buildServices();
    const spin = p.spinner();
    spin.start(`Importing ${args.url}`);
    try {
      const id = await importService.run(args.url);
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
