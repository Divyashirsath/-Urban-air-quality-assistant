class DemoStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = createSeedState();
    return this.state;
  }

  listPlans() {
    return this.state.plans;
  }

  getPlan(planId) {
    return this.state.plans.find((plan) => plan.id === planId) || null;
  }

  addPlan(plan) {
    this.state.plans.unshift(plan);
    return plan;
  }

  audit(entry) {
    this.state.auditLog = this.state.auditLog || [];
    this.state.auditLog.push({
      id: `AUD-${String(this.state.auditLog.length + 1).padStart(3, '0')}`,
      at: new Date().toISOString(),
      ...entry,
    });
    if (this.state.auditLog.length > 100) this.state.auditLog = this.state.auditLog.slice(-100);
  }

  snapshot() {
    return this.state;
  }
}

const { createSeedState } = require('./seed');

module.exports = { DemoStore };
