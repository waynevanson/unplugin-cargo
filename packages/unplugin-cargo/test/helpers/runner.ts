import path from "node:path";
import type * as valibot from "valibot";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { resolveProduction, unpluginFactory } from "../../src/core";
import {
	createGraphFromDependencies,
	findLibraryDependencies,
} from "../../src/find-library-dependencies";
import { HashSet } from "../../src/hash-set";
import type { UnpluginCargoOptions } from "../../src/index";
import {
	findLibraryMetadata,
	findProjectMetadata,
	type MetadataSchema,
} from "../../src/metadata";
import { createLibraryDir, findOnlyOne, isString } from "../../src/utils";
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

	describe("utils", () => {
		test("isString", () => {
			expect(isString("hello")).toBe(true);
			expect(isString(1)).toBe(false);
			expect(isString(null)).toBe(false);
		});

		test("findOnlyOne", () => {
			expect(findOnlyOne([1, 2, 3], (n) => n === 2)).toBe(2);
			expect(findOnlyOne([1, 2, 2, 3], (n) => n === 2)).toBe(2);
			expect(findOnlyOne([1, 2, 3], (n) => n === 4)).toBeUndefined();
		});

		test("createLibraryDir", () => {
			expect(createLibraryDir("abcdef")).toBe(
				path.resolve("node_modules/.cache/unplugin-cargo", "ab", "cdef"),
			);
			expect(() => createLibraryDir("ab")).toThrow(
				'Expected hash to be a string greater than two but received "ab"',
			);
		});
	});

	describe("HashSet", () => {
		test("supports add, has, delete and iteration", () => {
			const initial = new HashSet([{ a: 0 }]);
			expect(initial.has({ a: 0 })).toBe(true);

			const set = new HashSet<{ a: number }>();
			const value = { a: 1 };
			const hash = set.add(value);

			expect(set.has(value)).toBe(true);
			expect(set.has({ a: 1 })).toBe(true);
			expect(set.hashes()).toContain(hash);
			expect(set.findHashFromValue((v) => v.a === 1)).toBe(hash);
			expect(set.findHashFromValue((v) => v.a === 3)).toBeUndefined();

			expect(Array.from(set).map((v) => v.a)).toEqual([1]);
			expect(Array.from(set.entries())).toHaveLength(1);

			expect(set.delete(value)).toBe(true);
			expect(set.delete(value)).toBe(false);
			expect(Array.from(set.hashes())).toEqual([]);
		});
	});

	describe("find-library-dependencies", () => {
		test("createGraphFromDependencies parses escaped spaces and ignores invalid lines", () => {
			const contents = [
				"src/lib.rs: src/lib.rs src/dep.rs",
				"src/dep.rs: src/dep.rs src/other.rs",
				"src/foo.rs: src/bar\\ baz.rs",
				"invalid line without colon",
				"",
			].join("\n");

			const graph = createGraphFromDependencies(contents, "/project");

			expect(graph.get(path.resolve("/project", "src/lib.rs"))).toEqual(
				new Set([
					path.resolve("/project", "src/lib.rs"),
					path.resolve("/project", "src/dep.rs"),
				]),
			);
			expect(graph.get(path.resolve("/project", "src/foo.rs"))).toEqual(
				new Set([path.resolve("/project", "src/bar baz.rs")]),
			);
		});

		test("findLibraryDependencies returns all transitive descendants", async () => {
			const dir = path.resolve(FIXTURES, "dependencies");
			const result = await findLibraryDependencies({
				projectRoot: dir,
				libraryDepsDir: dir,
				libraryTargetName: "graph",
			});

			expect(result).toEqual(
				new Set([path.resolve(dir, "a"), path.resolve(dir, "b")]),
			);
		});

		test("findLibraryDependencies throws when the wasm entry is missing", async () => {
			const dir = path.resolve(FIXTURES, "dependencies");
			await expect(
				findLibraryDependencies({
					projectRoot: dir,
					libraryDepsDir: dir,
					libraryTargetName: "missing",
				}),
			).rejects.toThrow(
				"Expect the start value to exist in the dependency graph",
			);
		});
	});

	describe("metadata", () => {
		test("findProjectMetadata parses a real Cargo manifest", async () => {
			const log = { debug: () => {} } as unknown as import("pino").Logger;
			const result = await findProjectMetadata(
				path.resolve(FIXTURES, "lib/Cargo.toml"),
				log,
			);
			expect(result.packages).toEqual(
				expect.arrayContaining([expect.objectContaining({ name: "bruv" })]),
			);
		});

		test("findLibraryMetadata throws for a non-cdylib target", async () => {
			const log = { debug: () => {} } as unknown as import("pino").Logger;
			const projectFilePath = path.resolve(FIXTURES, "not-cdylib/Cargo.toml");
			const libraryFilePath = path.resolve(FIXTURES, "not-cdylib/src/lib.rs");
			const projectMetadata = await findProjectMetadata(projectFilePath, log);

			expect(() =>
				findLibraryMetadata({
					projectMetadata: projectMetadata as valibot.InferOutput<
						typeof MetadataSchema
					>,
					libraryFilePath,
					projectFilePath,
				}),
			).toThrow(
				`Expected exactly 1 target to match the src_path of "${libraryFilePath}" and be a "cdylib" target`,
			);
		});

		test("findLibraryMetadata throws when no package matches", () => {
			const projectMetadata = {
				target_directory: "/project/target",
				packages: [
					{
						name: "pkg",
						id: "pkg",
						manifest_path: "/project/Cargo.toml",
						dependencies: [],
						targets: [
							{
								name: "pkg",
								kind: ["cdylib"],
								crate_types: ["cdylib"],
								src_path: "/project/src/lib.rs",
							},
						],
					},
				],
			};

			expect(() =>
				findLibraryMetadata({
					projectMetadata: projectMetadata as valibot.InferOutput<
						typeof MetadataSchema
					>,
					libraryFilePath: "/project/src/lib.rs",
					projectFilePath: "/other/Cargo.toml",
				}),
			).toThrow(
				'Expected exactly 1 package to have the manifest_path of "/other/Cargo.toml"',
			);
		});
	});

	describe("core", () => {
		test("pattern matching returns null for non-matching ids", async () => {
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

		test("resolveProduction falls back to NODE_ENV", () => {
			const previous = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";
			try {
				expect(resolveProduction({})).toBe(true);
				expect(resolveProduction({ production: false })).toBe(false);
			} finally {
				process.env.NODE_ENV = previous;
			}
		});

		test("watchChange does not throw", () => {
			const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
			if (!plugin.watchChange) {
				throw new Error("Expected watchChange to be defined");
			}
			expect(() =>
				plugin.watchChange("/project/src/lib.rs", "update"),
			).not.toThrow();
		});

		test("resolveId returns null for absolute and unmatched importers", () => {
			const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
			if (!plugin.resolveId) {
				throw new Error("Expected resolveId to be defined");
			}
			expect(plugin.resolveId("/absolute/path.js", libraryFilePath)).toBeNull();
			expect(plugin.resolveId("./foo.js", libraryFilePath)).toBeNull();
		});

		test(
			"transform builds and registers watched files",
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

		test(
			"transform builds without addWatchFile",
			{ timeout: 120_000 },
			async () => {
				const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
				const result = await plugin.transform.call({}, "", libraryFilePath);
				expect(result).toHaveProperty("code");
			},
		);

		test(
			"resolveId resolves relative imports after transform",
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
});
