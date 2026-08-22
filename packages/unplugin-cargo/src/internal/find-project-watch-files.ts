import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { findLibraryDependencies } from "./find-library-dependencies";

interface Options {
	projectRoot: string;
	projectFilePath: string;
	libraryDepsDir: string;
	libraryTargetName: string;
}

export async function findProjectWatchFiles(
	options: Options,
): Promise<Set<string>> {
	const watched = new Set<string>();

	// Manifest files
	watched.add(options.projectFilePath);
	watched.add(path.resolve(options.projectRoot, "Cargo.lock"));

	// Build script (default location and any .rs at project root that looks like a build script)
	const buildRs = path.resolve(options.projectRoot, "build.rs");
	if (await fileExists(buildRs)) {
		watched.add(buildRs);
	}

	// All Rust source files in the project (catches modules, build scripts, tests, etc.)
	for await (const file of findRustSourceFiles(options.projectRoot)) {
		watched.add(file);
	}

	// Dependency graph emitted by rustc for the library target
	const libraryDeps = await findLibraryDependencies({
		projectRoot: options.projectRoot,
		libraryDepsDir: options.libraryDepsDir,
		libraryTargetName: options.libraryTargetName,
	});

	for (const dep of libraryDeps) {
		watched.add(dep);
	}

	return watched;
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		return (await stat(filePath)).isFile();
	} catch {
		return false;
	}
}

async function* findRustSourceFiles(root: string): AsyncGenerator<string> {
	const entries = await readdir(root, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.resolve(root, entry.name);

		if (entry.isDirectory()) {
			if (entry.name === "target") continue;
			yield* findRustSourceFiles(entryPath);
			continue;
		}

		if (entry.isFile() && entry.name.endsWith(".rs")) {
			yield entryPath;
		}
	}
}
