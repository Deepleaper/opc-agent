// Runtime dynamic import that bypasses TypeScript's CJS downlevel
// TypeScript compiles 'await import(x)' to 'require(x)' when module=commonjs
// This wrapper preserves the real ESM dynamic import at runtime
const _import = new Function('specifier', 'return import(specifier)');
module.exports.dynamicImport = function(specifier) { return _import(specifier); };
