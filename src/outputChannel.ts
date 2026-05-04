import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

/**
 * getOutputChannel returns the singleton output channel for xcaffold.
 * In a test environment where vscode is not available, it returns a mock.
 */
export function getOutputChannel(): vscode.OutputChannel {
  if (typeof vscode === 'undefined' || !vscode.window) {
    // Return a mock for testing environments
    return {
      name: 'xcaffold (mock)',
      append: () => {},
      appendLine: () => {},
      clear: () => {},
      show: () => {},
      hide: () => {},
      dispose: () => {},
      replace: () => {},
    } as any;
  }

  if (!channel) {
    channel = vscode.window.createOutputChannel('xcaffold');
  }
  return channel;
}

export function disposeOutputChannel(): void {
  channel?.dispose();
  channel = undefined;
}
