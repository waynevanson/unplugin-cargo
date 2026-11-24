import { describe, expect, it } from "vitest";
import { HashSet } from "./hash-set";

describe("HashSet", () => {
	it("iterates over initial values", () => {
		const set = new HashSet(["a", "b"]);
		expect(Array.from(set)).toEqual(["a", "b"]);
		expect(Array.from(new HashSet<string>())).toEqual([]);
	});

	it("finds the hash for a matching value", () => {
		const set = new HashSet(["a", "b"]);
		const hash = set.add("c");

		expect(set.findHashFromValue((value) => value === "c")).toBe(hash);
		expect(
			set.findHashFromValue((value) => value === "missing"),
		).toBeUndefined();
	});

	it("adds, checks and deletes values", () => {
		const set = new HashSet<string>();

		expect(set.has("a")).toBe(false);
		expect(set.add("a")).toBeTypeOf("string");
		expect(set.has("a")).toBe(true);
		expect(set.delete("a")).toBe(true);
		expect(set.delete("a")).toBe(false);
	});

	it("exposes values, entries and hashes", () => {
		const set = new HashSet(["a", "b"]);

		expect(Array.from(set.values())).toEqual(["a", "b"]);
		expect(Array.from(set.entries()).map(([, value]) => value)).toEqual([
			"a",
			"b",
		]);
		expect(Array.from(set.hashes())).toHaveLength(2);
	});
});
