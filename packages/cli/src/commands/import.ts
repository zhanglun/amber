import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { buildServices } from "../wiring.js";

export const importCommand = defineCommand({
  meta: { name: "import", description: "Import a URL into Amber" },
  args: {
    url: { type: "positional", description: "Web page URL to capture", required: true },
  },
  async run({ args }) {
    const { importService, dataDir } = buildServices();
    const spin = p.spinner();
    spin.start(`Importing ${args.url}`);
    try {
      const id = await importService.run(args.url);
      spin.stop(`Imported as ${id}`);
      p.log.info(`Saved to ${dataDir}/captures/${id}.json`);
    } catch (err) {
      spin.stop("Import failed");
      p.log.error((err as Error).message);
      process.exitCode = 1;
    }
  },
});
