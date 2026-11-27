const { createSeedState } = require('../src/seed');

const state = createSeedState();
console.log(`Urban Air Quality Assistant demo state initialized: ${state.plans.length} plans in ${state.dataset.name}.`);
console.log('The running server keeps its state in memory; use the Reset demo state action or POST /api/reset while it is running.');
