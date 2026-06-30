import { Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflow'),
    activities,
    taskQueue: 'wellness-purchase',
  });

  console.log('🏥 Wellness worker started on task queue: wellness-purchase');
  console.log('   Waiting for workflow tasks... (Ctrl+C to stop)\n');
  await worker.run();
}

run().catch(console.error);
