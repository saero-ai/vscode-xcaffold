import { XcaffoldCli, CliResult } from './xcaffoldCli';
import { getOutputChannel } from './outputChannel';

const WRITE_COMMANDS = new Set(['apply', 'init', 'import']);

export class CliOp {
  static classify(command: string): 'read' | 'write' {
    return WRITE_COMMANDS.has(command) ? 'write' : 'read';
  }
}

/**
 * CliQueue wraps XcaffoldCli.run() with concurrency control.
 *
 * Write operations (apply, init, import) are serialized via an async mutex
 * so only one runs at a time. Read operations (validate, status, list,
 * help, graph) run concurrently with no locking.
 *
 * Output channel lines are prefixed with the command name to prevent
 * interleaving confusion on concurrent reads.
 */
export class CliQueue {
  private writeLock: Promise<void> = Promise.resolve();
  private writeQueueDepth = 0;
  private onBusy: ((command: string) => void) | undefined;

  constructor(private readonly cli: XcaffoldCli) {}

  /**
   * setBusyHandler registers a callback invoked when a write op
   * is queued behind another write. Used to show "xcaffold is busy".
   */
  setBusyHandler(handler: (command: string) => void): void {
    this.onBusy = handler;
  }

  /**
   * enqueue schedules a CLI operation. Writes are serialized;
   * reads run immediately.
   */
  enqueue(
    command: string,
    args: string[],
    cwd: string
  ): Promise<CliResult> {
    const kind = CliOp.classify(command);

    if (kind === 'write') {
      return this.enqueueWrite(command, args, cwd);
    }
    return this.runPrefixed(command, args, cwd);
  }

  private enqueueWrite(
    command: string,
    args: string[],
    cwd: string
  ): Promise<CliResult> {
    // Chain onto the write lock
    const prevLock = this.writeLock;
    let releaseLock: () => void;

    this.writeLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    // Check if a write is already running
    const isQueued = this.writeQueueDepth > 0;

    if (isQueued && this.onBusy) {
      this.onBusy(command);
    }

    // Increment queue depth
    this.writeQueueDepth++;

    if (!isQueued) {
      // Lock is immediately available, start CLI call synchronously
      const cliCall = this.runPrefixed(command, args, cwd);
      return cliCall.finally(() => {
        this.writeQueueDepth--;
        releaseLock!();
      });
    } else {
      // Lock is held, wait for it to be available
      return prevLock
        .then(() => this.runPrefixed(command, args, cwd))
        .finally(() => {
          this.writeQueueDepth--;
          releaseLock!();
        });
    }
  }

  private runPrefixed(
    command: string,
    args: string[],
    cwd: string
  ): Promise<CliResult> {
    const ch = getOutputChannel();
    ch.appendLine(`[${command}] starting`);

    return this.cli.run(args, cwd)
      .then((result) => {
        ch.appendLine(`[${command}] completed (exit 0)`);
        return result;
      })
      .catch((err) => {
        ch.appendLine(`[${command}] failed`);
        throw err;
      });
  }
}
