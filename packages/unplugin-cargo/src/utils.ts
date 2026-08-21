import * as path from "node:path";

export function isString(value: unknown): value is string {
	return typeof value === "string";
}

export function findOnlyOne<T, U extends T>(
	array: Array<T>,
	predicate: ((item: T) => item is U) | ((value: T) => boolean),
): U | undefined {
	let found: U | undefined;

	for (const item of array) {
		if (!predicate(item)) {
			continue;
		}

		if (found !== undefined) {
			break;
		}

		found = item as U;
	}

	return found;
}

export const CACHE_DIR = "node_modules/.cache/unplugin-cargo";

export function createLibraryDir(hash: string) {
	if (hash.length <= 2) {
		throw Error(
			`Expected hash to be a string greater than two but received "${hash}"`,
		);
	}

	return path.resolve(CACHE_DIR, hash.slice(0, 2), hash.slice(2));
}
