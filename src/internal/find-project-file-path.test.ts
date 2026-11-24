import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pino from "pino";
import { afterEach, describe, expect, it } from "vitest";
import { findProjectFilePath } from "./find-project-file-path";

const log = pino({ level: "silent" });
const temporaryDirectories = new Set<string>();

async function createTemporaryDirectory() {
	const directory = await mkdtemp(
		path.join(os.tmpdir(), "unplugin-cargo-project-file-"),
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

describe("findProjectFilePath", () => {
	it("finds the closest Cargo.toml", async () => {
		const root = await createTemporaryDirectory();
		const project = path.resolve(root, "project");
		const nested = path.resolve(project, "src/nested");
		await mkdir(nested, { recursive: true });
		await writeFile(path.resolve(root, "Cargo.toml"), "");
		await writeFile(path.resolve(project, "Cargo.toml"), "");

		expect(findProjectFilePath(path.resolve(nested, "lib.rs"), log)).toBe(
			path.resolve(project, "Cargo.toml"),
		);
	});

	it("returns undefined when no Cargo.toml exists", async () => {
		const root = await createTemporaryDirectory();
		const source = path.resolve(root, "src/lib.rs");
		await mkdir(path.dirname(source), { recursive: true });

		expect(findProjectFilePath(source, log)).toBeUndefined();
	});

	it("returns undefined for a relative path without a parent", () => {
		expect(findProjectFilePath("relative/lib.rs", log)).toBeUndefined();
	});
});
