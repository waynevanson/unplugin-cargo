import { runBundlerTests } from "../helpers/runner";
import { buildWithRollup } from "../helpers/bundlers";

runBundlerTests("Rollup", buildWithRollup);
