import { buildWithWebpack } from "../helpers/bundler";
import { runBundlerTests, runWatchTests } from "../helpers/runner";
import { watchWithWebpack } from "../helpers/watcher";

runBundlerTests("webpack", buildWithWebpack);
runWatchTests("webpack", watchWithWebpack, {
	skip: "plugin does not register .rs dependencies for webpack watch mode",
});
