import { spawn } from 'child_process';
import { getOutputChannel } from './outputChannel';

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class XcaffoldCli {
  constructor(private readonly binaryPath: string = 'xcaffold') {}

  /**
   * run executes the xcaffold binary with the given arguments.
   * Logs output to the xcaffold output channel.
   */
  run(args: string[], cwd: string): Promise<CliResult> {
    return new Promise((resolve, reject) => {
      const ch = getOutputChannel();
      ch.appendLine(`> ${this.binaryPath} ${args.join(' ')}`);

      const proc = spawn(this.binaryPath, args, { cwd, shell: false });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d: Buffer) => {
        const s = d.toString();
        stdout += s;
        ch.append(s);
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
          reject(new Error(`xcaffold binary not found at '${this.binaryPath}'. Please ensure it is installed and on your PATH.`));
        } else {
          reject(err);
        }
      });
    });
  }
}
