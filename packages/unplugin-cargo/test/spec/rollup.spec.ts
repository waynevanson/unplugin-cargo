import { buildWithRollup } from "../helpers/bundler";
import { runBundlerTests } from "../helpers/runner";

runBundlerTests("Rollup", buildWithRollup);
