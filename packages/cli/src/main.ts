#!/usr/bin/env -S node --import tsx
import "dotenv/config";
import { defineCommand, runMain } from "citty";
import { importCommand } from "./commands/import.js";
import { listCommand } from "./commands/list.js";
import { webCommand } from "./commands/web.js";
import { deleteCommand } from "./commands/delete.js";
import { reimportCommand } from "./commands/reimport.js";
import { migrateCommand } from "./commands/migrate.js";
import { migrateBlobRefsCommand } from "./commands/migrate-blob-refs.js";
import { optimizeImagesCommand } from "./commands/optimize-images.js";
import { tagCommand } from "./commands/tag.js";
import { doctorCommand } from "./commands/doctor.js";

const main = defineCommand({
  meta: { name: "amber", description: "Personal Knowledge Pipeline" },
  subCommands: {
    import: importCommand,
    list: listCommand,
    web: webCommand,
    delete: deleteCommand,
    reimport: reimportCommand,
    migrate: migrateCommand,
    "migrate-blob-refs": migrateBlobRefsCommand,
    "optimize-images": optimizeImagesCommand,
    tag: tagCommand,
    doctor: doctorCommand,
  },
});

runMain(main);
