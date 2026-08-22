import { buildWithVite } from "../helpers/bundler";
import { runBundlerTests, runWatchTests } from "../helpers/runner";
import { watchWithVite } from "../helpers/watcher";

runBundlerTests("Vite", buildWithVite);
runWatchTests("Vite", watchWithVite);
