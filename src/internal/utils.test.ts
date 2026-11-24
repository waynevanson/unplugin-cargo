import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLibraryDir, findOnlyOne, isString } from "./utils";

describe("findOnlyOne", () => {
	it("returns undefined when nothing matches", () => {
		expect(findOnlyOne([1, 3, 5], (value) => value % 2 === 0)).toBeUndefined();
	});

	it("returns the first match and stops after a duplicate", () => {
		expect(findOnlyOne([1, 2, 4, 6], (value) => value % 2 === 0)).toBe(2);
	});
});

describe("createLibraryDir", () => {
	it("rejects hashes that are too short", () => {
		expect(() => createLibraryDir("ab")).toThrow(
			'Expected hash to be a string greater than two but received "ab"',
		);
	});

	it("splits the hash into a directory", () => {
		expect(createLibraryDir("abcdef")).toBe(
			path.resolve("node_modules/.cache/unplugin-cargo/ab/cdef"),
		);
	});
});

describe("isString", () => {
	it("only accepts strings", () => {
		expect(isString("value")).toBe(true);
		expect(isString(1)).toBe(false);
	});
});
