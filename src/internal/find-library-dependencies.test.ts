import path from "node:path";
import { describe, expect, it } from "vitest";
import { createGraphFromDependencies } from "./find-library-dependencies";

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
});
