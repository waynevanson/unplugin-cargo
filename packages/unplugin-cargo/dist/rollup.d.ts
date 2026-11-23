import * as rollup from 'rollup';
import { U as UnpluginCargoOptions } from './options-CGIQl49C.js';
import 'pino';

declare const cargo: (options: UnpluginCargoOptions) => rollup.Plugin<any> | rollup.Plugin<any>[];

export { cargo, cargo as default };
