import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import type { UnpluginCargoOptions } from "../../src/index";
import { runInBrowser } from "./browser";
import { cleanupFixture } from "./fixture";
import { startServer } from "./server";

export function runBundlerTests(
	name: string,
	buildFn: (options: UnpluginCargoOptions) => Promise<string>,
) {
	describe.concurrent(name, () => {
		const fixtureRoots = new Set<string>();

		const buildAndTrack = async (options: UnpluginCargoOptions) => {
			const outDir = await buildFn(options);
			fixtureRoots.add(path.dirname(path.dirname(outDir)));
			return outDir;
		};

		afterAll(async () => {
			for (const root of fixtureRoots) {
				await cleanupFixture(path.join(root, "dists", "placeholder"));
			}
		});

		test("default options", async () => {
			const outDir = await buildAndTrack({ pattern: "**/src/lib.rs" });
			const { url, close } = await startServer(outDir);
			try {
				const result = await runInBrowser(url);
				expect(result.add).toBe(4);
				expect(result.multiplyAvailable).toBe(false);
			} finally {
				await close();
			}
		});

		test("features: ['multiply']", async () => {
			const outDir = await buildAndTrack({
				pattern: "**/src/lib.rs",
				features: ["multiply"],
			});
			const { url, close } = await startServer(outDir);
			try {
				const result = await runInBrowser(url);
				expect(result.add).toBe(4);
				expect(result.multiplyAvailable).toBe(true);
				expect(result.multiply).toBe(12);
			} finally {
				await close();
			}
		});

		test("allFeatures: true", async () => {
			const outDir = await buildAndTrack({
				pattern: "**/src/lib.rs",
				allFeatures: true,
			});
			const { url, close } = await startServer(outDir);
			try {
				const result = await runInBrowser(url);
				expect(result.add).toBe(4);
				expect(result.multiplyAvailable).toBe(true);
				expect(result.multiply).toBe(12);
			} finally {
				await close();
			}
		});

		test("noDefaultFeatures: true", async () => {
			const outDir = await buildAndTrack({
				pattern: "**/src/lib.rs",
				noDefaultFeatures: true,
			});
			const { url, close } = await startServer(outDir);
			try {
				const result = await runInBrowser(url);
				expect(result.add).toBe(4);
				expect(result.multiplyAvailable).toBe(false);
			} finally {
				await close();
			}
		});

		test("production: true", async () => {
			const outDir = await buildAndTrack({
				pattern: "**/src/lib.rs",
				production: true,
			});
			const { url, close } = await startServer(outDir);
			try {
				const result = await runInBrowser(url);
				expect(result.add).toBe(4);
			} finally {
				await close();
			}
		});

		test("cargoBuildProfile: 'custom-profile'", async () => {
			const outDir = await buildAndTrack({
				pattern: "**/src/lib.rs",
				cargoBuildProfile: "custom-profile",
			});
			const { url, close } = await startServer(outDir);
			try {
				const result = await runInBrowser(url);
				expect(result.add).toBe(4);
			} finally {
				await close();
			}
		});

		test("browserOnly: true", async () => {
			const outDir = await buildAndTrack({
				pattern: "**/src/lib.rs",
				browserOnly: true,
			});
			const { url, close } = await startServer(outDir);
			try {
				const result = await runInBrowser(url);
				expect(result.add).toBe(4);
			} finally {
				await close();
			}
		});

		test("noTypescript: true", async () => {
			const outDir = await buildAndTrack({
				pattern: "**/src/lib.rs",
				noTypescript: true,
			});
			const { url, close } = await startServer(outDir);
			try {
				const result = await runInBrowser(url);
				expect(result.add).toBe(4);
			} finally {
				await close();
			}
		});

		test("cargoBuildOverrides", async () => {
			const outDir = await buildAndTrack({
				pattern: "**/src/lib.rs",
				cargoBuildOverrides: (args) =>
					args.filter((a) => a !== "--quiet").concat("--verbose"),
			});
			const { url, close } = await startServer(outDir);
			try {
				const result = await runInBrowser(url);
				expect(result.add).toBe(4);
			} finally {
				await close();
			}
		});
	});
}
