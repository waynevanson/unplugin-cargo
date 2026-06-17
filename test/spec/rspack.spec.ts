import { runBundlerTests } from "../helpers/runner";
import { buildWithRspack } from "../helpers/bundlers";

runBundlerTests("Rspack", buildWithRspack);
