// src/adapters/node.ts
function startAppwireAgent(options) {
  const g = global;
  if (!g.__appwire) return;
  for (const [key, value] of Object.entries(options.context)) {
    g.__appwireSetContext(key, value);
  }
  g.__appwireSetServicesProvider(() => Object.keys(options.context));
}
export {
  startAppwireAgent
};
//# sourceMappingURL=index.mjs.map