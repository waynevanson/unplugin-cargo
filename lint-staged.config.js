export default {
	// lint-staged appends staged filenames to string commands, so use a
	// function to run the repo-wide checks without file arguments.
	// Biome runs through Turbo as a dependency of the build task.
	"*": () => "turbo build test",
};
