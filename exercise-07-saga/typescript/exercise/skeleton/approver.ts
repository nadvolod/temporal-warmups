// Approver — given to you complete. No changes needed.
// This sends the approval signal to a running workflow, simulating a doctor's decision.

import { Client } from '@temporalio/client';
import { approveWellnessPurchaseSignal } from './workflow';
import type { ApprovalDecision } from './models';

async function run() {
  const workflowId = process.argv[2];
  const deny = process.argv[3] === '--deny';

  if (!workflowId) {
    console.error('Usage: npx ts-node approver.ts <workflow-id> [--deny]');
    console.error('  --deny  Send a rejection decision instead of approval');
    process.exit(1);
  }

  const client = new Client();
  const handle = client.workflow.getHandle(workflowId);

  const decision: ApprovalDecision = {
    approved: !deny,
    providerId: 'dr-smith-001',
    notes: deny
      ? 'Prescription not appropriate for stated condition'
      : 'Approved for stress management protocol',
  };

  console.log(`\n👨‍⚕️  Sending approval signal`);
  console.log('─'.repeat(50));
  console.log(`Workflow:  ${workflowId}`);
  console.log(`Provider:  ${decision.providerId}`);
  console.log(`Decision:  ${decision.approved ? '✅ APPROVED' : '❌ DENIED'}`);
  console.log(`Notes:     ${decision.notes}`);
  console.log('─'.repeat(50) + '\n');

  await handle.signal(approveWellnessPurchaseSignal, decision);
  console.log('✅ Signal sent! Check the workflow in Temporal UI to see it resume.\n');
}

run().catch(console.error);
