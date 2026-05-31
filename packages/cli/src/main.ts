#!/usr/bin/env -S node --import tsx
import { defineCommand, runMain } from "citty";
import { importCommand } from "./commands/import.js";
import { listCommand } from "./commands/list.js";
import { serveCommand } from "./commands/serve.js";

const main = defineCommand({
  meta: { name: "amber", description: "Personal Knowledge Pipeline" },
  subCommands: {
    import: importCommand,
    list: listCommand,
    serve: serveCommand,
  },
});

runMain(main);
