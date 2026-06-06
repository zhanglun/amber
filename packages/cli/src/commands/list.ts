import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { buildServices } from "../wiring.js";

export const listCommand = defineCommand({
  meta: { name: "list", description: "List imported captures" },
  async run() {
    const { readService, dispose } = buildServices();
    try {
      const items = await readService.list();
      if (items.length === 0) {
        p.log.info("No captures yet. Run: amber import <url>");
        return;
      }
      for (const item of items) {
        p.log.message(`${item.id}  ${item.title}\n   ${item.sourceUrl}`);
      }
      p.log.info(`${items.length} capture(s)`);
    } finally {
      await dispose();
    }
  },
});
