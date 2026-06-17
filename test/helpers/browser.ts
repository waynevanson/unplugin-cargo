import { chromium, type Browser } from "@playwright/test";

let browser: Browser | undefined;

const CHROMIUM_PATH =
	"/nix/store/whxq6a57pq26hwgzmpn7hdsw819dy7kk-playwright-chromium/chrome-linux64/chrome";

export async function getBrowser(): Promise<Browser> {
	if (!browser) {
		browser = await chromium.launch({
			executablePath: CHROMIUM_PATH,
		});
	}
	return browser;
}

export async function runInBrowser(url: string): Promise<{
	add: number;
	multiplyAvailable: boolean;
	multiply: number | null;
}> {
	const browser = await getBrowser();
	const page = await browser.newPage();
	try {
		await page.goto(url);
		await page.waitForSelector("#result:not(:empty)", { timeout: 30000 });
		const raw = await page.textContent("#result");
		if (!raw) throw new Error("No result found");
		return JSON.parse(raw);
	} finally {
		await page.close();
	}
}

export async function closeBrowser(): Promise<void> {
	if (browser) {
		await browser.close();
		browser = undefined;
	}
}
