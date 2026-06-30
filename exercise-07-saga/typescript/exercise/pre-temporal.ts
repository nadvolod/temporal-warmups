// PRE-TEMPORAL VERSION — read this first before starting the exercise!
//
// This is a wellness purchase flow WITHOUT Temporal.
// Run it and notice what breaks:
//   npm run pre-temporal   (from exercise/skeleton/ or solution/)
//
// Questions to think about:
//   1. What happens if the server crashes after approval but before payment?
//   2. What happens if payment fails? Does the approval get revoked?
//   3. How would you retry a failed payment without double-charging?
//   4. How would a real doctor "send" their approval here — email? Polling a database?
//
// These are the problems Temporal solves. Let's build a better version.

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface WellnessIntake {
  patientId: string;
  productName: string;
  dosage: string;
}

// ------------------------------------------------------------------
// Fake "database" — in-memory only, lost on crash
// ------------------------------------------------------------------
const intakeForms: Record<string, WellnessIntake> = {};
const approvals: string[] = [];

// ------------------------------------------------------------------
// Procedural steps — no retries, no durability, no compensation
// ------------------------------------------------------------------

async function submitIntakeForm(intake: WellnessIntake): Promise<string> {
  console.log(`📋 Submitting intake for ${intake.patientId}...`);
  await sleep(500);
  const intakeId = `intake-${uid()}`;
  intakeForms[intakeId] = intake; // stored in-memory only!
  console.log(`✅ Intake submitted: ${intakeId}`);
  return intakeId;
}

async function waitForApproval(): Promise<boolean> {
  // PROBLEM: There's no real mechanism here for a human to approve.
  // We're just pretending by waiting 1 second.
  // A real system would need polling, webhooks, or... Temporal Signals!
  console.log('⏳ Waiting for provider approval... (simulated 1 second)');
  await sleep(1000);
  console.log('✅ Approved! (simulated — not actually a real human decision)');
  approvals.push('fake-approval'); // stored in-memory only!
  return true;
}

async function processPayment(patientId: string): Promise<string> {
  console.log(`💳 Processing payment for ${patientId}...`);
  await sleep(800);

  // 30% chance of payment failure
  if (Math.random() < 0.3) {
    throw new Error('Payment declined: insufficient funds');
  }

  const paymentId = `payment-${uid()}`;
  console.log(`✅ Payment processed: ${paymentId}`);
  return paymentId;
}

async function sendPrescription(intake: WellnessIntake): Promise<void> {
  console.log(`💊 Sending prescription for ${intake.productName}...`);
  await sleep(500);
  console.log(`✅ Prescription sent!`);
}

// ------------------------------------------------------------------
// Main purchase flow — the problems live here
// ------------------------------------------------------------------

async function purchaseWellnessProduct(intake: WellnessIntake): Promise<void> {
  console.log('\n=== Wellness Purchase (Pre-Temporal) ===\n');

  // Step 1: Submit intake form
  const intakeId = await submitIntakeForm(intake);

  // Step 2: Wait for approval (fake!)
  const approved = await waitForApproval();
  if (!approved) {
    // PROBLEM: We clean up in-memory state, but if the process crashed before
    // this line, intakeForms[intakeId] would be left dangling forever.
    delete intakeForms[intakeId];
    console.log('❌ Not approved. Intake cancelled.');
    return;
  }

  // Step 3: Process payment
  // PROBLEM: If payment fails, the approval is NOT revoked.
  //          The patient has an approved prescription that was never filled.
  //          If the process CRASHES HERE, we lose track of the intake ID
  //          and have no way to clean up.
  const paymentId = await processPayment(intake.patientId);

  // Step 4: Send prescription
  await sendPrescription(intake);
}

// ------------------------------------------------------------------

async function main() {
  const intake: WellnessIntake = {
    patientId: 'patient-001',
    productName: 'Ashwagandha Complex',
    dosage: '500mg daily',
  };

  try {
    await purchaseWellnessProduct(intake);
    console.log('\n✅ Purchase complete!\n');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Purchase FAILED: ${message}`);
    console.error('\n⚠️  What went wrong (orphaned state):');
    console.error('   → Intake form is still "active" in the database');
    console.error('   → Approval was never revoked');
    console.error('   → Patient may think they have a valid prescription');
    console.error('   → No retry will run automatically\n');
    console.error('   This is the problem Temporal + the Saga pattern solves.\n');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main();
