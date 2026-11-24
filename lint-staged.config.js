export default {
	// lint-staged appends staged filenames to string commands, so use a
	// function to run repo-wide build and test once without file arguments.
	"*": () => "turbo build test",
};
