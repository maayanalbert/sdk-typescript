// TODO: this code is duplicated in the scripts directory, consider moving to external dependency
import { ChildProcess } from 'child_process';

export class ChildProcessError extends Error {
  public readonly name = 'ChildProcessError';

  constructor(message: string, public readonly code: number | null, public readonly signal: NodeJS.Signals | null) {
    super(message);
  }
}

export async function waitOnChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new ChildProcessError('Process failed', code, signal));
      }
    });
    child.on('error', reject);
  });
}

export async function kill(child: ChildProcess, signal: NodeJS.Signals = 'SIGINT') {
  if (child.pid === undefined) {
    throw new TypeError('Expected child with pid');
  }
  process.kill(child.pid, signal);
  // if (process.platform === 'win32') {
  //   // -PID not supported on Windows
  //   process.kill(child.pid, signal);
  // } else {
  //   process.kill(-child.pid, signal);
  // }
  try {
    await waitOnChild(child);
  } catch (err) {
    // Should error if the error is not a child process error or it is a child
    // process and either the platform is Windows or the signal matches.
    const shouldError = !(err instanceof ChildProcessError) || (process.platform !== 'win32' && err.signal !== signal);
    if (shouldError) {
      throw err;
    }
  }
}

export const shell = process.platform === 'win32';
