import { buildWithRollup } from "../helpers/bundler";
import { runBundlerTests, runWatchTests } from "../helpers/runner";
import { watchWithRollup } from "../helpers/watcher";

runBundlerTests("Rollup", buildWithRollup);
runWatchTests("Rollup", watchWithRollup);
