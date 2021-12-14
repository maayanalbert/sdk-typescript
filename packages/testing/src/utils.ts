import { Connection } from '@temporalio/client';

export async function waitOnNamespace(
  connection: Connection,
  namespace: string,
  maxAttempts = 100,
  retryIntervalSecs = 1
) {
  const runId = '12345678-dead-beef-1234-1234567890ab';
  for (let attempt = 1; attempt <= maxAttempts; ++attempt) {
    try {
      await connection.service.getWorkflowExecutionHistory({
        namespace,
        execution: { workflowId: 'fake', runId },
      });
    } catch (err: any) {
      console.log(err);
      if (err.details.includes('workflow history not found') || err.details.includes(runId)) {
        break;
      }
      if (attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, retryIntervalSecs * 1000));
    }
  }
}
