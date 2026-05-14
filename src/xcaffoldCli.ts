import { spawn, execFile } from 'child_process';
import { getOutputChannel } from './outputChannel';

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Resolve the full path to the xcaffold binary asynchronously.
 * VS Code's PATH doesn't include shell-managed dirs (go/bin, homebrew, etc.),
 * so we ask the login shell for the resolved path.
 */
async function resolveXcaffoldPathAsync(
  binaryPath: string
): Promise<string> {
  if (binaryPath !== 'xcaffold') {
    return binaryPath; // user explicitly configured a full path
  }
  const shell = process.env.SHELL || '/bin/zsh';
  return new Promise<string>((resolve) => {
    execFile(
      shell,
      ['-l', '-c', 'which xcaffold'],
      { timeout: 3000 },
      (err, stdout) => {
        const resolved = stdout?.toString().trim();
        if (err || !resolved) {
          resolve(binaryPath); // fall back to bare name
        } else {
          resolve(resolved);
        }
      }
    );
  });
}

export class XcaffoldCli {
  private resolvedPath: string;
  private initPromise: Promise<void> | undefined;

  constructor(private readonly binaryPath: string = 'xcaffold') {
    this.resolvedPath = binaryPath; // start with uncached value
  }

  /**
   * init resolves the binary path asynchronously. Must be called
   * once during activation. Subsequent calls are no-ops.
   */
  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = resolveXcaffoldPathAsync(this.binaryPath).then(
        (resolved) => {
          this.resolvedPath = resolved;
        }
      );
    }
    return this.initPromise;
  }

  /**
   * invalidateCache forces re-resolution on next init() call.
   * Call this when the user changes the binaryPath config.
   */
  invalidateCache(): void {
    this.initPromise = undefined;
    this.resolvedPath = this.binaryPath;
  }

  /**
   * run executes the xcaffold binary with the given arguments.
   * Logs output to the xcaffold output channel.
   *
   * @param onStdoutData — optional callback invoked with each stdout
   *   chunk as it arrives. Useful for streaming progress updates.
   */
  run(
    args: string[],
    cwd: string,
    onStdoutData?: (data: string) => void,
  ): Promise<CliResult> {
    return new Promise((resolve, reject) => {
      const ch = getOutputChannel();
      ch.appendLine(`> ${this.resolvedPath} ${args.join(' ')}`);

      const proc = spawn(this.resolvedPath, args, { cwd, shell: false });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d: Buffer) => {
        const s = d.toString();
        stdout += s;
        ch.append(s);
        onStdoutData?.(s);
      });
      proc.stderr.on('data', (d: Buffer) => {
        const s = d.toString();
        stderr += s;
        ch.append(s);
      });

      proc.on('close', (code) => {
        const exitCode = code ?? 1;
        if (exitCode === 0) {
          resolve({ exitCode, stdout, stderr });
        } else {
          const err: any = new Error(`xcaffold exited ${exitCode}: ${stderr.trim()}`);
          err.exitCode = exitCode;
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
        }
      });

      proc.on('error', (err) => {
        if ((err as any).code === 'ENOENT') {
          reject(
            new Error(
              `xcaffold binary not found at '${this.resolvedPath}'. ` +
              'Please ensure it is installed and on your PATH.'
            )
          );
        } else {
          reject(err);
        }
      });
    });
  }
}
