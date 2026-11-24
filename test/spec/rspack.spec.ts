import { buildWithRspack } from "../helpers/bundler";
import { runBundlerTests, runWatchTests } from "../helpers/runner";
import { watchWithRspack } from "../helpers/watcher";

runBundlerTests("Rspack", buildWithRspack);
runWatchTests("Rspack", watchWithRspack, {
	skip: "plugin does not register .rs dependencies for rspack watch mode",
});
