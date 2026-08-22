import { buildWithFarm } from "../helpers/bundler/farm";
import { runBundlerTests, runWatchTests } from "../helpers/runner";
import { watchWithFarm } from "../helpers/watcher";

runBundlerTests("Farm", buildWithFarm);
runWatchTests("Farm", watchWithFarm, {
	skip: "Farm watch helpers are not yet implemented",
});
