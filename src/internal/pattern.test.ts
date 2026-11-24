import { describe, expect, test } from "vitest";
import { matchesPattern, type Pattern } from "./pattern";

describe("matchesPattern", () => {
	test("returns false for non-matching relative ids", () => {
		const contexts: Array<{ pattern: Pattern; id: string }> = [
			{ pattern: "src/lib.rs", id: "src/other.rs" },
			{ pattern: /src\/lib\.rs$/, id: "src/other.rs" },
			{ pattern: ["src/lib.rs", "main.rs"], id: "src/other.rs" },
			{
				pattern: { include: "**/*.rs", exclude: "**/node_modules/**" },
				id: "node_modules/foo.rs",
			},
			{
				pattern: { include: ["src/lib.rs", "main.rs"] },
				id: "src/other.rs",
			},
		];

		for (const { pattern, id } of contexts) {
			expect(matchesPattern(id, pattern)).toBe(false);
		}
	});
});
