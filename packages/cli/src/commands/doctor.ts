import { defineCommand } from "citty";
import * as p from "@clack/prompts";
import { formatDoctorResult, runDoctor, type DoctorResult } from "@amber/adapters";

export interface AmberDoctorDeps {
  doctor?: () => Promise<DoctorResult>;
  log?: (msg: string) => void;
}

/**
 * 检查抓取动态站点所需的浏览器运行时（Patchright Chromium），缺失时尝试自动安装。
 * 复用 dino 的 doctor 能力。返回是否健康，便于命令层决定退出码。
 */
export async function runAmberDoctor(deps: AmberDoctorDeps = {}): Promise<boolean> {
  const doctor = deps.doctor ?? runDoctor;
  const log = deps.log ?? ((m: string) => p.log.message(m));
  const result = await doctor();
  log(formatDoctorResult(result));
  return result.ok;
}

export const doctorCommand = defineCommand({
  meta: {
    name: "doctor",
    description: "Check runtime dependencies (Chromium for dynamic-site capture)",
  },
  async run() {
    const ok = await runAmberDoctor();
    if (!ok) process.exitCode = 1;
  },
});
