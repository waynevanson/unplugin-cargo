import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findProjectWatchFiles } from "./find-project-watch-files";

const temporaryDirectories = new Set<string>();

async function createTemporaryWorkspace() {
	const workspaceRoot = await mkdtemp(
		path.join(os.tmpdir(), "unplugin-cargo-watch-files-"),
	);
	temporaryDirectories.add(workspaceRoot);

	const projectRoot = path.resolve(workspaceRoot, "project");
	const libraryBuildDir = path.resolve(
		workspaceRoot,
		"target/wasm32-unknown-unknown/debug",
	);
	const libraryDepsDir = path.resolve(libraryBuildDir, "deps");

	await mkdir(path.resolve(projectRoot, "src/nested"), { recursive: true });
	await mkdir(path.resolve(projectRoot, "target"), { recursive: true });
	await mkdir(libraryDepsDir, { recursive: true });

	await writeFile(path.resolve(projectRoot, "Cargo.toml"), "");
	await writeFile(path.resolve(projectRoot, "src/lib.rs"), "");
	await writeFile(path.resolve(projectRoot, "src/nested/mod.rs"), "");
	await writeFile(path.resolve(projectRoot, "target/ignored.rs"), "");

	return {
		workspaceRoot,
		projectRoot,
		projectFilePath: path.resolve(projectRoot, "Cargo.toml"),
		libraryBuildDir,
		libraryDepsDir,
	};
}

afterEach(async () => {
	await Promise.all(
		Array.from(temporaryDirectories, (directory) =>
			rm(directory, { recursive: true, force: true }),
		),
	);
	temporaryDirectories.clear();
});

describe("findProjectWatchFiles", () => {
	it("collects manifests, rust sources and existing dependencies", async () => {
		const workspace = await createTemporaryWorkspace();
		const lockFile = path.resolve(workspace.workspaceRoot, "Cargo.lock");
		const buildScript = path.resolve(workspace.projectRoot, "build.rs");
		await writeFile(lockFile, "");
		await writeFile(buildScript, "");
		await writeFile(
			path.resolve(workspace.libraryDepsDir, "lib.d"),
			[
				"target/wasm32-unknown-unknown/debug/deps/lib.wasm: project/src/lib.rs project/src/missing.rs",
				"project/src/lib.rs: project/src/nested/mod.rs",
			].join("\n"),
		);

		const watched = await findProjectWatchFiles({
			...workspace,
			libraryTargetName: "lib",
		});

		expect(watched).toContain(workspace.projectFilePath);
		expect(watched).toContain(lockFile);
		expect(watched).toContain(buildScript);
		expect(watched).toContain(
			path.resolve(workspace.projectRoot, "src/lib.rs"),
		);
		expect(watched).toContain(
			path.resolve(workspace.projectRoot, "src/nested/mod.rs"),
		);
		expect(watched).not.toContain(
			path.resolve(workspace.projectRoot, "src/missing.rs"),
		);
		expect(watched).not.toContain(
			path.resolve(workspace.projectRoot, "target/ignored.rs"),
		);
	});

	it("does not require a Cargo.lock or build.rs", async () => {
		const workspace = await createTemporaryWorkspace();
		await writeFile(
			path.resolve(workspace.libraryDepsDir, "lib.d"),
			"target/wasm32-unknown-unknown/debug/deps/lib.wasm: project/src/lib.rs",
		);

		const watched = await findProjectWatchFiles({
			...workspace,
			libraryTargetName: "lib",
		});

		expect(watched).toContain(workspace.projectFilePath);
		expect(watched).not.toContain(
			path.resolve(workspace.workspaceRoot, "Cargo.lock"),
		);
		expect(watched).not.toContain(
			path.resolve(workspace.projectRoot, "build.rs"),
		);
	});
});
