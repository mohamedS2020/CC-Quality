// Test-only stub. Some server modules `import "server-only"`, whose real
// implementation throws outside a React Server Component. Jest maps
// "server-only" here (see jest.config.mjs) so those modules can be unit-tested.
module.exports = {};
