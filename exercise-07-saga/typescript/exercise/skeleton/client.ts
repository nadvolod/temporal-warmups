// Client — given to you complete. No changes needed.
// This starts the workflow and prints the result.

import { Client } from '@temporalio/client';
import { wellnessPurchaseWorkflow } from './workflow';
import { v4 as uuid } from 'uuid';
import type { WellnessIntake } from './models';

async function run() {
  const client = new Client();

  const workflowId = `wellness-${uuid()}`;
  const intake: WellnessIntake = {
    patientId: 'patient-001',
    productName: 'Ashwagandha Complex',
    dosage: '500mg daily',
    prescribingCondition: 'stress management',
  };

  console.log('\n🏥 Starting Wellness Purchase Workflow');
  console.log('─'.repeat(50));
  console.log(`Patient:   ${intake.patientId}`);
  console.log(`Product:   ${intake.productName} (${intake.dosage})`);
  console.log(`Workflow:  ${workflowId}`);
  console.log(`UI:        http://localhost:8233`);
  console.log('─'.repeat(50));

  const handle = await client.workflow.start(wellnessPurchaseWorkflow, {
    workflowId,
    taskQueue: 'wellness-purchase',
    args: [intake],
  });

  console.log('\n⏳ Workflow running. Send approval with:');
  console.log(`   npx ts-node approver.ts ${workflowId}\n`);
  console.log('   Or set FORCE_PAYMENT_FAIL=true before approving to test saga compensation.\n');

  const result = await handle.result();

  console.log('\n' + '─'.repeat(50));
  console.log(`Status: ${result.status.toUpperCase()}`);
  console.log(`Message: ${result.message}`);
  if (result.prescriptionId) {
    console.log(`Prescription ID: ${result.prescriptionId}`);
  }
  console.log('─'.repeat(50));
}

run().catch(console.error);
