// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW SKELETON — your job is to fill in the Temporal orchestration TODOs
//
// The workflow combines two patterns you've seen before:
//   1. Signals (Exercise 06) — wait for a doctor to approve via signal
//   2. Saga/Compensation (Exercise 05) — if payment fails, undo the approval
//
// The application logic lives in activities.ts and is already implemented.
// Focus here on durable orchestration: activity options, signal state, ordering,
// waiting, compensation, and the result returned to the caller.
//
// The signal arrives from approver.ts.
// The compensation runs automatically when processPaymentActivity throws.
// ─────────────────────────────────────────────────────────────────────────────

import {
  defineSignal,
  setHandler,
  condition,
  proxyActivities,
  log,
  CancellationScope,
} from "@temporalio/workflow";
import type * as activities from "./activities";
import type {
  WellnessIntake,
  ApprovalDecision,
  PurchaseResult,
} from "./models";

// ─── SIGNAL DEFINITION ────────────────────────────────────────────────────────
//
// Given: approval signal definition.
//
// A signal lets external code (approver.ts) push data INTO this running workflow.
// The signal carries one argument: an ApprovalDecision.
//
// This is exported so approver.ts can import and use it.
//
export const approveWellnessPurchaseSignal = defineSignal<[ApprovalDecision]>(
  "approveWellnessPurchase",
);

// ─── ACTIVITY PROXIES ─────────────────────────────────────────────────────────
//
// TODO: Fill in the proxyActivities options.
//
// Required options:
//   startToCloseTimeout: '5 minutes'
//   retry: { maximumAttempts: 3 }
//
const {
  submitIntakeFormActivity,
  recordApprovalActivity,
  processPaymentActivity,
  sendPrescriptionActivity,
  revokeApprovalActivity,
  updateIntakeStatusActivity,
} = proxyActivities<typeof activities>({
  // TODO: fill in startToCloseTimeout and retry options
});

// ─── WORKFLOW ─────────────────────────────────────────────────────────────────

export async function wellnessPurchaseWorkflow(
  intake: WellnessIntake,
): Promise<PurchaseResult> {
  log.info("Starting wellness purchase workflow", {
    patientId: intake.patientId,
  });

  // ── SIGNAL HANDLER SETUP ─────────────────────────────────────────────────
  //
  // TODO: Declare the approval state variable and register the signal handler.
  //
  // 1. Declare: let approval: ApprovalDecision | null = null;
  // 2. Call setHandler(approveWellnessPurchaseSignal, (decision) => { ... })
  //    Inside the handler, store the received decision in your approval variable.
  //
  // When approver.ts sends the signal, this handler fires and updates `approval`.
  // The workflow is paused on condition() below and will resume when it fires.

  // ── SAGA STATE TRACKING ───────────────────────────────────────────────────
  //
  // TODO: Declare saga state variables.
  //
  // These track what has succeeded so we know what to compensate on failure.
  // Initialize both to null — they get set as each step completes.
  //
  // let intakeId: string | null = null;
  // let approvalId: string | null = null;

  try {
    // ── STEP 1: Submit intake form ──────────────────────────────────────────
    //
    // TODO: Call submitIntakeFormActivity and store the result in intakeId.
    //
    // intakeId = await submitIntakeFormActivity(intake);

    // ── STEP 2: Wait for provider approval ─────────────────────────────────
    //
    // TODO: Wait for the signal to arrive using condition().
    //
    // condition() pauses the workflow until a predicate becomes true.
    //   const receivedSignal = await condition(() => approval !== null, '30 seconds');
    //
    // The '30 seconds' timeout is short for demo convenience.
    // In production you'd use something like '24 hours' or '7 days'.
    //
    // After waiting:
    //   - If !receivedSignal (timed out): updateIntakeStatusActivity(intakeId!, 'expired'),  return { status: 'expired', ... }
    //   - If !approval.approved (denied):  updateIntakeStatusActivity(intakeId!, 'rejected'), return { status: 'rejected', ... }

    log.info("Waiting for provider approval signal...");
    // TODO: implement the condition wait and handle timeout/rejection

    // ── STEP 3: Record the approval ─────────────────────────────────────────
    //
    // TODO: Call recordApprovalActivity and store the result in approvalId.
    //
    // approvalId = await recordApprovalActivity(approval!);

    // ── STEP 4: Process payment (THIS IS WHERE THE SAGA KICKS IN) ───────────
    //
    // TODO: Call processPaymentActivity.
    //
    // This activity can throw! When it does, execution jumps to the catch block
    // where we run compensation in reverse order.
    //
    // await processPaymentActivity(intake.patientId);

    // ── STEP 5: Send prescription ────────────────────────────────────────────
    //
    // TODO: Call sendPrescriptionActivity and capture the prescriptionId.
    //
    // const prescriptionId = await sendPrescriptionActivity(intake, approvalId!);

    // ── STEP 6: Return success ────────────────────────────────────────────────
    //
    // TODO: Return a PurchaseResult with status: 'completed'.

    throw new Error(
      "TODO: implement workflow steps (remove this line when done)",
    );
  } catch (err) {
    // ── SAGA COMPENSATION ─────────────────────────────────────────────────────
    //
    // TODO: Run compensations in REVERSE ORDER.
    //
    // Most recent activity first:
    //   1. if (approvalId) await revokeApprovalActivity(approvalId);                          ← undo step 3
    //   2. if (intakeId)   await updateIntakeStatusActivity(intakeId, 'payment-failed');      ← preserve lead
    //
    // Wrap in CancellationScope.nonCancellable so compensations run even if
    // the workflow itself gets cancelled.
    //
    // await CancellationScope.nonCancellable(async () => {
    //   if (approvalId) await revokeApprovalActivity(approvalId);
    //   if (intakeId)   await updateIntakeStatusActivity(intakeId, 'payment-failed');
    // });

    throw err;
  }
}
