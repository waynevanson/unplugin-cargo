import { runBundlerTests } from "../helpers/runner";
import { buildWithBun } from "../helpers/bundlers";

runBundlerTests("Bun", buildWithBun);
