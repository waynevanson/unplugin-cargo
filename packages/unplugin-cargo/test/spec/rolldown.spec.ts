import { buildWithRolldown } from "../helpers/bundler";
import { runBundlerTests } from "../helpers/runner";

runBundlerTests("Rolldown", buildWithRolldown);
