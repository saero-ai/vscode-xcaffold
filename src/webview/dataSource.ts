// src/webview/dataSource.ts
//
// DataSource is the abstraction layer between webview providers and
// the underlying data fetcher (CLI today, platform API in the future).
// Each webview provider depends on this interface, never on XcaffoldCli directly.

import { CliResult } from '../xcaffoldCli';

/**
 * DataSource abstracts CLI execution for webview providers.
 * In the current implementation, it wraps XcaffoldCli.run().
 * A future platform API implementation would replace this with HTTP calls.
 */
export interface DataSource {
  /**
   * fetch runs a CLI command (or equivalent API call) and returns the result.
   * @param args CLI arguments (e.g., ['status', '--format', 'json'])
   * @param cwd Working directory for CLI execution
   */
  fetch(args: string[], cwd: string): Promise<CliResult>;
}

/**
 * CliDataSource implements DataSource by delegating to XcaffoldCli.run().
 */
export class CliDataSource implements DataSource {
  constructor(
    private readonly run: (args: string[], cwd: string) => Promise<CliResult>,
  ) {}

  async fetch(args: string[], cwd: string): Promise<CliResult> {
    return this.run(args, cwd);
  }
}
