export class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private delayMs: number;

  constructor(delayMs: number) {
    this.delayMs = delayMs;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      const fn = this.queue.shift();
      if (fn) {
        await fn();
        if (this.queue.length > 0) {
          await this.delay(this.delayMs);
        }
      }
    }

    this.processing = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export async function processBatch<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = processor(item).then(() => {
      const index = executing.indexOf(promise);
      if (index > -1) executing.splice(index, 1);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}