import { buildWithEsbuild } from "../helpers/bundler";
import { runBundlerTests, runWatchTests } from "../helpers/runner";
import { watchWithEsbuild } from "../helpers/watcher";

runBundlerTests("esbuild", buildWithEsbuild);
runWatchTests("esbuild", watchWithEsbuild);
