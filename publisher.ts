/** Coalesce in-flight changes; unchanged metadata never touches disk. */
export function publisher(write: (value: string) => Promise<void>) {
  let latest: string | undefined;
  let pending: string | undefined;
  let task: Promise<void> | undefined;
  let closed = false;

  async function flush() {
    while (pending !== undefined) {
      const value = pending;
      pending = undefined;
      try { await write(value); }
      catch { latest = undefined; }
    }
  }

  function start() {
    task = flush().finally(() => {
      task = undefined;
      if (pending !== undefined) start();
    });
  }

  return {
    publish(value: string) {
      if (closed || value === latest) return;
      latest = value;
      pending = value;
      if (!task) start();
    },
    async close() {
      closed = true;
      while (task) await task;
    },
  };
}
