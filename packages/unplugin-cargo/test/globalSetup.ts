import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type BrowserServer, chromium } from "@playwright/test";
import { cleanupAllFixtures, cleanupCache } from "./helpers/fixture";

const WS_ENDPOINT_FILE = path.join(
	os.tmpdir(),
	"unplugin-cargo-playwright-ws-endpoint",
);

let server: BrowserServer | undefined;

export async function setup() {
	server = await chromium.launchServer();
	await fs.promises.writeFile(WS_ENDPOINT_FILE, server.wsEndpoint(), "utf8");
}

export async function teardown() {
	if (server) {
		await server.close();
		server = undefined;
	}
	await fs.promises.rm(WS_ENDPOINT_FILE, { force: true });
	await cleanupAllFixtures();
	await cleanupCache();
}
