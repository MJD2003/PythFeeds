/**
 * Simple circuit breaker for external API calls.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing)
 */
class CircuitBreaker {
  constructor(name, { failureThreshold = 5, resetTimeoutMs = 30000 } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.failures = 0;
    this.state = "CLOSED"; // CLOSED | OPEN | HALF_OPEN
    this.nextRetry = 0;
  }

  async call(fn) {
    if (this.state === "OPEN") {
      if (Date.now() < this.nextRetry) {
        throw new Error(`[CircuitBreaker:${this.name}] OPEN — retry after ${Math.ceil((this.nextRetry - Date.now()) / 1000)}s`);
      }
      this.state = "HALF_OPEN";
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      if (this.state !== "OPEN") this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  onFailure() {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
      this.nextRetry = Date.now() + this.resetTimeoutMs;
      console.warn(`[CircuitBreaker:${this.name}] OPENED after ${this.failures} failures — retry in ${this.resetTimeoutMs / 1000}s`);
    }
  }

  getStatus() {
    return { name: this.name, state: this.state, failures: this.failures };
  }
}

// Shared breakers for each external API
const breakers = {
  jupiter: new CircuitBreaker("jupiter", { failureThreshold: 5, resetTimeoutMs: 30000 }),
  raydium: new CircuitBreaker("raydium", { failureThreshold: 5, resetTimeoutMs: 30000 }),
  pumpfun: new CircuitBreaker("pumpfun", { failureThreshold: 4, resetTimeoutMs: 20000 }),
  dexscreener: new CircuitBreaker("dexscreener", { failureThreshold: 5, resetTimeoutMs: 30000 }),
  coingecko: new CircuitBreaker("coingecko", { failureThreshold: 3, resetTimeoutMs: 60000 }),
};

function getBreaker(name) {
  if (!breakers[name]) {
    breakers[name] = new CircuitBreaker(name);
  }
  return breakers[name];
}

function getAllStatuses() {
  return Object.values(breakers).map((b) => b.getStatus());
}

module.exports = { CircuitBreaker, getBreaker, getAllStatuses };
