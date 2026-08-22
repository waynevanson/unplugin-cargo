import { buildWithFarm } from "../helpers/bundler/farm";
import { runBundlerTests } from "../helpers/runner";

runBundlerTests("Farm", buildWithFarm);
