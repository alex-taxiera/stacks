import { STACKS } from "../stacks.ts";

export function listCommand() {
  for (const stack of Object.values(STACKS)) {
    console.log(`${stack.id} — ${stack.summary}`);
    for (const [id, deploy] of Object.entries(stack.deploys)) {
      const flag = id === stack.defaultDeploy ? " (default)" : "";
      console.log(`  --deploy ${id}${flag}: ${deploy.summary}`);
    }
    const addons = Object.entries(stack.addons);
    if (addons.length > 0) {
      console.log(`  --with ${addons.map(([id]) => id).join(",")}`);
      for (const [id, addon] of addons) console.log(`    ${id}: ${addon.summary}`);
    }
    console.log();
  }
}
