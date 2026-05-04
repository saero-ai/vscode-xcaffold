import * as assert from 'assert';
import { XcaffoldCli } from '../xcaffoldCli';

suite('XcaffoldCli', () => {
  test('run() resolves with stdout on exit 0', async () => {
    // We use 'echo' as a reliable test binary available on most systems
    const cli = new XcaffoldCli('echo');
    const result = await cli.run(['hello world'], process.cwd());
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('hello world'));
  });

  test('run() rejects with stderr on non-zero exit', async () => {
    const cli = new XcaffoldCli('sh');
    try {
      // 'exit 1' should trigger the rejection
      await cli.run(['-c', 'exit 1'], process.cwd());
      assert.fail('should have thrown');
    } catch (err: any) {
      assert.ok(err.exitCode !== 0);
      assert.ok(err.message.includes('exited 1'));
    }
  });

  test('run() rejects with ENOENT if binary not found', async () => {
    const cli = new XcaffoldCli('nonexistent-binary-12345');
    try {
      await cli.run(['--version'], process.cwd());
      assert.fail('should have thrown');
    } catch (err: any) {
      assert.ok(err.message.includes('not found'));
    }
  });
});

suite('XcaffoldCli async initialization', () => {
  test('init() resolves the binary path asynchronously', async () => {
    const cli = new XcaffoldCli('echo');
    await cli.init();
    // After init, run should still work
    const result = await cli.run(['hello'], process.cwd());
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('hello'));
  });

  test('init() caches the resolved path', async () => {
    const cli = new XcaffoldCli('echo');
    await cli.init();
    await cli.init(); // second call should be a no-op
    const result = await cli.run(['cached'], process.cwd());
    assert.ok(result.stdout.includes('cached'));
  });

  test('run() before init() uses the uncached binaryPath', async () => {
    // When init() has not been called, run() falls back to the raw binaryPath
    const cli = new XcaffoldCli('echo');
    const result = await cli.run(['fallback'], process.cwd());
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.stdout.includes('fallback'));
  });
});
