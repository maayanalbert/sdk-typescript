import anyTest, { TestInterface } from 'ava';
import { v4 as uuid4 } from 'uuid';
import { TestEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { defaultOptions } from './mock-native-worker';
import { RUN_INTEGRATION_TESTS } from './helpers';
import { sleeper } from './workflows';

interface Context {
  testEnv: TestEnvironment;
}

const test = anyTest as TestInterface<Context>;

if (RUN_INTEGRATION_TESTS) {
  test.before(async (t) => {
    t.context = {
      testEnv: await TestEnvironment.create(),
    };
  });

  test.after.always(async (t) => {
    await t.context.testEnv?.teardown();
  });

  test('TestEnvironment sets up test server and is able to run a Workflow', async (t) => {
    const worker = await Worker.create(defaultOptions);
    const client = t.context.testEnv.workflowClient;
    const runAndShutdown = async () => {
      await client.execute(sleeper, {
        workflowId: uuid4(),
        taskQueue: 'test',
        args: [1_000_000],
      });
      worker.shutdown();
    };
    await Promise.all([worker.run(), runAndShutdown()]);
  });
}
