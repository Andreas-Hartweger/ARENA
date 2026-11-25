// Native Node 24 type stripping. Match the project's extensionless local TS imports.
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import { stdout } from 'node:process';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const localModule = specifier.startsWith('.') && !extname(specifier);
    return nextResolve(localModule ? specifier + '.ts' : specifier, context);
  },
});
const { measureVehicle } = await import('./calibration.ts');
stdout.write(JSON.stringify(measureVehicle(), null, 2) + '\n');
