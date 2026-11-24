import { buildWithBun } from "../helpers/bundler";
import { runBundlerTests, runWatchTests } from "../helpers/runner";
import { watchWithBun } from "../helpers/watcher";

runBundlerTests("Bun", buildWithBun);
runWatchTests("Bun", watchWithBun, {
	skip: "Bun.build does not expose a native watch API",
});
