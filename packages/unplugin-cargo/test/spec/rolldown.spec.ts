import { buildWithRolldown } from "../helpers/bundler";
import { runBundlerTests, runWatchTests } from "../helpers/runner";
import { watchWithRolldown } from "../helpers/watcher";

runBundlerTests("Rolldown", buildWithRolldown);
runWatchTests("Rolldown", watchWithRolldown);
