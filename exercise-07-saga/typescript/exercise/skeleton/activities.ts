import { ApplicationFailure, log } from '@temporalio/activity';
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
  log.info('Submitting intake form', {
    patientId: intake.patientId,
    product: intake.productName,
    dosage: intake.dosage,
    condition: intake.prescribingCondition,
  });
  await sleep(500);
  const intakeId = `intake-${uuid()}`;
  log.info('Intake form submitted', { intakeId });
  return intakeId;
}

export async function recordApprovalActivity(approval: ApprovalDecision): Promise<string> {
  log.info('Recording approval', { providerId: approval.providerId, notes: approval.notes });
  await sleep(300);
  const approvalId = `approval-${uuid()}`;
  log.info('Approval recorded', { approvalId });
  return approvalId;
}

export async function processPaymentActivity(patientId: string): Promise<string> {
  log.info('Processing payment', { patientId });
  await sleep(800);

  const forceFailure = process.env.FORCE_PAYMENT_FAIL === 'true';
  if (forceFailure || Math.random() < 0.3) {
    log.warn('Payment declined', { patientId });
    // A declined card is a permanent business error — retrying the same card
    // won't help. Mark it non-retryable so the workflow goes straight to saga
    // compensation instead of burning retry attempts on a guaranteed failure.
    throw ApplicationFailure.nonRetryable('Payment processing failed: card declined', 'PaymentError');
  }

  const paymentId = `payment-${uuid()}`;
  log.info('Payment processed', { paymentId });
  return paymentId;
}

export async function sendPrescriptionActivity(intake: WellnessIntake, approvalId: string): Promise<string> {
  log.info('Sending prescription', { product: intake.productName, dosage: intake.dosage, approvalId });
  await sleep(500);
  const prescriptionId = `rx-${uuid()}`;
  log.info('Prescription sent', { prescriptionId });
  return prescriptionId;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPENSATION ACTIVITIES — ready-made repair operations
//
// NOTE: In a real system, compensations must be idempotent. Temporal can retry
// an activity, so running a compensation twice must be safe (e.g. "revoke only
// if not already revoked", "set status if not already set").
// ─────────────────────────────────────────────────────────────────────────────

export async function revokeApprovalActivity(approvalId: string): Promise<void> {
  log.info('COMPENSATION: revoking approval', { approvalId });
  await sleep(300);
  log.info('Approval revoked', { approvalId });
}

export async function updateIntakeStatusActivity(intakeId: string, status: string): Promise<void> {
  log.info('COMPENSATION: updating intake status', { intakeId, status });
  await sleep(300);
  log.info('Intake status updated — record preserved as lead', { intakeId, status });
}

// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
