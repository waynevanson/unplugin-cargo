import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import type { UnpluginCargoOptions } from "../../src/index";
import { runInBrowser } from "./browser";
import { cleanupFixture, createFixture } from "./fixture";
import { startServer } from "./server";
import type { WatchWith } from "./watcher/types";

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
			const fixtureRoot = path.dirname(path.dirname(outDir));
			const wasmPath = path.resolve(
				fixtureRoot,
				"target/wasm32-unknown-unknown/release/bro.wasm",
			);
			await expect(fs.access(wasmPath)).resolves.not.toThrow();

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

		test("throws for a non-cdylib fixture", async () => {
			const fixture = await createFixture();
			fixtureRoots.add(fixture);

			await fs.writeFile(
				path.resolve(fixture, "Cargo.toml"),
				[
					"[package]",
					'name = "not-cdylib"',
					'version = "0.1.0"',
					'edition = "2024"',
					"",
					"[lib]",
					'name = "not_cdylib"',
					'crate-type = ["rlib"]',
					"",
					"[dependencies]",
					'wasm-bindgen = "=0.2.121"',
					"",
					"[workspace]",
					'members = ["."]',
					'resolver = "3"',
				].join("\n"),
			);

			const libraryFilePath = path.resolve(fixture, "src/lib.rs");
			const error = await buildFn({ pattern: "**/src/lib.rs" }, fixture).catch(
				(e: Error) => e,
			);
			expect(error.message).toContain(
				"Expected exactly 1 target to match the src_path of",
			);
			expect(error.message).toContain(libraryFilePath);
			expect(error.message).toContain("cdylib");
		});

		test("throws for a workspace without a matching package", async () => {
			const fixture = await createFixture();
			fixtureRoots.add(fixture);

			const projectFilePath = path.resolve(fixture, "Cargo.toml");
			await fs.writeFile(
				projectFilePath,
				["[workspace]", "members = []", 'resolver = "3"'].join("\n"),
			);

			const error = await buildFn({ pattern: "**/src/lib.rs" }, fixture).catch(
				(e: Error) => e,
			);
			expect(error.message).toContain(
				"Expected exactly 1 package to have the manifest_path of",
			);
			expect(error.message).toContain(projectFilePath);
		});
	});
}

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

	describe(name, () => {
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

					const session = await watchWith(fixture, {
						pattern: "**/src/lib.rs",
					});
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

					const { url: url2, close: close2 } = await startServer(
						session.outDir,
					);
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
	});
}
