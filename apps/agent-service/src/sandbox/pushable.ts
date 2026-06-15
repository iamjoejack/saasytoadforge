/** Async stream that lets a producer push chunks to an `for await` consumer. */
export class Pushable<T> implements AsyncIterable<T> {
  private readonly queue: T[] = []
  private readonly waiters: Array<(r: IteratorResult<T>) => void> = []
  private done = false

  push(item: T): void {
    const waiter = this.waiters.shift()
    if (waiter) {
      waiter({ value: item, done: false })
    } else {
      this.queue.push(item)
    }
  }

  end(): void {
    this.done = true
    let waiter = this.waiters.shift()
    while (waiter) {
      waiter({ value: undefined, done: true } as IteratorResult<T>)
      waiter = this.waiters.shift()
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: (): Promise<IteratorResult<T>> => {
        const queued = this.queue.shift()
        if (queued !== undefined) return Promise.resolve({ value: queued, done: false })
        if (this.done) return Promise.resolve({ value: undefined, done: true } as IteratorResult<T>)
        return new Promise((resolve) => this.waiters.push(resolve))
      },
    }
  }
}
