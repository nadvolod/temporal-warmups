import {
  defineSignal,
  setHandler,
  condition,
  proxyActivities,
  log,
  CancellationScope,
} from '@temporalio/workflow';
import type * as activities from './activities';
import type { WellnessIntake, ApprovalDecision, PurchaseResult } from './models';

// Signal definition — exported so approver.ts can import and use it
export const approveWellnessPurchaseSignal = defineSignal<[ApprovalDecision]>('approveWellnessPurchase');

const {
  submitIntakeFormActivity,
  recordApprovalActivity,
  processPaymentActivity,
  sendPrescriptionActivity,
  revokeApprovalActivity,
  updateIntakeStatusActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3 },
});

export async function wellnessPurchaseWorkflow(intake: WellnessIntake): Promise<PurchaseResult> {
  log.info('Starting wellness purchase workflow', { patientId: intake.patientId });

  // Signal state — updated when provider sends the approval signal
  let approval: ApprovalDecision | null = null;
  setHandler(approveWellnessPurchaseSignal, (decision) => {
    approval = decision;
  });

  // Saga state tracking — track what succeeded so we know what to compensate
  let intakeId: string | null = null;
  let approvalId: string | null = null;

  try {
    // Step 1: Submit intake form
    intakeId = await submitIntakeFormActivity(intake);

    // Step 2: Wait for provider approval (30-second timeout for demo convenience)
    log.info('Waiting for provider approval signal...');
    const receivedSignal = await condition(() => approval !== null, '30 seconds');

    if (!receivedSignal) {
      // Timed out — no signal arrived within the window
      await updateIntakeStatusActivity(intakeId!, 'expired');
      return { status: 'expired', intakeId: intakeId!, message: 'Approval timed out. Lead preserved for follow-up.' };
    }

    if (!approval!.approved) {
      // Signal received but provider denied
      await updateIntakeStatusActivity(intakeId!, 'rejected');
      return { status: 'rejected', intakeId: intakeId!, message: 'Provider denied the prescription. Lead preserved for review.' };
    }

    // Step 3: Record the approval
    approvalId = await recordApprovalActivity(approval!);

    // Step 4: Process payment — THIS CAN FAIL (saga compensation kicks in)
    await processPaymentActivity(intake.patientId);

    // Step 5: Send prescription
    const prescriptionId = await sendPrescriptionActivity(intake, approvalId!);

    log.info('Wellness purchase completed!', { intakeId, approvalId, prescriptionId });
    return {
      status: 'completed',
      intakeId,
      prescriptionId,
      message: `Prescription for ${intake.productName} has been sent!`,
    };
  } catch (err) {
    log.error('Wellness purchase failed — running compensations in reverse order...');

    // CancellationScope.nonCancellable ensures compensations run even if the workflow is cancelled
    await CancellationScope.nonCancellable(async () => {
      if (approvalId) await revokeApprovalActivity(approvalId);                        // compensation 1 (most recent first)
      if (intakeId) await updateIntakeStatusActivity(intakeId, 'payment-failed');     // compensation 2 — preserve lead
    });

    throw err;
  }
}
