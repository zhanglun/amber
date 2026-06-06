import { execSync } from "node:child_process";

export async function setup() {
  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl) return;
  execSync(
    "pnpm --filter @amber/adapters exec prisma db push --skip-generate --accept-data-loss",
    {
      env: { ...process.env, DATABASE_URL: testDbUrl },
      stdio: "pipe",
    }
  );
}
