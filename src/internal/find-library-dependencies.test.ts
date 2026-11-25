import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	createGraphFromDependencies,
	findAllDescendants,
	findLibraryDependencies,
} from "./find-library-dependencies";

const temporaryDirectories = new Set<string>();

async function createTemporaryDirectory() {
	const directory = await mkdtemp(
		path.join(os.tmpdir(), "unplugin-cargo-dependencies-"),
	);
	temporaryDirectories.add(directory);
	return directory;
}

afterEach(async () => {
	await Promise.all(
		Array.from(temporaryDirectories, (directory) =>
			rm(directory, { recursive: true, force: true }),
		),
	);
	temporaryDirectories.clear();
});

describe("createGraphFromDependencies", () => {
	it("resolves workspace-relative dep-info paths against the workspace root", () => {
		const workspaceRoot = path.resolve("/work/repo");
		const depsDir = path.resolve(workspaceRoot, "target/debug/deps");
		const dFile = path.resolve(depsDir, "dodgeball_sim.d");
		const wasmFile = path.resolve(depsDir, "dodgeball_sim.wasm");

		const contents = [
			`${dFile}: crates/sim/src/lib.rs crates/sim/src/game/mod.rs`,
			`${wasmFile}: crates/sim/src/lib.rs`,
		].join("\n");

		const graph = createGraphFromDependencies(contents, workspaceRoot);

		expect(graph.get(dFile)).toEqual(
			new Set([
				path.resolve(workspaceRoot, "crates/sim/src/game/mod.rs"),
				path.resolve(workspaceRoot, "crates/sim/src/lib.rs"),
			]),
		);
		expect(graph.get(wasmFile)).toEqual(
			new Set([path.resolve(workspaceRoot, "crates/sim/src/lib.rs")]),
		);
	});

	it("leaves absolute dep-info paths alone", () => {
		const workspaceRoot = path.resolve("/work/repo");
		const dFile = path.resolve(
			workspaceRoot,
			"target/debug/deps/dodgeball_sim.d",
		);
		const source = path.resolve(workspaceRoot, "crates/sim/src/lib.rs");

		const graph = createGraphFromDependencies(
			`${dFile}: ${source}`,
			workspaceRoot,
		);

		expect(graph.get(dFile)).toEqual(new Set([source]));
	});

	it("ignores dep-info lines without a separator", () => {
		const workspaceRoot = path.resolve("/work/repo");
		const source = path.resolve(workspaceRoot, "crates/sim/src/lib.rs");

		const graph = createGraphFromDependencies(
			["not-a-dependency", `graph.wasm: ${source}`].join("\n"),
			workspaceRoot,
		);

		expect(graph).toEqual(
			new Map([[path.resolve(workspaceRoot, "graph.wasm"), new Set([source])]]),
		);
	});
});

describe("findAllDescendants", () => {
	it("throws when the start node is missing", () => {
		expect(() => findAllDescendants("/missing", new Map())).toThrow(
			"Expect the start value to exist in the dependency graph",
		);
	});

	it("handles shared and cyclic dependencies exactly once", () => {
		const root = path.resolve("/work/repo");
		const a = path.resolve(root, "a");
		const b = path.resolve(root, "b");
		const graph = new Map([
			[path.resolve(root, "graph.wasm"), new Set([a, b])],
			[a, new Set([b])],
			[b, new Set([a])],
		]);

		expect(findAllDescendants(path.resolve(root, "graph.wasm"), graph)).toEqual(
			new Set([a, b]),
		);
	});
});

describe("findLibraryDependencies", () => {
	it("reads dependencies from the deps directory and walks the graph", async () => {
		const workspaceRoot = await createTemporaryDirectory();
		const libraryDepsDir = path.resolve(workspaceRoot, "deps");
		const libraryBuildDir = path.resolve(workspaceRoot, "build");
		await mkdir(libraryDepsDir);
		await mkdir(libraryBuildDir);
		await writeFile(
			path.resolve(libraryDepsDir, "lib.d"),
			[
				"deps/lib.wasm: src/a.rs src/b.rs",
				"src/a.rs: src/b.rs",
				"src/b.rs: src/a.rs",
			].join("\n"),
		);

		const dependencies = await findLibraryDependencies({
			workspaceRoot,
			libraryBuildDir,
			libraryDepsDir,
			libraryTargetName: "lib",
		});

		expect(dependencies).toEqual(
			new Set([
				path.resolve(workspaceRoot, "src/a.rs"),
				path.resolve(workspaceRoot, "src/b.rs"),
			]),
		);
	});

	it("falls back to the build directory for the dep-info file", async () => {
		const workspaceRoot = await createTemporaryDirectory();
		const libraryDepsDir = path.resolve(workspaceRoot, "deps");
		const libraryBuildDir = path.resolve(workspaceRoot, "build");
		await mkdir(libraryDepsDir);
		await mkdir(libraryBuildDir);
		await writeFile(
			path.resolve(libraryBuildDir, "lib.d"),
			"build/lib.wasm: src/lib.rs",
		);

		const dependencies = await findLibraryDependencies({
			workspaceRoot,
			libraryBuildDir,
			libraryDepsDir,
			libraryTargetName: "lib",
		});

		expect(dependencies).toEqual(
			new Set([path.resolve(workspaceRoot, "src/lib.rs")]),
		);
	});

	it("throws when no dep-info file exists", async () => {
		const workspaceRoot = await createTemporaryDirectory();
		const libraryDepsDir = path.resolve(workspaceRoot, "deps");
		const libraryBuildDir = path.resolve(workspaceRoot, "build");
		await mkdir(libraryDepsDir);
		await mkdir(libraryBuildDir);

		await expect(
			findLibraryDependencies({
				workspaceRoot,
				libraryBuildDir,
				libraryDepsDir,
				libraryTargetName: "lib",
			}),
		).rejects.toThrow("Expected one of the following files to exist");
	});

	it("propagates non-ENOENT errors while looking for dep-info files", async () => {
		const workspaceRoot = await createTemporaryDirectory();
		const libraryDepsDir = path.resolve(workspaceRoot, "deps");
		const libraryBuildDir = path.resolve(workspaceRoot, "build");
		await writeFile(libraryDepsDir, "");
		await mkdir(libraryBuildDir);

		await expect(
			findLibraryDependencies({
				workspaceRoot,
				libraryBuildDir,
				libraryDepsDir,
				libraryTargetName: "lib",
			}),
		).rejects.toMatchObject({ code: "ENOTDIR" });
	});

	it("throws when the wasm output is missing from the dependency graph", async () => {
		const workspaceRoot = await createTemporaryDirectory();
		const libraryDepsDir = path.resolve(workspaceRoot, "deps");
		const libraryBuildDir = path.resolve(workspaceRoot, "build");
		await mkdir(libraryDepsDir);
		await mkdir(libraryBuildDir);
		await writeFile(
			path.resolve(libraryDepsDir, "lib.d"),
			"deps/lib.d: src/lib.rs",
		);

		await expect(
			findLibraryDependencies({
				workspaceRoot,
				libraryBuildDir,
				libraryDepsDir,
				libraryTargetName: "lib",
			}),
		).rejects.toThrow(
			"Expect the wasm output to exist in the dependency graph",
		);
	});
});
