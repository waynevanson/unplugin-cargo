import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Browser, chromium } from "@playwright/test";

const WS_ENDPOINT_FILE = path.join(
	os.tmpdir(),
	"unplugin-cargo-playwright-ws-endpoint",
);

let browser: Browser | undefined;

async function connectSharedBrowser(): Promise<Browser> {
	const wsEndpoint = await fs.promises.readFile(WS_ENDPOINT_FILE, "utf8");
	return chromium.connect(wsEndpoint);
}

export async function getBrowser(): Promise<Browser> {
	if (!browser) {
		browser = await connectSharedBrowser();
	}
	return browser;
}

export interface BrowserResult {
	add?: number;
	multiplyAvailable?: boolean;
	multiply?: number | null;
	value?: number;
	featureAvailable?: boolean;
	feature?: boolean | null;
	error?: string;
	stack?: string;
}

export async function runInBrowser(url: string): Promise<BrowserResult> {
	const browser = await getBrowser();
	const page = await browser.newPage();
	try {
		await page.goto(url);
		await page.waitForSelector("#result:not(:empty)", { timeout: 30000 });
		const raw = await page.textContent("#result");
		if (!raw) throw new Error("No result found");
		return JSON.parse(raw) as BrowserResult;
	} finally {
		await page.close();
	}
}
