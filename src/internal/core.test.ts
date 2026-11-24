import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { UnpluginOptions } from "unplugin";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupFixture, getFixture } from "../../test/helpers/fixture";
import { resolveProduction, unpluginFactory } from "./core";

type Transform = (
	this: { addWatchFile?: (id: string) => void },
	code: string,
	id: string,
) => Promise<unknown>;

function getTransform(plugin: UnpluginOptions): Transform {
	if (typeof plugin.transform !== "function") {
		throw new Error("Expected transform to be a function");
	}

	return plugin.transform as unknown as Transform;
}

describe("resolveProduction", () => {
	it("prefers an explicit production option", () => {
		const previous = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";
		try {
			expect(resolveProduction({ production: false })).toBe(false);
			expect(resolveProduction({})).toBe(true);
		} finally {
			process.env.NODE_ENV = previous;
		}
	});

	it("falls back to a non-production NODE_ENV", () => {
		const previous = process.env.NODE_ENV;
		process.env.NODE_ENV = "test";
		try {
			expect(resolveProduction({})).toBe(false);
		} finally {
			process.env.NODE_ENV = previous;
		}
	});
});

describe("unpluginFactory", () => {
	let fixture: string;
	let libraryFilePath: string;

	beforeAll(async () => {
		fixture = await getFixture({ pattern: "**/src/lib.rs" });
		libraryFilePath = path.resolve(fixture, "src/lib.rs");
	});

	afterAll(async () => {
		if (fixture) {
			await cleanupFixture(path.join(fixture, "dists", "placeholder"));
		}
	});

	it("ignores files that are not rust", async () => {
		const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
		const transform = getTransform(plugin);

		await expect(
			transform.call({}, "", path.resolve(fixture, "src/index.js")),
		).resolves.toBeNull();
	});

	it("ignores rust files outside a cargo project", async () => {
		const directory = await mkdtemp(
			path.join(os.tmpdir(), "unplugin-cargo-no-project-"),
		);
		const rustFile = path.resolve(directory, "lib.rs");
		await writeFile(rustFile, "// not part of a cargo project");
		const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
		const transform = getTransform(plugin);

		try {
			await expect(transform.call({}, "", rustFile)).resolves.toBeNull();
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	it("ignores rust files that do not match the pattern", async () => {
		const ignoredFile = path.resolve(fixture, "src/not-an-entry.rs");
		await writeFile(ignoredFile, "// not an entrypoint");
		const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
		const transform = getTransform(plugin);

		try {
			await expect(transform.call({}, "", ignoredFile)).resolves.toBeNull();
		} finally {
			await rm(ignoredFile, { force: true });
		}
	});

	it("resolves relative imports after transforming a library", async () => {
		const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
		const transform = getTransform(plugin);
		const resolveId = plugin.resolveId as unknown as (
			source: string,
			importer: string,
		) => string | null;

		await transform.call({ addWatchFile: () => {} }, "", libraryFilePath);

		const resolved = await resolveId("./bro_bg.wasm", libraryFilePath);
		expect(resolved).toContain("bro_bg.wasm");
		expect(path.isAbsolute(resolved as string)).toBe(true);
	});

	it("builds without addWatchFile", async () => {
		const plugin = unpluginFactory({ pattern: "**/src/lib.rs" });
		const transform = getTransform(plugin);

		const result = await transform.call({}, "", libraryFilePath);

		expect(result).toHaveProperty("code");
	});
});
