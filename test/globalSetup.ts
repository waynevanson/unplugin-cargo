import { execFileSync } from "node:child_process";
import { closeBrowser } from "./helpers/browser";
import { cleanupAllFixtures, cleanupCache } from "./helpers/fixture";

export function setup() {
	execFileSync("pnpm", ["run", "build"], {
		stdio: "inherit",
	});
}

export async function teardown() {
	await closeBrowser();
	await cleanupAllFixtures();
	await cleanupCache();
}
