import { execFileSync } from "node:child_process";

export function setup() {
	execFileSync("pnpm", ["run", "build"], {
		stdio: "inherit",
	});
}

export function teardown() {
	// no-op
}
