import { spawn, spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";

/** Quotes an argument for cmd.exe, which Windows needs to run `pnpm.cmd` and the like. */
const quote = (arg: string) =>
  isWindows && /[\s"&|<>^]/.test(arg) ? `"${arg.replaceAll('"', '""')}"` : arg;

export interface RunOptions {
  cwd: string;
  env?: Record<string, string>;
  /** Show the command's output as it runs, rather than only when it fails. */
  inherit?: boolean;
  /** Kill the command after this long. */
  timeoutMs?: number;
}

/** Runs a command; rejects with its output when it exits non-zero. */
export function run(command: string, args: string[], options: RunOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      isWindows ? [command, ...args].map(quote).join(" ") : command,
      isWindows ? [] : args,
      {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        shell: isWindows,
        stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    const timer = options.timeoutMs
      ? setTimeout(() => {
          output += `\nTimed out after ${Math.round((options.timeoutMs ?? 0) / 1000)}s`;
          // On Windows the child is cmd.exe; its own children hold the pipes open, so kill the tree.
          if (isWindows && child.pid)
            spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
          else child.kill();
        }, options.timeoutMs)
      : undefined;
    child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}\n${output.trim()}`));
    });
  });
}

/** A command's trimmed stdout, or undefined if it can't run. */
export function capture(command: string, args: string[], cwd = process.cwd()): string | undefined {
  const result = spawnSync(
    isWindows ? [command, ...args].map(quote).join(" ") : command,
    isWindows ? [] : args,
    {
      cwd,
      encoding: "utf8",
      shell: isWindows,
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  return result.status === 0 ? result.stdout.trim() || undefined : undefined;
}
