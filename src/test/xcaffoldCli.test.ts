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
