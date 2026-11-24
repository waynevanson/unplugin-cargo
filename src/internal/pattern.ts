import picomatch from "picomatch";

export type Pattern =
	| string
	| RegExp
	| Array<string | RegExp>
	| {
			include?: string | RegExp | Array<string | RegExp>;
			exclude?: string | RegExp | Array<string | RegExp>;
	  };

function normalizePatterns(
	patterns: string | RegExp | Array<string | RegExp> | undefined,
): Array<string | RegExp> {
	if (patterns === undefined) return [];
	return Array.isArray(patterns) ? patterns : [patterns];
}

function matchesSinglePattern(id: string, pattern: string | RegExp): boolean {
	if (typeof pattern === "string") {
		return picomatch.isMatch(id, pattern, { dot: true });
	}
	return pattern.test(id);
}

export function matchesPattern(id: string, pattern: Pattern): boolean {
	if (typeof pattern === "string" || pattern instanceof RegExp) {
		return matchesSinglePattern(id, pattern);
	}

	if (Array.isArray(pattern)) {
		return pattern.some((p) => matchesSinglePattern(id, p));
	}

	const include = normalizePatterns(pattern.include);
	const exclude = normalizePatterns(pattern.exclude);

	const included =
		include.length === 0 || include.some((p) => matchesSinglePattern(id, p));
	const excluded = exclude.some((p) => matchesSinglePattern(id, p));

	return included && !excluded;
}
