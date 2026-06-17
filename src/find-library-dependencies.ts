import { readFile } from "node:fs/promises";
import path from "node:path";

// todo: instead of watching just dependencies,
// we need to watch all files and trigger rebuild when the dependencies change.
export async function findLibraryDependencies(options: {
	libraryDepsDir: string;
	libraryTargetName: string;
}) {
	const libraryDepsFilePath = path.resolve(
		options.libraryDepsDir,
		`${options.libraryTargetName}.d`,
	);

	const dependencies = await readFile(libraryDepsFilePath, {
		encoding: "utf8",
	});

	const graph = createGraphFromDependencies(dependencies);

	const neighboursEntry = path.resolve(
		options.libraryDepsDir,
		`${options.libraryTargetName}.wasm`,
	);

	const neighbours = findAllDescendants(neighboursEntry, graph);

	return neighbours;
}

export function createGraphFromDependencies(contents: string) {
	return new Map(
		contents
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const [source, targets] = line.split(": ");
				return [
					path.resolve(source),
					new Set(targets?.split(" ").map((a) => path.resolve(a)) ?? []),
				] as const;
			}),
	);
}

function findAllDescendants(start: string, graph: Map<string, Set<string>>) {
	const collecteds = new Set<string>();
	const initials = graph.get(start);

	if (initials === undefined) {
		throw new Error(`Expect the start value to exist in the dependency graph`);
	}

	const sources = new Set<string>(initials);

	while (sources.size > 0) {
		for (const source of sources) {
			// move from sources into collected
			collecteds.add(source);
			sources.delete(source);

			const targets = graph.get(source) ?? new Set();

			// filter out targets that may have been traversed
			const uncollecteds = targets.difference(collecteds);

			// queue files to be collected
			for (const uncollected of uncollecteds) {
				sources.add(uncollected);
			}
		}
	}

	return collecteds;
}
