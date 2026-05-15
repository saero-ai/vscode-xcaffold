import * as assert from 'assert';
import { CliQueue, CliOp } from '../cliQueue';
import { XcaffoldCli, CliResult } from '../xcaffoldCli';

/**
 * FakeCli records call order and allows controlling resolution timing.
 */
class FakeCli {
  calls: string[] = [];
  private pending: Array<{
    args: string[];
    resolve: (r: CliResult) => void;
  }> = [];

  async run(args: string[], _cwd: string): Promise<CliResult> {
    const label = args[0];
    this.calls.push(label);
    return new Promise<CliResult>((resolve) => {
      this.pending.push({ args, resolve });
    });
  }

  /** Resolve the oldest pending call. */
  resolveNext(): void {
    const p = this.pending.shift();
    if (p) {
      p.resolve({ exitCode: 0, stdout: '', stderr: '' });
    }
  }

  /** Resolve all pending calls. */
  resolveAll(): void {
    while (this.pending.length) {
      this.resolveNext();
    }
  }

  get pendingCount(): number {
    return this.pending.length;
  }
}

suite('CliQueue', () => {
  test('read operations run concurrently', async () => {
    const fake = new FakeCli();
    const queue = new CliQueue(fake as any);

    // Start two reads without awaiting
    const p1 = queue.enqueue('validate', ['validate'], '/tmp');
    const p2 = queue.enqueue('status', ['status'], '/tmp');

    // Both should be pending simultaneously
    assert.strictEqual(fake.pendingCount, 2);
    assert.deepStrictEqual(fake.calls, ['validate', 'status']);

    fake.resolveAll();
    await Promise.all([p1, p2]);
  });

  test('write operations are serialized', async () => {
    const fake = new FakeCli();
    const queue = new CliQueue(fake as any);

    // Start two writes
    const p1 = queue.enqueue('apply', ['apply'], '/tmp');
    const p2 = queue.enqueue('init', ['init'], '/tmp');

    // Only the first write should have started
    assert.strictEqual(fake.pendingCount, 1);
    assert.deepStrictEqual(fake.calls, ['apply']);

    // Resolve first write — second should start
    fake.resolveNext();
    await p1;

    // Allow microtask queue to flush
    await new Promise((r) => setTimeout(r, 10));

    assert.strictEqual(fake.pendingCount, 1);
    assert.deepStrictEqual(fake.calls, ['apply', 'init']);

    fake.resolveNext();
    await p2;
  });

  test('reads run while a write is not active', async () => {
    const fake = new FakeCli();
    const queue = new CliQueue(fake as any);

    const p1 = queue.enqueue('validate', ['validate'], '/tmp');
    const p2 = queue.enqueue('list', ['list'], '/tmp');

    assert.strictEqual(fake.pendingCount, 2);

    fake.resolveAll();
    await Promise.all([p1, p2]);
  });

  test('classifies operations correctly', () => {
    assert.strictEqual(CliOp.classify('apply'), 'write');
    assert.strictEqual(CliOp.classify('init'), 'write');
    assert.strictEqual(CliOp.classify('import'), 'write');
    assert.strictEqual(CliOp.classify('validate'), 'read');
    assert.strictEqual(CliOp.classify('status'), 'read');
    assert.strictEqual(CliOp.classify('list'), 'read');
    assert.strictEqual(CliOp.classify('help'), 'read');
    assert.strictEqual(CliOp.classify('graph'), 'read');
    assert.strictEqual(CliOp.classify('unknown'), 'read');
  });

  test('write error does not block subsequent writes', async () => {
    const fake = new FakeCli();
    const queue = new CliQueue(fake as any);

    // Override run to reject for the first call
    let callCount = 0;
    const origRun = fake.run.bind(fake);
    (fake as any).run = async (args: string[], cwd: string) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('apply failed');
      }
      return origRun(args, cwd);
    };

    const p1 = queue.enqueue('apply', ['apply'], '/tmp');
    const p2 = queue.enqueue('init', ['init'], '/tmp');

    // First write should reject
    try {
      await p1;
      assert.fail('should have thrown');
    } catch (err: any) {
      assert.ok(err.message.includes('apply failed'));
    }

    // Allow microtask to flush
    await new Promise((r) => setTimeout(r, 10));

    // Second write should now be running
    fake.resolveAll();
    await p2;
  });
});
