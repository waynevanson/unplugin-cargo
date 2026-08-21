import { buildWithBun } from "../helpers/bundler";
import { runBundlerTests } from "../helpers/runner";

runBundlerTests("Bun", buildWithBun);
