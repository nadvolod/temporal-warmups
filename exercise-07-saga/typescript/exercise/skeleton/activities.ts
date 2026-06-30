import { ApplicationFailure } from '@temporalio/activity';
import { v4 as uuid } from 'uuid';
import type { WellnessIntake, ApprovalDecision } from './models';

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION LOGIC — already implemented for the exercise
//
// The warmup is about Temporal orchestration, not writing fake database/payment
// plumbing. Treat these activities as ready-made adapters to external systems.
// Your job is to decide when the workflow calls them and how it compensates.
// ─────────────────────────────────────────────────────────────────────────────

export async function submitIntakeFormActivity(intake: WellnessIntake): Promise<string> {
  console.log(`📋 Submitting intake form for patient: ${intake.patientId}`);
  console.log(`   Product: ${intake.productName} (${intake.dosage})`);
  console.log(`   Condition: ${intake.prescribingCondition}`);
  await sleep(500);
  const intakeId = `intake-${uuid()}`;
  console.log(`✅ Intake form submitted. ID: ${intakeId}`);
  return intakeId;
}

export async function recordApprovalActivity(approval: ApprovalDecision): Promise<string> {
  console.log(`📝 Recording approval from provider: ${approval.providerId}`);
  if (approval.notes) {
    console.log(`   Notes: ${approval.notes}`);
  }
  await sleep(300);
  const approvalId = `approval-${uuid()}`;
  console.log(`✅ Approval recorded. ID: ${approvalId}`);
  return approvalId;
}

export async function processPaymentActivity(patientId: string): Promise<string> {
  console.log(`💳 Processing payment for patient: ${patientId}`);
  await sleep(800);

  const forceFailure = process.env.FORCE_PAYMENT_FAIL === 'true';
  if (forceFailure || Math.random() < 0.3) {
    console.log(`❌ Payment declined!`);
    throw ApplicationFailure.create({ message: 'Payment processing failed: card declined' });
  }

  const paymentId = `payment-${uuid()}`;
  console.log(`✅ Payment processed. ID: ${paymentId}`);
  return paymentId;
}

export async function sendPrescriptionActivity(intake: WellnessIntake, approvalId: string): Promise<string> {
  console.log(`💊 Sending prescription for: ${intake.productName}`);
  console.log(`   Dosage: ${intake.dosage}`);
  console.log(`   Approval ref: ${approvalId}`);
  await sleep(500);
  const prescriptionId = `rx-${uuid()}`;
  console.log(`✅ Prescription sent. ID: ${prescriptionId}`);
  return prescriptionId;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPENSATION ACTIVITIES — ready-made undo operations
// ─────────────────────────────────────────────────────────────────────────────

export async function revokeApprovalActivity(approvalId: string): Promise<void> {
  console.log(`↩️  COMPENSATION: Revoking approval: ${approvalId}`);
  await sleep(300);
  console.log(`✅ Approval revoked.`);
}

export async function cancelIntakeActivity(intakeId: string): Promise<void> {
  console.log(`↩️  COMPENSATION: Cancelling intake: ${intakeId}`);
  await sleep(300);
  console.log(`✅ Intake cancelled.`);
}

// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
