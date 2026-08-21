import { buildWithRspack } from "../helpers/bundler";
import { runBundlerTests } from "../helpers/runner";

runBundlerTests("Rspack", buildWithRspack);
