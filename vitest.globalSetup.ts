import { execSync } from "node:child_process";

export async function setup() {
  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl) return;
  try {
    execSync(
      "pnpm --filter @amber/adapters exec prisma db push --skip-generate --accept-data-loss",
      {
        env: { ...process.env, DATABASE_URL: testDbUrl },
        stdio: "pipe",
      }
    );
  } catch (err: unknown) {
    const stderr =
      err instanceof Error && "stderr" in err
        ? (err as { stderr: Buffer }).stderr.toString()
        : String(err);
    throw new Error(`prisma db push failed — is Postgres running?\n${stderr}`);
  }
}
