import * as vite from 'vite';
import { U as UnpluginCargoOptions } from './options-CGIQl49C.js';
import 'pino';

declare const cargo: (options: UnpluginCargoOptions) => vite.Plugin<any> | vite.Plugin<any>[];

export { cargo, cargo as default };
