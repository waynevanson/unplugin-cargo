import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";

const SOURCE = path.resolve(import.meta.dirname, "../../fixtures/lib");
const ROOT = path.resolve(import.meta.dirname, "../../fixtures/fixture");
const WORKSPACE = path.resolve(import.meta.dirname, "../../Cargo.toml");

export async function createFixture(): Promise<string> {
	const testName = expect.getState().currentTestName ?? `unknown-${Date.now()}`;
	const hash = crypto
		.createHash("sha256")
		.update(testName)
		.digest("hex")
		.slice(0, 16);
	const target = path.join(ROOT, hash);

	await fs.rm(target, { recursive: true, force: true });
	await fs.mkdir(target, { recursive: true });
	await copyDirectory(SOURCE, target);
	await makeWorkspaceRoot(target);

	return target;
}

async function makeWorkspaceRoot(target: string) {
	const cargoToml = path.join(target, "Cargo.toml");
	const content = await fs.readFile(cargoToml, "utf8");
	const workspace = await fs.readFile(WORKSPACE, "utf8");
	const profiles = extractProfiles(workspace);
	const append = `\n[workspace]\nmembers = ["."]\nresolver = "3"\n\n${profiles}`;
	await fs.writeFile(cargoToml, `${content}\n${append}`);
}

function extractProfiles(workspace: string): string {
	const lines = workspace.split("\n");
	const result: string[] = [];
	let inProfile = false;

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("[profile.")) {
			inProfile = true;
			result.push(line);
			continue;
		}
		if (inProfile) {
			if (trimmed.startsWith("[")) {
				inProfile = false;
				continue;
			}
			result.push(line);
		}
	}

	return result.join("\n");
}

async function copyDirectory(source: string, target: string) {
	const entries = await fs.readdir(source, { withFileTypes: true });
	for (const entry of entries) {
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
