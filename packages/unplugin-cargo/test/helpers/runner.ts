import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { UnpluginCargoOptions } from "../../src/index";
import { unpluginFactory } from "../../src/internal/core";
import { matchesPattern } from "../../src/internal/pattern";
import { runInBrowser } from "./browser";
import { cleanupFixture, createFixture, getFixture } from "./fixture";
import { startServer } from "./server";
import type { WatchWith } from "./watcher/types";

// biome-ignore lint/suspicious/noExportsInTest: shared runner imported by bundler specs
export function runBundlerTests(
	name: string,
	buildFn: (options: UnpluginCargoOptions, fixture?: string) => Promise<string>,
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

// biome-ignore lint/suspicious/noExportsInTest: shared runner imported by watcher specs
export function runWatchTests(
	name: string,
	watchWith: WatchWith,
	{ skip }: { skip?: string } = {},
) {
	if (skip) {
		describe.skip(`${name} watch`, () => {
			test(skip, () => {});
		});
		return;
	}

	describe(`${name} watch`, () => {
		const fixtureRoots = new Set<string>();

		afterAll(async () => {
			for (const root of fixtureRoots) {
				await cleanupFixture(path.join(root, "dists", "placeholder"));
			}
		});

		test(
			"rebuilds when a source file changes",
			{ timeout: 180_000 },
			async () => {
				const fixture = await createFixture();
				fixtureRoots.add(fixture);

				await fs.writeFile(
					path.resolve(fixture, "src", "lib.rs"),
					[
						"use wasm_bindgen::prelude::*;",
						"",
						"#[wasm_bindgen]",
						"pub fn get_value() -> f64 { 1.0 }",
					].join("\n"),
				);

				await fs.writeFile(
					path.resolve(fixture, "src", "index.js"),
					[
						'import { get_value } from "./lib.rs";',
						'document.getElementById("result").textContent = JSON.stringify({ value: get_value() });',
					].join("\n"),
				);

				const session = await watchWith(fixture, { pattern: "**/src/lib.rs" });
				try {
					const { url, close } = await startServer(session.outDir);
					try {
						const result = await runInBrowser(url);
						expect(result.value).toBe(1);
					} finally {
						await close();
					}

					const rebuild = session.waitForRebuild();
					await fs.writeFile(
						path.resolve(fixture, "src", "lib.rs"),
						[
							"use wasm_bindgen::prelude::*;",
							"",
							"#[wasm_bindgen]",
							"pub fn get_value() -> f64 { 2.0 }",
						].join("\n"),
					);
					await rebuild;

					const { url: url2, close: close2 } = await startServer(
						session.outDir,
					);
					try {
						const result2 = await runInBrowser(url2);
						expect(result2.value).toBe(2);
					} finally {
						await close2();
					}
				} finally {
					await session.close();
				}
			},
		);

		test("rebuilds when build.rs changes", { timeout: 180_000 }, async () => {
			const fixture = await createFixture();
			fixtureRoots.add(fixture);

			await fs.writeFile(
				path.resolve(fixture, "build.rs"),
				'fn main() { println!("cargo:rustc-cfg=from_build_script"); }',
			);

			await fs.writeFile(
				path.resolve(fixture, "src", "lib.rs"),
				[
					"use wasm_bindgen::prelude::*;",
					"",
					"#[wasm_bindgen]",
					"pub fn get_value() -> f64 { 1.0 }",
					"",
					"#[cfg(from_build_script)]",
					"#[wasm_bindgen]",
					"pub fn feature() -> bool { true }",
				].join("\n"),
			);

			await fs.writeFile(
				path.resolve(fixture, "src", "index.js"),
				[
					'import("./lib.rs").then((mod) => {',
					'  document.getElementById("result").textContent = JSON.stringify({',
					"    value: mod.get_value(),",
					"    featureAvailable: typeof mod.feature === 'function',",
					"    feature: typeof mod.feature === 'function' ? mod.feature() : null,",
					"  });",
					"}).catch((err) => {",
					'  document.getElementById("result").textContent = JSON.stringify({ error: err.message });',
					"});",
				].join("\n"),
			);

			const session = await watchWith(fixture, {
				pattern: "**/src/lib.rs",
			});
			try {
				const { url, close } = await startServer(session.outDir);
				try {
					const result = await runInBrowser(url);
					expect(result.value).toBe(1);
					expect(result.featureAvailable).toBe(true);
					expect(result.feature).toBe(true);
				} finally {
					await close();
				}

				const rebuild = session.waitForRebuild();
				await fs.writeFile(path.resolve(fixture, "build.rs"), "fn main() {}");
				await rebuild;

				const { url: url2, close: close2 } = await startServer(session.outDir);
				try {
					const result2 = await runInBrowser(url2);
					expect(result2.value).toBe(1);
					expect(result2.featureAvailable).toBe(false);
				} finally {
					await close2();
				}
			} finally {
				await session.close();
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
		test("returns false for non-matching relative ids", () => {
			const contexts = [
				{ pattern: "src/lib.rs", id: "src/other.rs" },
				{ pattern: /src\/lib\.rs$/, id: "src/other.rs" },
				{ pattern: ["src/lib.rs", "main.rs"], id: "src/other.rs" },
				{
					pattern: { include: "**/*.rs", exclude: "**/node_modules/**" },
					id: "node_modules/foo.rs",
				},
				{
					pattern: { include: ["src/lib.rs", "main.rs"] },
					id: "src/other.rs",
				},
			];

			for (const { pattern, id } of contexts) {
				expect(matchesPattern(id, pattern)).toBe(false);
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

		test("throws for a workspace without a matching package", async () => {
			const workspaceOnlyLibraryFilePath = path.resolve(
				FIXTURES,
				"workspace-only/src/lib.rs",
			);
			const workspaceOnlyProjectFilePath = path.resolve(
				FIXTURES,
				"workspace-only/Cargo.toml",
			);
			const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });

			await expect(
				plugin.transform.call(
					{ addWatchFile: () => {} },
					"",
					workspaceOnlyLibraryFilePath,
				),
			).rejects.toThrow(
				`Expected exactly 1 package to have the manifest_path of "${workspaceOnlyProjectFilePath}"`,
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
