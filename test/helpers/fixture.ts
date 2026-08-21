import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";

const SOURCE = path.resolve(import.meta.dirname, "../../fixtures/lib");
const ROOT = path.resolve(import.meta.dirname, "../../fixtures/fixture");

export async function createFixture(): Promise<string> {
	const testName = expect.getState().currentTestName;

	if (!testName) {
		throw expect(testName).toBeTruthy();
	}

	const target = path.join(ROOT, testName.replace(/:/g, "-"));

	await fs.rm(target, { recursive: true, force: true });
	await fs.mkdir(target, { recursive: true });
	await copyDirectory(SOURCE, target);

	return target;
}

const SKIP = new Set(["target", "dist", "dists"]);

async function copyDirectory(source: string, target: string) {
	const entries = await fs.readdir(source, { withFileTypes: true });
	for (const entry of entries) {
		if (SKIP.has(entry.name)) continue;

		const sourcePath = path.join(source, entry.name);
		const targetPath = path.join(target, entry.name);
		if (entry.isDirectory()) {
			await fs.mkdir(targetPath, { recursive: true });
			await copyDirectory(sourcePath, targetPath);
		} else if (entry.isFile()) {
			await fs.copyFile(sourcePath, targetPath);
		}
	}
}
