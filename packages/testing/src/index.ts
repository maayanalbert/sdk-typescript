import { spawn, ChildProcess } from 'child_process';
import { AbortController } from 'abort-controller';
import { Connection, WorkflowClient, AsyncCompletionClient } from '@temporalio/client';
import { Core } from '@temporalio/worker';
import { ActivityFunction, CancelledFailure } from '@temporalio/common';
import * as activity from '@temporalio/activity';
import { waitOnChild, kill } from './child-process';
import { waitOnNamespace } from './utils';
import events from 'events';

export class TestEnvironment {
  protected constructor(protected readonly serverProc: ChildProcess, protected readonly conn: Connection) {}
  static async create() {
    // TODO: make this automatic / use unix socket
    const port = 7233;
    const address = `localhost:${port}`;
    const conn = new Connection({ address });
    const namespace = 'default';
    // TODO: make path configurable?
    // TODO: no inherit
    const child = spawn('temporalite', ['start', '--ephemeral', '--namespace', namespace], {
      stdio: 'inherit',
    });
    try {
      await Promise.race([
        conn.untilReady(),
        waitOnChild(child).then(() => {
          throw new Error('Child exited prematurely');
        }),
      ]);
      await waitOnNamespace(conn, namespace);
    } catch (err) {
      await kill(child);
      throw err;
    }
    // TODO: support multiple core instances
    await Core.install({ serverOptions: { address } });
    return new this(child, conn);
  }

  get connection() {
    return this.conn;
  }

  get asyncCompletionClient() {
    return new AsyncCompletionClient(this.conn.service);
  }

  get workflowClient() {
    return new WorkflowClient(this.conn.service);
  }

  async teardown() {
    this.conn.client.close();
    await kill(this.serverProc);
  }
}

export class MockActivityEnvironment extends events.EventEmitter {
  public cancel: (reason?: any) => void = () => undefined;
  public readonly context: activity.Context;

  constructor(info: activity.Info) {
    super();
    const abortController = new AbortController();
    const promise = new Promise<never>((_, reject) => {
      this.cancel = (reason?: any) => {
        abortController.abort();
        reject(new CancelledFailure(reason));
      };
    });
    const heartbeatCallback = (details?: unknown) => this.emit('heartbeat', details);
    this.context = new activity.Context(info, promise, abortController.signal, heartbeatCallback);
  }

  public run<P extends any[], R, F extends ActivityFunction<P, R>>(fn: F, ...args: P): Promise<R> {
    return activity.asyncLocalStorage.run(this.context, fn, ...args);
  }
}
