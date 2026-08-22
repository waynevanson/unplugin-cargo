import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { UnpluginCargoOptions } from "../../src/index";
import { unpluginFactory } from "../../src/internal/core";
import { runInBrowser } from "./browser";
import { cleanupFixture, getFixture } from "./fixture";
import { startServer } from "./server";

// biome-ignore lint/suspicious/noExportsInTest: shared runner imported by bundler specs
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

const FIXTURES = path.resolve(import.meta.dirname, "../../fixtures");

describe("unplugin-cargo internals", () => {
	let fixture: string;
	let libraryFilePath: string;

	beforeAll(async () => {
		fixture = await getFixture({ pattern: "**/src/lib.rs" });
		libraryFilePath = path.resolve(fixture, "src/lib.rs");
	}, 120_000);

	afterAll(async () => {
		await cleanupFixture(path.join(fixture, "dists", "placeholder"));
	});

	describe("pattern matching", () => {
		test("returns null for non-matching ids", async () => {
			const contexts = [
				{ pattern: "**/src/lib.rs", id: "/foo/other.rs" },
				{ pattern: /\/src\/lib\.rs$/, id: "/foo/other.rs" },
				{ pattern: ["**/src/lib.rs", "**/main.rs"], id: "/foo/other.rs" },
				{
					pattern: { include: "**/*.rs", exclude: "**/node_modules/**" },
					id: "/project/node_modules/foo.rs",
				},
				{
					pattern: { include: ["**/src/lib.rs", "**/main.rs"] },
					id: "/foo/other.rs",
				},
			];

			for (const { pattern, id } of contexts) {
				const plugin = unpluginFactory({ pattern });
				const result = await plugin.transform.call(
					{ addWatchFile: () => {} },
					"",
					id,
				);
				expect(result).toBeNull();
			}
		});
	});

	describe("production resolution", () => {
		test("falls back to NODE_ENV and respects explicit option", async () => {
			const previous = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";
			try {
				const contexts: Array<{ production: boolean }> = [];
				const plugin = unpluginFactory({
					pattern: "**/src/lib.rs",
					cargoBuildProfile: (context) => {
						contexts.push(context);
						return "dev";
					},
				});

				await plugin.transform.call(
					{ addWatchFile: () => {} },
					"",
					libraryFilePath,
				);
				expect(contexts).toContainEqual({ production: true });

				contexts.length = 0;
				const explicitPlugin = unpluginFactory({
					pattern: "**/src/lib.rs",
					production: false,
					cargoBuildProfile: (context) => {
						contexts.push(context);
						return "dev";
					},
				});
				await explicitPlugin.transform.call(
					{ addWatchFile: () => {} },
					"",
					libraryFilePath,
				);
				expect(contexts).toContainEqual({ production: false });
			} finally {
				process.env.NODE_ENV = previous;
			}
		});
	});

	describe("target metadata", () => {
		test("throws for a non-cdylib fixture", async () => {
			const notCdylibLibraryFilePath = path.resolve(
				FIXTURES,
				"not-cdylib/src/lib.rs",
			);
			const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });

			await expect(
				plugin.transform.call(
					{ addWatchFile: () => {} },
					"",
					notCdylibLibraryFilePath,
				),
			).rejects.toThrow(
				`Expected exactly 1 target to match the src_path of "${notCdylibLibraryFilePath}" and be a "cdylib" target`,
			);
		});
	});

	describe("watchChange", () => {
		test("does not throw", () => {
			const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
			if (!plugin.watchChange) {
				throw new Error("Expected watchChange to be defined");
			}
			expect(() =>
				plugin.watchChange("/project/src/lib.rs", "update"),
			).not.toThrow();
		});
	});

	describe("resolveId", () => {
		test("returns null for absolute and unmatched importers", () => {
			const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
			if (!plugin.resolveId) {
				throw new Error("Expected resolveId to be defined");
			}
			expect(plugin.resolveId("/absolute/path.js", libraryFilePath)).toBeNull();
			expect(plugin.resolveId("./foo.js", libraryFilePath)).toBeNull();
		});

		test(
			"resolves relative imports after transform",
			{ timeout: 120_000 },
			async () => {
				const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
				if (!plugin.resolveId) {
					throw new Error("Expected resolveId to be defined");
				}

				await plugin.transform.call(
					{ addWatchFile: () => {} },
					"",
					libraryFilePath,
				);

				const resolved = plugin.resolveId("./bro_bg.wasm", libraryFilePath);
				expect(resolved).toContain("bro_bg.wasm");
				expect(path.isAbsolute(resolved as string)).toBe(true);
			},
		);
	});

	describe("transform", () => {
		test(
			"builds and registers watched files",
			{ timeout: 120_000 },
			async () => {
				const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
				const watched: Array<string> = [];
				const context = { addWatchFile: (id: string) => watched.push(id) };

				const result = await plugin.transform.call(
					context,
					"",
					libraryFilePath,
				);

				expect(result).toHaveProperty("code");
				expect(result?.code).toContain("wasm");
				expect(watched).toContain(path.resolve(fixture, "Cargo.toml"));
				expect(watched).toContain(`${libraryFilePath}.d.ts`);
			},
		);

		test("builds without addWatchFile", { timeout: 120_000 }, async () => {
			const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
			const result = await plugin.transform.call({}, "", libraryFilePath);
			expect(result).toHaveProperty("code");
		});
	});
});
