function createSeedState() {
  return {
    version: 1,
    dataset: {
      name: 'Urban Air Quality Assistant demo',
      description: 'Deterministic offline air-quality profiles for winter-smog planning.',
      plans: 0,
      source: 'Synthetic local-mock profiles; replace with provider-backed retrieval for live evaluation.',
    },
    plans: [],
    auditLog: [
      {
        id: 'AUD-001',
        at: new Date().toISOString(),
        actor: 'Urban Air Quality Assistant',
        event: 'Demo workspace initialized',
        detail: 'Household air-safety plans are generated on demand from the local-mock location profiles.',
      },
    ],
  };
}

module.exports = {
  createSeedState,
};
