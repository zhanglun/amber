#!/usr/bin/env -S node --import tsx
import "dotenv/config";
import { defineCommand, runMain } from "citty";
import { importCommand } from "./commands/import.js";
import { listCommand } from "./commands/list.js";
import { webCommand } from "./commands/web.js";
import { deleteCommand } from "./commands/delete.js";
import { reimportCommand } from "./commands/reimport.js";
import { migrateCommand } from "./commands/migrate.js";
import { tagCommand } from "./commands/tag.js";

const main = defineCommand({
  meta: { name: "amber", description: "Personal Knowledge Pipeline" },
  subCommands: {
    import: importCommand,
    list: listCommand,
    web: webCommand,
    delete: deleteCommand,
    reimport: reimportCommand,
    migrate: migrateCommand,
    tag: tagCommand,
  },
});

runMain(main);
