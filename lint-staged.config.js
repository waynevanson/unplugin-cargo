export default {
	// lint-staged appends staged filenames to string commands, so use a
	// function to run the repo-wide build once without file arguments.
	"*": () => "turbo build",
};
