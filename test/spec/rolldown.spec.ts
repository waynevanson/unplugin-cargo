import { runBundlerTests } from "../helpers/runner";
import { buildWithRolldown } from "../helpers/bundlers";

runBundlerTests("Rolldown", buildWithRolldown);
