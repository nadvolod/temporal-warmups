# Exercise 07 — Wellness Purchase Workflow (TypeScript)

## Scenario

A patient visits a wellness platform, fills out an intake form, and wants to purchase a prescription supplement. Before anything can ship, a healthcare provider must review and approve the order. Once approved, payment is processed and the prescription is sent.

Simple enough — until something goes wrong.

## Quickstart Docs By Temporal

🚀 [Get started in a few mins](https://docs.temporal.io/quickstarts?utm_campaign=awareness-nikolay-advolodkin&utm_medium=code&utm_source=github)

---

## The Problem

```
Patient fills out intake form
  ↓
Provider approves (via... email? phone call? hope?)
  ↓
Payment processed ← CAN FAIL
  ↓
❌ Payment declined!

What now?
  → The intake form is still "approved" in the system
  → The provider's approval was never revoked
  → The patient thinks they have a valid prescription
  → Nothing will automatically clean this up
```

This is called **orphaned state** — and it's a nightmare in distributed systems.

Run the broken version first to feel the pain. Two options:

**Option A — Interactive visual demo (recommended):**
Open the [interactive pre-Temporal demo](./exercise/pre-temporal.html) in your browser. Step through the process with "Next Step" and watch database records become orphaned when payment fails.

**Option B — Terminal:**
```bash
cd exercise-07-saga/typescript/exercise/skeleton
npm install
npm run pre-temporal
```

Run it a few times. About 30% of the time you'll see the failure. Notice that nothing cleans up after itself.

---

## What You'll Build

A durable Temporal workflow around application logic that is already provided.

The business operations are ready-made activities: submit intake, record approval, process payment, send prescription, revoke approval, and update intake status. You will read them like external system adapters, then focus your typing on Temporal: activity proxy options, signal handling, workflow orchestration, saga state, and compensation order.

This keeps the warmup pointed at the skill you came here to practice. No one needs to spend 20 minutes writing fake `sleep()` calls before the orchestra shows up.

You'll combine two patterns:

1. **Signals** (you learned this in Exercise 06) — a real doctor "sends" approval by signaling into the running workflow
2. **Saga/Compensation** (you learned this in Exercise 05) — if payment fails, the workflow automatically reverses everything that succeeded

```
submitIntakeForm()
  ↓
🕐 WAIT for approveWellnessPurchase signal ← doctor sends this from approver.ts
  ↓
recordApproval()
  ↓
processPayment()          ← 30% chance of failure!
  ↓ ON FAILURE:
    ↩️  revokeApproval()                    ← compensation 1 (most recent first!)
    ↩️  updateIntakeStatus('payment-failed') ← compensation 2 — lead preserved
  ↓ ON SUCCESS:
sendPrescription()
  ↓ Done ✅
```

The magic: **Temporal guarantees compensations run** even if the worker crashes mid-compensation.

---

## What You'll Learn

1. **Signal handler pattern in TypeScript** — `defineSignal`, `setHandler`, `condition()`
2. **Saga state tracking** — tracking what succeeded with `intakeId` and `approvalId`
3. **Compensation in reverse order** — most recent step undone first
4. **`CancellationScope.nonCancellable`** — compensations run even if the workflow is cancelled
5. **`ApplicationFailure`** — how activities signal non-retryable failures

---

## Prerequisites

- Node.js 18+
- Temporal CLI installed (`temporal` command available)
- Completed Exercise 05 (Saga pattern) and Exercise 06 (Signals)

---

## Step 1: Run the Broken Version

```bash
cd exercise-07-saga/typescript/exercise/skeleton
npm install
npm run pre-temporal
```

Run it 5 times. Some will succeed, some will fail. When it fails, notice the console output explains exactly what's left orphaned.

**Observation:** There's no real way for a doctor to "approve" anything. The approval is simulated with a 1-second sleep. And when payment fails, nothing cleans up.

---

## Saga Pattern: Why This Exercise Exists

In a single database, you might wrap several writes in one transaction: either everything commits, or everything rolls back.

Distributed systems rarely give you that luxury. This workflow touches separate pieces of the world: intake records, provider approvals, payment processing, and prescription delivery. There is no giant magical transaction that can wrap all of those systems together.

A **Saga** handles that reality by pairing important forward steps with compensation steps:

```
Forward step                  Compensation if a later step fails
───────────────────────────   ──────────────────────────────────
submitIntakeFormActivity      updateIntakeStatusActivity('expired'|'rejected'|'payment-failed')
recordApprovalActivity        revokeApprovalActivity
processPaymentActivity        refundPaymentActivity (not needed in this version)
sendPrescriptionActivity      final step, no later failure in this exercise
```

The goal is not to rewind time perfectly. The goal is to leave the business in a truthful, repairable state.

Notice that the intake record is **never deleted** — it's a lead. Every failure path marks the record with a status (`expired`, `rejected`, or `payment-failed`) so downstream systems can act on it: follow up with the patient, retry payment, or route to a dunning workflow.

Temporal makes sagas practical because the workflow history remembers which steps completed. Even if the worker crashes, the workflow can resume and continue the compensation path instead of relying on somebody's TODO comment, dashboard refresh, or heroic memory.

---

## Setup for Temporal Steps

**Terminal 1 — Temporal dev server:**
```bash
temporal server start-dev
```

**Terminal 2 — your work directory (already done in Step 1):**
```bash
cd exercise-07-saga/typescript/exercise/skeleton
```

---

## Step 2: Inspect the Ready-Made Activities

Open `activities.ts`. The 6 activity functions are already implemented for you:

**Forward activities** (the happy path):
- `submitIntakeFormActivity` — store the intake, return an ID
- `recordApprovalActivity` — record the approval, return an ID
- `processPaymentActivity` — charge the patient (can fail!)
- `sendPrescriptionActivity` — deliver the prescription

**Compensation activities** (the cleanup path):
- `revokeApprovalActivity` — undo the approval record
- `updateIntakeStatusActivity` — mark the intake as `expired`, `rejected`, or `payment-failed` (record is preserved as a lead)

Before moving on, use the activities as a tiny quiz. Read the function names and signatures, make your guess, then expand the answer.

<details>
<summary><strong>Q1.</strong> Which activities are external side effects the workflow must orchestrate durably?</summary>

All six activities represent external side effects:

- `submitIntakeFormActivity` creates an intake record
- `recordApprovalActivity` creates an approval record
- `processPaymentActivity` talks to a payment system
- `sendPrescriptionActivity` sends the prescription
- `revokeApprovalActivity` changes the approval record
- `updateIntakeStatusActivity` marks the intake record with a status (lead preserved)

That is the muscle. Activities are the delivery trucks, payment terminal, and medical records desk. The workflow is the flight plan and black box: it defines the route, remembers which legs completed, and knows the safe repair path if a later step fails.
</details>

<details>
<summary><strong>Q2.</strong> Which activity is intentionally unreliable, and why is that useful for this exercise?</summary>

`processPaymentActivity` can fail randomly, or always fail when `FORCE_PAYMENT_FAIL=true`.

That failure is the training weight. It gives the workflow a real reason to run compensation, so you can see Temporal preserve the story of what already happened and then execute the cleanup steps in order.
</details>

<details>
<summary><strong>Q3.</strong> Why does `recordApprovalActivity` return an `approvalId`?</summary>

The workflow needs that `approvalId` if payment fails later.

Once approval has been recorded, the workflow stores the ID as saga state. If payment fails, the workflow can pass that ID to `revokeApprovalActivity` and undo the exact approval record that was created.
</details>

<details>
<summary><strong>Q4.</strong> Which activities are compensations, and when should they run?</summary>

`revokeApprovalActivity` and `updateIntakeStatusActivity` are compensations, not happy-path steps.

Note they do different kinds of repair: `revokeApprovalActivity` truly *undoes* the approval, while `updateIntakeStatusActivity` *keeps* the intake and just records how it ended. Both should run only after a later step fails, and only if the step they repair actually happened. That is why the workflow tracks `approvalId` and `intakeId` instead of blindly calling every repair function.
</details>

<details>
<summary><strong>Q5.</strong> How do you decide which activities should have a compensation activity?</summary>

Ask: **if this activity succeeds, and a later step fails, what bad state is left behind?**

Activities usually need compensation when they create, reserve, approve, charge, notify, or otherwise commit durable business state that would become misleading or harmful if the workflow does not finish.

In this exercise:
- `submitIntakeFormActivity` is paired with `updateIntakeStatusActivity` — but notice we deliberately *keep* the intake. It's a lead worth money. The repair is to stamp it (`expired`, `rejected`, `payment-failed`) so another process can follow up, retry payment, or start a dunning workflow. Deleting it would throw away a real customer.
- `recordApprovalActivity` needs `revokeApprovalActivity` because approval without payment would make the patient and provider records lie
- `processPaymentActivity` would need a refund compensation if a later step after payment could fail
- `sendPrescriptionActivity` is the final happy-path step here, so there is no later failure to compensate for in this version

Not every compensation is an undo. Sometimes the right repair is "mark as payment-failed," "release the hold," "send a correction," or "open a manual review task" — leaving durable business value in place while recording the truth. The key is to design the business repair path before the failure happens.
</details>

**Checkpoint 1:** Start the worker and verify it registers without errors:
```bash
npx ts-node worker.ts
```

You should see:
```
🏥 Wellness worker started on task queue: wellness-purchase
   Waiting for workflow tasks... (Ctrl+C to stop)
```

---

## Step 3: Implement the Signal Handler

Open `workflow.ts`. Find the **SIGNAL HANDLER SETUP** section.

You need to:
1. Declare `let approval: ApprovalDecision | null = null`
2. Register the signal handler with `setHandler`

When approver.ts sends the signal, the handler fires and sets `approval`. The `condition()` call in Step 4 is watching that variable.

Think of `setHandler` like a mailbox. The workflow keeps running, and whenever the signal arrives, the handler deposits it into `approval`. The workflow doesn't block waiting — it can do other work. `condition()` is what actually pauses until the mailbox has something.

**Checkpoint 2:** After registering the signal handler, test it in isolation:
```bash
# Terminal 2
npx ts-node client.ts
# Copy the workflow ID from the output

# Terminal 3
npx ts-node approver.ts <workflow-id>
```

At this point the workflow will panic at `throw new Error('TODO')`, but you should see the signal arrive in Temporal UI (http://localhost:8233) → Event History.

---

## Step 4: Implement the Temporal Saga Workflow

Now implement the full workflow body in `workflow.ts`:

**Forward path:**
1. Submit intake form → store `intakeId`
2. `await condition(() => approval !== null, '30 seconds')` → handle timeout and rejection
3. Record approval → store `approvalId`
4. Process payment ← this throws on failure
5. Send prescription → return success

**Compensation path (the catch block):**
```typescript
await CancellationScope.nonCancellable(async () => {
  if (approvalId) await revokeApprovalActivity(approvalId);                    // most recent first
  if (intakeId)   await updateIntakeStatusActivity(intakeId, 'payment-failed'); // lead preserved
});
throw err; // re-throw so the workflow is marked failed
```

> **Why `CancellationScope.nonCancellable`?**
> If a workflow is externally cancelled while compensating, normal activities get cancelled too. `nonCancellable` creates a bubble where your compensations are protected and will always run to completion.

> **Why null checks?**
> `if (approvalId)` ensures we only compensate what actually succeeded. If payment fails *before* recordApproval completes, `approvalId` is still null and we skip that compensation.

**Checkpoint 3:** Test the happy path end-to-end:
```bash
# Terminal 2
npx ts-node client.ts
# Copy the workflow ID

# Terminal 3
npx ts-node approver.ts <workflow-id>
```

The workflow should complete with `status: COMPLETED` (about 70% of the time — the other 30% payment fails and you'll see compensations).

**Checkpoint 4:** Force the compensation chain.

`processPaymentActivity` reads `FORCE_PAYMENT_FAIL`, and **activities run in the worker process** — so the env var must be set on the *worker*, not the client. Restart your worker with it:

```bash
# Terminal 1 — stop the worker (Ctrl+C) and restart it with the flag
FORCE_PAYMENT_FAIL=true npx ts-node worker.ts
```

Then start a workflow and approve it as usual:
```bash
# Terminal 2
npx ts-node client.ts
# Copy the workflow ID

# Terminal 3
npx ts-node approver.ts <workflow-id>
```

Open Temporal UI → find your workflow → Event History. You should see:
```
✅ submitIntakeFormActivity      → completed
✅ recordApprovalActivity        → completed
❌ processPaymentActivity        → failed
   ↓ Compensation begins
✅ revokeApprovalActivity        → completed  ← most recent step, undone first
✅ updateIntakeStatusActivity    → completed  ← lead preserved as 'payment-failed'
❌ WorkflowExecutionFailed
```

That's the Saga pattern in action. 🎉

---

## Quiz

Test your understanding before moving on:

**1.** Payment fails after the intake form is submitted but *before* `recordApprovalActivity` completes. Which compensations run?

<details>
<summary>Answer</summary>

Only `updateIntakeStatusActivity`. The `approvalId` is still `null` because `recordApprovalActivity` never completed, so the `if (approvalId)` check skips `revokeApprovalActivity`. This is why state tracking matters — you only compensate what actually succeeded.
</details>

**2.** Why must compensations run in reverse order?

<details>
<summary>Answer</summary>

Because each step may depend on the previous one's state. If you stamped the intake as `payment-failed` before revoking the approval, the approval record would briefly reference an intake already marked dead. Reverse order ensures each repair operation works on a valid system state.
</details>

**3.** A colleague suggests: "Just wrap the whole workflow in try/catch and always run every compensation activity." What's wrong with this?

<details>
<summary>Answer</summary>

If `submitIntakeFormActivity` fails, `intakeId` is null and `updateIntakeStatusActivity` would crash (or silently fail if given a null/undefined ID). Compensating steps that never ran can cause new errors or leave the system in an inconsistent state. Always track state and only compensate what succeeded.
</details>

---

## Common Pitfalls

### TypeScript-specific

**`import type` vs `import`**
```typescript
// ✅ Correct — type-only import in workflow file
import type * as activities from './activities';

// ❌ Wrong — this imports the actual module into the workflow bundle
import * as activities from './activities';
```
The workflow runs in an isolated V8 sandbox. Importing actual activity modules into it can cause bundling errors and non-determinism.

**`proxyActivities` is the bridge**
```typescript
// ✅ Always call activities through the proxy
const { submitIntakeFormActivity } = proxyActivities<typeof activities>({ ... });
await submitIntakeFormActivity(intake);

// ❌ Never call the imported activity function directly from a workflow
import { submitIntakeFormActivity } from './activities'; // wrong!
await submitIntakeFormActivity(intake); // this bypasses Temporal entirely
```

**Signal handler must be synchronous**
```typescript
// ✅ Correct — handler updates local state synchronously
setHandler(approveWellnessPurchaseSignal, (decision) => {
  approval = decision; // synchronous assignment
});

// ❌ Wrong — async signal handlers can cause handlers to outlive the workflow
setHandler(approveWellnessPurchaseSignal, async (decision) => {
  await someActivity(decision); // async in signal handler = trouble
});
```

### Saga-specific

**Wrong compensation order**
```
❌ updateIntakeStatus → revokeApproval  (forward order — wrong!)
✅ revokeApproval → updateIntakeStatus  (reverse order — correct!)
```

**Forgetting null checks**
```typescript
// ❌ Wrong — crashes if approval was never recorded
await revokeApprovalActivity(approvalId!); // approvalId might be null

// ✅ Right — only compensate what succeeded
if (approvalId) await revokeApprovalActivity(approvalId);
```

**Re-throwing the error**
```typescript
// ❌ Wrong — workflow silently succeeds even though it failed
} catch (err) {
  await runCompensations();
  // missing: throw err
}

// ✅ Right — re-throw so the workflow is marked failed in Temporal UI
} catch (err) {
  await runCompensations();
  throw err;
}
```

---

## Success Criteria

- ✅ Worker starts and registers all activities + workflow
- ✅ `client.ts` starts a workflow visible in Temporal UI
- ✅ `approver.ts` sends a signal that resumes the workflow (visible in Event History)
- ✅ Happy path completes with `status: completed` and a `prescriptionId`
- ✅ `FORCE_PAYMENT_FAIL=true` triggers compensation chain in reverse order (visible in Event History)
- ✅ Denial path (`--deny` flag) marks intake as `rejected` and returns `status: rejected`
- ✅ Timeout path marks intake as `expired` and returns `status: expired`

---

## Next Steps

1. **Add a timeout scenario** — let the 30-second window expire without sending a signal. What status do you get?
2. **Extend the approval** — add a `patientId` query so the doctor can look up patient info before approving
3. **Add a prescription failure** — make `sendPrescriptionActivity` also fail sometimes, and add its compensation (refund the payment)
4. **Real persistence** — replace the simulated `uuid` returns with actual database records

---

## Additional Resources

- [Temporal Saga Pattern](https://docs.temporal.io/encyclopedia/saga-pattern)
- [TypeScript SDK — Signals](https://docs.temporal.io/develop/typescript/message-passing)
- [TypeScript SDK — Cancellation Scopes](https://docs.temporal.io/develop/typescript/cancellation)
- [CancellationScope API reference](https://typescript.temporal.io/api/classes/workflow.CancellationScope)

---

## Estimated Time

- Run the broken version: 5 minutes
- Inspect ready-made activities: 5 minutes
- Implement the workflow: 30–45 minutes
- Total: **~45–55 minutes**
