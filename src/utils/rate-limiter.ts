export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly maxTokens: number,
    private readonly refillRate: number, // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(count = 1): Promise<void> {
    this.refill();
    if (this.tokens >= count) {
      this.tokens -= count;
      return;
    }
    const waitTime = ((count - this.tokens) / this.refillRate) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    this.refill();
    this.tokens -= count;
  }

  get available(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}

// Pre-configured limiters
export const githubLimiter = new TokenBucketRateLimiter(30, 30 / 60); // 30 req/min
export const npmLimiter = new TokenBucketRateLimiter(100, 100 / 60); // ~100 req/min
