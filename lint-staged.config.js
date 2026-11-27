export default {
	// lint-staged appends staged filenames to string commands, so use a
	// function to run the repo-wide checks without file arguments.
	// All checks go through Turbo. `test:unit` depends on `build`, so this runs
	// Biome, typechecking, the build, and only the fast src unit tests.
	"*": () => "turbo test:unit",
};
