import { closeBrowser } from "./helpers/browser";
import { cleanupAllFixtures, cleanupCache } from "./helpers/fixture";

export function setup() {}

export async function teardown() {
	await closeBrowser();
	await cleanupAllFixtures();
	await cleanupCache();
}
