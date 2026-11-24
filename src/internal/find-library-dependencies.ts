import { access, readFile } from "node:fs/promises";
import path from "node:path";

// todo: instead of watching just dependencies,
// we need to watch all files and trigger rebuild when the dependencies change.
export async function findLibraryDependencies(options: {
	workspaceRoot: string;
	libraryBuildDir: string;
	libraryDepsDir: string;
	libraryTargetName: string;
}) {
	const libraryDepsFilePath = await findFirstExisting([
		path.resolve(options.libraryDepsDir, `${options.libraryTargetName}.d`),
		path.resolve(options.libraryBuildDir, `${options.libraryTargetName}.d`),
	]);

	const dependencies = await readFile(libraryDepsFilePath, {
		encoding: "utf8",
	});

	const graph = createGraphFromDependencies(
		dependencies,
		options.workspaceRoot,
	);

	const neighboursEntry = [
		path.resolve(options.libraryDepsDir, `${options.libraryTargetName}.wasm`),
		path.resolve(options.libraryBuildDir, `${options.libraryTargetName}.wasm`),
	].find((candidate) => graph.has(candidate));

	if (neighboursEntry === undefined) {
		throw new Error(`Expect the wasm output to exist in the dependency graph`);
	}

	const neighbours = findAllDescendants(neighboursEntry, graph);

	return neighbours;
}

async function findFirstExisting(candidates: Array<string>): Promise<string> {
	for (const candidate of candidates) {
		try {
			await access(candidate);
			return candidate;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}

	throw new Error(
		`Expected one of the following files to exist: ${candidates.join(", ")}`,
	);
}

function splitTargets(targets: string): Array<string> {
	return targets
		.split(/(?<!\\)\s+/)
		.map((target) => target.replace(/\\ /g, " "));
}

export function createGraphFromDependencies(contents: string, baseDir: string) {
	return new Map(
		contents
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const separator = line.indexOf(": ");
				if (separator === -1) {
					return null;
				}

				const source = line.slice(0, separator);
				const targets = line.slice(separator + 2);

				return [
					path.resolve(baseDir, source),
					new Set(
						splitTargets(targets).map((target) =>
							path.resolve(baseDir, target),
						),
					),
				] as const;
			})
			.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
	);
}

function findAllDescendants(start: string, graph: Map<string, Set<string>>) {
	const collecteds = new Set<string>();
	const initials = graph.get(start);

	if (initials === undefined) {
		throw new Error(`Expect the start value to exist in the dependency graph`);
	}

	const queue = Array.from(initials);

	while (queue.length > 0) {
		const source = queue.shift();
		if (source === undefined || collecteds.has(source)) {
			continue;
		}

		collecteds.add(source);

		const targets = graph.get(source) ?? new Set();
		for (const target of targets) {
			if (!collecteds.has(target)) {
				queue.push(target);
			}
		}
	}

	return collecteds;
}
