import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";
import type { UnpluginCargoOptions } from "../../dist/index";

const SOURCE = path.resolve(import.meta.dirname, "../../fixtures/lib");
export const ROOT = path.resolve(
	import.meta.dirname,
	"../../fixtures/.fixtures",
);
const CACHE_DIR = path.resolve("node_modules", ".cache", "unplugin-cargo");

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

function resolveProfile(options: UnpluginCargoOptions): string {
	if (typeof options.cargoBuildProfile === "string") {
		return options.cargoBuildProfile;
	}
	const production = options.production ?? false;
	return (
		options.cargoBuildProfile?.({ production }) ??
		(production ? "release" : "dev")
	);
}

function normalizeFeatures(options: UnpluginCargoOptions) {
	if ("allFeatures" in options && options.allFeatures) {
		return { allFeatures: true };
	}
	return {
		features: options.features ?? [],
		noDefaultFeatures: options.noDefaultFeatures ?? false,
	};
}

function hashOptions(options: UnpluginCargoOptions): string {
	const normalized = {
		pattern: options.pattern,
		features: normalizeFeatures(options),
		profile: resolveProfile(options),
		target: options.cargoBuildTarget ?? "wasm32-unknown-unknown",
		browserOnly: options.browserOnly ?? false,
		noTypescript: options.noTypescript ?? false,
	};
	const json = JSON.stringify(normalized, Object.keys(normalized).sort());
	return crypto.createHash("sha256").update(json).digest("hex").slice(0, 16);
}

export async function getFixture(
	options: UnpluginCargoOptions,
): Promise<string> {
	const hash = hashOptions(options);
	const target = path.join(ROOT, hash);

	await fs.mkdir(target, { recursive: true });
	await copyDirectory(SOURCE, target);

	return target;
}

const SKIP = new Set(["target", "dist", "dists"]);

export async function cleanupFixture(outDir: string): Promise<void> {
	const distsDir = path.dirname(outDir);
	const fixtureRoot = path.dirname(distsDir);
	await fs.rm(fixtureRoot, { recursive: true, force: true });
}

export async function cleanupCache(): Promise<void> {
	await fs.rm(CACHE_DIR, { recursive: true, force: true });
}

export async function cleanupAllFixtures(): Promise<void> {
	await fs.rm(ROOT, { recursive: true, force: true });
}

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
