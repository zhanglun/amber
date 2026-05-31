#!/usr/bin/env -S node --import tsx
import { defineCommand, runMain } from "citty";
import { importCommand } from "./commands/import.js";
import { listCommand } from "./commands/list.js";

const main = defineCommand({
  meta: { name: "amber", description: "Personal Knowledge Pipeline" },
  subCommands: {
    import: importCommand,
    list: listCommand,
  },
});

runMain(main);
