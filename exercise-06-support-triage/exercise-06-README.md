# Exercise 06 - LLM-Powered Customer Support Triage (Java)

## Scenario

You have an AI-powered customer support triage system that coordinates multiple LLM agents:
1. **PII Scrubbing Agent** - Uses GPT-4 to redact sensitive information (credit cards, SSNs, emails)
2. **Classification Agent** - Uses GPT-4 to categorize and assess urgency
3. New usage of `@SignalQuery` for Human-in-the-loop scenarios

The system routes high-risk or low-confidence tickets to human review, while auto-processing low-risk tickets. This is a realistic use case for Temporal customers building **multi-agent AI orchestration** with **human-in-the-loop** approval.

![signal](src/main/java/solution/temporal/signal-image.png)

## Quickstart Docs By Temporal

[Get started in a few mins](https://docs.temporal.io/quickstarts?utm_campaign=awareness-nikolay-advolodkin&utm_medium=code&utm_source=github)

---

## Temporal Architecture Overview

This diagram shows how the key Temporal components interact in this exercise:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TEMPORAL SERVER                                    │
│                        (localhost:7233)                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Task Queue: "support-triage"                     │    │
│  │                                                                      │    │
│  │   Stores: Workflow state, Activity results, Signal data, Timers     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│    CLIENT     │     │     WORKER      │     │   EXTERNAL SYSTEM   │
│  (Starter.java)│     │  (WorkerApp.java)│     │   (CLI / API)       │
│               │     │                 │     │                     │
│ • Starts      │     │ • Polls task    │     │ • Sends signals     │
│   workflows   │     │   queue         │     │   for human         │
│ • Gets results│     │ • Executes      │     │   approval          │
│               │     │   workflows &   │     │                     │
│               │     │   activities    │     │ temporal workflow   │
│               │     │                 │     │   signal ...        │
└───────────────┘     └────────┬────────┘     └─────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────────────┐
        │              WORKFLOW EXECUTION                       │
        │         (SupportTriageWorkflowImpl)                   │
        │                                                       │
        │  ┌─────────────────────────────────────────────────┐ │
        │  │  @WorkflowMethod triageTicket(ticketId, text)   │ │
        │  │                                                  │ │
        │  │    1. Execute Activity: scrubPII()              │ │
        │  │              │                                   │ │
        │  │              ▼                                   │ │
        │  │    2. Execute Activity: classifyTicket()        │ │
        │  │              │                                   │ │
        │  │              ▼                                   │ │
        │  │    3. Routing Logic (deterministic)             │ │
        │  │       if (confidence < 0.7 || urgency=critical) │ │
        │  │              │                                   │ │
        │  │              ▼                                   │ │
        │  │    4. Workflow.await() ◄── @SignalMethod        │ │
        │  │       (waits for human approval)                │ │
        │  │              │                                   │ │
        │  │              ▼                                   │ │
        │  │    5. Return TriageResult                       │ │
        │  └─────────────────────────────────────────────────┘ │
        │                                                       │
        │  ┌────────────────────┐  ┌────────────────────────┐  │
        │  │  ACTIVITY 1        │  │  ACTIVITY 2            │  │
        │  │  PIIScrubber       │  │  TicketClassifier      │  │
        │  │                    │  │                        │  │
        │  │  • Calls OpenAI    │  │  • Calls OpenAI        │  │
        │  │  • Redacts PII     │  │  • Returns category,   │  │
        │  │  • Retries: 5x     │  │    urgency, confidence │  │
        │  │  • Timeout: 60s    │  │  • Retries: 5x         │  │
        │  └────────────────────┘  └────────────────────────┘  │
        └──────────────────────────────────────────────────────┘
```

### Component Breakdown

| Component | File(s) | Responsibility |
|-----------|---------|----------------|
| **Temporal Server** | External process | Orchestrates everything - stores workflow state, manages task queues, persists signals, handles retries |
| **Client** | `Starter.java` | Starts workflow executions, waits for results |
| **Worker** | `WorkerApp.java` | Long-running process that polls task queue, executes workflows and activities |
| **Workflow** | `SupportTriageWorkflow.java` (interface) `SupportTriageWorkflowImpl.java` (impl) | Orchestrates the multi-agent flow with deterministic logic |
| **Activities** | `PIIScrubberActivity.java` `TicketClassifierActivity.java` | Non-deterministic operations (OpenAI API calls) |
| **Signal** | `@SignalMethod approveTicket()` | Enables external code to send data into running workflow |

### Data Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Raw Text   │───▶│  Activity 1  │───▶│  Activity 2  │───▶│   Workflow   │
│              │    │  (Scrub PII) │    │  (Classify)  │    │   Decision   │
│ "My SSN is   │    │              │    │              │    │              │
│  123-45-6789"│    │ "My SSN is   │    │ category:    │    │ needsReview? │
│              │    │  [REDACTED]" │    │   billing    │    │     │        │
└──────────────┘    └──────────────┘    │ confidence:  │    └─────┼────────┘
                                        │   0.65       │          │
                                        └──────────────┘          ▼
                                                            ┌──────────────┐
                                                            │    Signal    │
                                                            │   (await)    │
                                                            │              │
                                         Human approval ───▶│ approveTicket│
                                                            │   (true)     │
                                                            └──────┬───────┘
                                                                   │
                                                                   ▼
                                                            ┌──────────────┐
                                                            │TriageResult  │
                                                            │ caseId:      │
                                                            │  CASE-12345  │
                                                            └──────────────┘
```

### Why This Architecture Matters

| Without Temporal | With Temporal |
|------------------|---------------|
| Activity 2 fails → re-run Activity 1 (wasted API cost) | Activity 2 fails → only retry Activity 2 |
| Process crash → start over | Process crash → resume from checkpoint |
| No visibility into AI decisions | Full audit trail in Event History |
| Manual try/catch everywhere | Automatic retries with backoff |
| High-risk tickets auto-processed | Signals enable human-in-the-loop approval |

---

## Run the Pre-Temporal Baseline

### Prerequisites

1. **Get OpenAI API Key**:
   - Sign up at https://platform.openai.com
   - Create an API key

2. **Set environment variable**:
   ```bash
   export OPENAI_API_KEY=sk-your-key-here
   ```

3. **Run the baseline**:
   ```bash
   cd exercise-06-support-triage
   mvn compile exec:java
   ```

Watch what happens when either LLM agent fails (network issues, rate limits, etc.). The entire triage workflow fails - no retries, no recovery. If PII scrubbing succeeds but classification fails, you've wasted the first API call.

Expected output shows:
- PII scrubbing agent processing tickets
- Classification agent analyzing scrubbed text
- Occasional API failures (network timeouts, rate limits)
- Complete workflow failure when any agent fails

**Problems you'll observe:**
1. No retry logic - transient API failures cause permanent failures
2. No durability - process crash would lose all progress
3. No visibility - can't see what agent failed or why
4. Manual error handling - try/catch everywhere
5. Wasted API costs - must re-run BOTH agents if one fails
6. No human approval - high-risk tickets auto-processed
7. No audit trail - can't review AI decisions

## Your Task

Convert this multi-agent AI orchestration into a durable Temporal workflow with automatic retry handling and human-in-the-loop approval for high-risk tickets.

## Breaking Down the Problem

### Think About Activities vs Workflow

**Question:** Which operations in this code are non-deterministic (could produce different results or fail unpredictably)?

Look at the two main AI operations:
- `scrubPII(String ticketText)` - Calls OpenAI GPT-4 API (external service)
- `classifyTicket(String scrubbedText)` - Calls OpenAI GPT-4 API (external service)

**Question:** Why separate these into two activities instead of one combined activity?

Think about what should happen if classification fails but PII scrubbing succeeded. Should you:
- Re-run BOTH agents and pay for scrubbing again? (wasteful, expensive)
- Reuse the scrubbed text and retry just classification? (correct!)

This is why we need **two separate activities** - each can be retried independently, saving API costs and time.

### Multi-Agent AI Architecture

**Why Two Agents?**

1. **Independent Retry** - If classification fails, don't re-scrub PII
2. **Cost Efficiency** - Only pay for what fails
3. **Audit Trail** - See exactly which agent made which decision
4. **Separation of Concerns** - Each agent has a single responsibility

**Agent Responsibilities:**
- **PII Scrubber**: Security-focused, removes sensitive data
- **Classifier**: Business-focused, determines routing and urgency

### Pattern Recognition from Previous Exercises

If you completed Exercises 01-02, you learned about:
- The three-layer activity pattern (interface → implementation → business logic)
- Interface-based workflow design
- Activity stubs and retry configuration
- Worker and client setup

**Exercise 06 follows the same patterns**, but adds:
- Real external LLM API calls (not simulated)
- Multi-agent coordination (passing state between AI agents)
- Human-in-the-loop approval (new signal pattern!)

### Key Concepts to Apply

#### 1. Separating Non-Deterministic AI Operations

[Strategy.md](solution/STRATEGY.md) has steps you might want to consider following.

**Workflow code** must be deterministic:
- Same inputs always produce same outputs
- No calling external APIs directly
- No `System.currentTimeMillis()` or `new Random()` in workflow
- Use `Workflow.currentTimeMillis()` or `Workflow.newRandom()` instead

**Activity code** can be non-deterministic:
- Call external LLM APIs (OpenAI, Anthropic, etc.)
- Network operations with unpredictable latency
- API failures and retries

**Question:** Where does the routing decision belong - workflow or activity?

The routing logic (`if confidence < 0.7 || urgency == "critical"`) is **deterministic** - given the same classification, it always makes the same decision. This belongs in the **workflow**, not an activity!

#### 2. State Passing Between AI Agents

The workflow orchestrates the flow of data between agents:
```
Activity 1 (PII Scrubber) → returns scrubbed text
                         ↓
Activity 2 (Classifier) → takes scrubbed text, returns classification
                         ↓
Workflow Logic → makes routing decision (needs human review?)
```

The workflow stores no state itself - it just coordinates. Data flows through as parameters.

#### 3. Retry Policies for LLM APIs

LLM APIs have specific failure characteristics:
- **Rate limits** - Temporary (429 errors), need exponential backoff
- **Timeouts** - Network issues, transient
- **500 errors** - Server overload, temporary

Configure aggressive retry policies for LLM activities:
```java
RetryOptions.newBuilder()
    .setMaximumAttempts(5)              // More attempts than normal
    .setInitialInterval(Duration.ofSeconds(2))    // Start with 2s delay
    .setMaximumInterval(Duration.ofSeconds(60))   // Cap at 60s
    .setBackoffCoefficient(2.0)         // Exponential backoff
    .build()
```

#### 4. Human-in-the-Loop with Signals

**New Pattern**: Temporal Signals enable workflows to pause and wait for external input.

**Use case**: High-risk tickets need human approval before creating CRM case.

**How it works**:
1. Workflow executes PII scrubbing
2. Workflow executes classification
3. Workflow checks: `if (needsHumanReview) { wait for signal }`
4. External system sends signal: `workflow.approveTicket()`
5. Workflow resumes and creates CRM case

---

## Understanding Signals (NEW CONCEPT)

**What is a Signal?**

A signal is a way for external code to send data INTO a running workflow. Think of it as a message delivery mechanism:
- **Workflow** = recipient waiting for mail
- **Signal** = mailbox where messages arrive
- **External code** = sender dropping off mail

**Why Use Signals?**

Signals enable workflows to pause and wait for external events:
- Human approval/rejection
- External system notifications
- User input or decisions
- Real-time updates from other systems

**Key Characteristics:**
- **Asynchronous**: Sending a signal doesn't block the sender
- **Durable**: Signals are persisted by Temporal
- **Fire-and-forget**: You can send signals even if workflow hasn't reached the await yet
- **Ordered**: Signals are processed in the order received

---

### Signal Implementation: Complete Pattern

#### Step 1: Define the Signal Method in Your Workflow Interface

```java
@WorkflowInterface
public interface SupportTriageWorkflow {
    @WorkflowMethod
    TriageResult triageTicket(String ticketId, String ticketText);

    @SignalMethod
    void approveTicket(boolean approved);  // Signal can pass data
}
```

**Key Points:**
- `@SignalMethod` annotation marks this as a signal receiver
- Signal methods must return `void` (they don't return values to sender)
- Signal methods can take parameters (data from sender)
- You can have multiple signal methods in one workflow

#### Step 2: Track Signal State in Your Workflow Implementation

**CRITICAL**: You need workflow state to track whether signal was received!

```java
public class SupportTriageWorkflowImpl implements SupportTriageWorkflow {
    // State fields to track signal
    private boolean approvalReceived = false;  // Has signal arrived?
    private boolean approved = false;           // What was the decision?

    @Override
    public TriageResult triageTicket(String ticketId, String ticketText) {
        // ... PII scrubbing and classification ...

            Workflow.getLogger(SupportTriageWorkflowImpl.class)
                .info("Ticket needs human review. Waiting for approval signal...");

            // Wait for signal with timeout
            boolean signalReceived = Workflow.await(
                Duration.ofHours(24),           // Timeout after 24 hours
                () -> approvalReceived          // Condition to check
            );

            if (!signalReceived) {
                // Timeout - no human responded
                return new TriageResult(false, ticketId, null, null,
                    "Timeout: No approval received within 24 hours", false);
            }

            if (!approved) {
                // Human rejected the ticket
                return new TriageResult(false, ticketId, null, null,
                    "Rejected by human reviewer", false);
            }

            Workflow.getLogger(SupportTriageWorkflowImpl.class)
                .info("Ticket approved by human reviewer");
        }

        // Continue with CRM case creation
        String caseId = "CASE-" + Workflow.currentTimeMillis();
        // ... rest of logic ...

    @Override
    public void approveTicket(boolean approved) {
        // This method is called when signal is received
        this.approved = approved;           // Store the decision
        this.approvalReceived = true;       // Mark that signal arrived

        Workflow.getLogger(SupportTriageWorkflowImpl.class)
            .info("Approval signal received: " + approved);
    }
}
```

**Common Mistakes:**
- ❌ Forgetting state fields (`approvalReceived`, `approved`)
- ❌ Not setting `approvalReceived = true` in signal handler
- ❌ Using `Workflow.await()` without timeout (workflow waits forever!)
- ❌ Returning values from signal methods (signals are void)

#### Step 3: Send Signal from Client Code

**Pattern 4: Send signal via Temporal CLI** ⭐ **EASIEST FOR TESTING**
```bash
# Find your workflow ID first (check worker/client output or Temporal UI)
# List workflows filtered by task queue
temporal workflow list --query 'TaskQueue="support-triage"'

# Approve the ticket
temporal workflow signal \
  --workflow-id support-triage-abc123 \
  --name approveTicket \
  --input true

# Reject the ticket
temporal workflow signal \
  --workflow-id support-triage-abc123 \
  --name approveTicket \
  --input false
```

**Tips for CLI usage:**
- Signal name matches the method name in your `@SignalMethod` (e.g., `approveTicket`)
- Input is JSON format - for boolean, just use `true` or `false`
- For complex objects, use JSON: `--input '{"fieldName": "value"}'`
- You can find workflow IDs in the Temporal UI or from your client output

**Finding workflow IDs:**
```bash
# List all running workflows
temporal workflow list

# List workflows filtered by task queue
temporal workflow list --query 'TaskQueue="support-triage"'

# Show details of a specific workflow (includes current state)
temporal workflow describe --workflow-id support-triage-abc123
```

---

### Signal Timing: When Does the Signal Arrive?

**Important**: Signals can arrive BEFORE the workflow reaches `Workflow.await()`!

**Important**: Signal must arrive before the workflow finishes!

**Scenario 1: Signal arrives early**
```
Time 0: Workflow starts
Time 1: Signal sent (approveTicket called)
Time 2: Workflow reaches Workflow.await()
Result: await() immediately returns true (signal already received)
```

**Scenario 2: Signal arrives during wait**
```
Time 0: Workflow starts
Time 1: Workflow reaches Workflow.await() and pauses
Time 2: Signal sent (approveTicket called)
Result: await() wakes up and returns true
```

**Scenario 3: Timeout**
```
Time 0: Workflow starts
Time 1: Workflow reaches Workflow.await(Duration.ofHours(24), ...)
Time 2-24h: No signal received
Time 24h: await() returns false (timeout)
```

**This is why we use state fields** (`approvalReceived`) - they persist the signal data!

---

### Debugging Signals

**How to check if signal was received:**

1. **Temporal UI** (http://localhost:8233)
   - Open your workflow execution
   - Look for `WorkflowSignaled` event in Event History
   - See signal name and payload

2. **Workflow logs**
   ```java
   Workflow.getLogger(SupportTriageWorkflowImpl.class)
       .info("Waiting for signal...");
   ```

3. **Client-side logging**
   ```java
   System.out.println("Sending approval signal to workflow: " + workflowId);
   workflow.approveTicket(true);
   System.out.println("Signal sent successfully");
   ```

---

### Testing Your Signal Implementation

**Test 1: Happy Path with Approval** ⭐ **Try this with CLI!**
```bash
# Terminal 1: Start your worker
mvn compile exec:java@worker

# Terminal 2: Start workflow with your client
mvn compile exec:java@workflow

# Terminal 3: Send approval signal (copy workflow ID from Terminal 2 output)
temporal workflow signal \
  --workflow-id support-triage-<YOUR-ID> \
  --name approveTicket \
  --input true
```

Alternatively, in Java code:
```java
// Start workflow with high-risk ticket
WorkflowClient.start(workflow::triageTicket, "TKT-001", "URGENT: System down!");

// Wait a bit
Thread.sleep(2000);

// Send approval
workflow.approveTicket(true);

// Workflow should complete successfully
```

**Test 2: Rejection via CLI**
```bash
# After starting workflow in Terminal 2, send rejection:
temporal workflow signal \
  --workflow-id support-triage-<YOUR-ID> \
  --name approveTicket \
  --input false
```

Or in Java:
```java
WorkflowClient.start(workflow::triageTicket, "TKT-002", "Low priority issue");
Thread.sleep(2000);
workflow.approveTicket(false);  // Reject
// Workflow should return failure result
```

**Test 3: Timeout**
```java
// Start workflow with short timeout
// In workflow: Workflow.await(Duration.ofSeconds(5), ...)
WorkflowClient.start(workflow::triageTicket, "TKT-003", "Test timeout");
// Don't send signal
Thread.sleep(10000);  // Wait past timeout
// Workflow should timeout and handle it gracefully
```

**Test 4: Signal Before Await**
```bash
# Start workflow and IMMEDIATELY send signal (before it reaches await)
# Terminal 2: Start workflow
mvn compile exec:java -Dexec.mainClass="solution.temporal.Starter"

# Terminal 3: Send signal RIGHT AWAY (don't wait)
temporal workflow signal \
  --workflow-id support-triage-<YOUR-ID> \
  --name approveTicket \
  --input true
# Workflow should still receive it when it reaches await!
```

This is a **powerful pattern** for compliance, risk management, and complex approvals!

#### 5. Type Serialization

Temporal serializes workflow inputs/outputs to JSON. Keep it simple:

**Works:**
- String, int, long, boolean, double
- Simple POJOs with empty constructors
- Lists, arrays

**Question:** What data structure should your workflow return?
- Just a boolean (success/failure)?
- A result object with classification, case ID, and review status?

Recommended: Use a POJO like `TriageResult` with all relevant data for observability.

## What to Observe When Testing

After implementing your Temporal version:

1. **Automatic Retries:**
   - Run your worker and client
   - If OpenAI API fails (rate limit, timeout), watch Temporal retry automatically
   - PII scrubbing is NOT re-run if only classification fails
   - Check worker logs to see retry attempts

2. **Temporal UI:**
   - Open http://localhost:8233
   - Find your workflow execution
   - See both activities in the timeline
   - Look at Event History - see retry attempts
   - Notice how scrubbed text is passed from Activity 1 to Activity 2

3. **Durability:**
   - Start a workflow execution
   - Kill the worker process (Ctrl+C) mid-execution
   - Restart the worker
   - Watch the workflow resume from last completed activity
   - No data lost, no API calls re-run unnecessarily

4. **Human-in-the-Loop:**
   - Run a high-risk ticket (low confidence or critical urgency)
   - Workflow pauses waiting for signal
   - Send approval signal from client
   - Workflow resumes and completes

5. **Cost Efficiency:**
   - Failed classification doesn't re-run PII scrubbing
   - Each agent call is tracked independently
   - Full audit trail of which agent made which decision

## OpenAI API Setup

### Get API Key

1. Go to https://platform.openai.com
2. Sign up or log in
3. Navigate to API Keys section
4. Create new secret key
5. Copy the key (starts with `sk-`)

### Set Environment Variable

```bash
# macOS/Linux
export OPENAI_API_KEY=sk-your-key-here

# Windows
set OPENAI_API_KEY=sk-your-key-here
```

### Cost Estimates

- GPT-4 input: ~$0.03 per 1K tokens
- GPT-4 output: ~$0.06 per 1K tokens
- Typical ticket: 100-200 tokens input, 50-100 tokens output
- **Per ticket cost**: ~$0.02-0.05 (2 API calls)
- **5 test tickets**: ~$0.10-0.25

This is a learning exercise - total cost should be under $1 for all testing.

## Success Criteria

- Both activities execute sequentially
- Workflows complete successfully (check Temporal UI at http://localhost:8233)
- Automatic retries handle OpenAI API failures
- PII scrubbing not re-run when only classification fails
- No manual retry logic in your code
- High-risk tickets pause for signal (human approval)
- Can complete the exercise in **under 60 minutes** (first time)

## Mental Model Shift

**Before Temporal:**
> "If classification fails, everything fails. Must re-run PII scrubbing too. Wasted $0.02 API call. Can't review high-risk tickets - they auto-process. If process crashes, start from scratch."

**After Temporal:**
> "PII scrubbed once. If classification fails, Temporal retries just that step. No wasted API calls. High-risk tickets pause for human approval via signals. If process crashes, workflow resumes from last completed activity. Complete AI decision audit trail in Temporal UI."

## Common Pitfalls

1. **Forgetting to set OPENAI_API_KEY**
   - Error: `NullPointerException` or `401 Unauthorized`
   - Solution: `export OPENAI_API_KEY=sk-...`

2. **Not handling JSON parsing from OpenAI responses**
   - OpenAI returns structured text, not always valid JSON
   - Use simple text parsing (like in baseline) or robust JSON parsing

3. **Putting routing logic in activities instead of workflow**
   - ❌ Activity that calls LLM AND makes routing decision
   - ✅ Activity returns classification, workflow makes routing decision
   - Why? Workflow logic is deterministic and should live in workflow

4. **Using non-deterministic functions in workflow code**
   - ❌ `System.currentTimeMillis()` in workflow
   - ✅ `Workflow.currentTimeMillis()` in workflow

5. **Not configuring retry policies**
   - Activities won't retry without explicit `RetryOptions`
   - LLM APIs need aggressive retries (rate limits are common)

6. **Forgetting empty constructors in POJOs**
   - Temporal needs them for deserialization
   - Add `public ClassName() {}` to all data classes

7. **Mismatched task queue names**
   - Worker and client must use same task queue
   - Pick one name (e.g., "support-triage") and use consistently

8. **Signal timeout handling**
   - What if human never approves? Workflow waits forever
   - Use `Workflow.await(Duration, condition)` with timeout
   - Example: `Workflow.await(Duration.ofHours(24), () -> approvalReceived)`

## Implementation Path

You'll need to create several components:

### Domain Models
- `TicketClassification` - Result from classification agent (category, urgency, confidence, reasoning)
- `TriageResult` - Final workflow result (success, classification, caseId, needsHumanReview)

### Activities (Interface + Implementation)
1. **PIIScrubberActivity**
   - Interface: `String scrubPII(String ticketText);`
   - Implementation: Calls OpenAI GPT-4 with PII scrubbing prompt

2. **ClassificationActivity**
   - Interface: `TicketClassification classifyTicket(String scrubbedText);`
   - Implementation: Calls OpenAI GPT-4 with classification prompt

### Workflow (Interface + Implementation)
- Interface: Define workflow method and signal method
- Implementation:
  - Execute PII scrubbing activity
  - Execute classification activity
  - Make routing decision (deterministic)
  - Wait for signal if high-risk
  - Create CRM case (log/print)

### Worker
- Register workflow implementation
- Register activity implementations
- Connect to Temporal server

### Client/Starter
- Create workflow stub
- Execute workflow with sample tickets
- (Optional) Send approval signals

**Hint:** Look at Exercise 02's structure. The patterns are identical, just with OpenAI API calls instead of email simulation.

## Code Snippet Examples

### Activity Interface Pattern

```java
@ActivityInterface
public interface PIIScrubberActivity {
    @ActivityMethod
    String scrubPII(String ticketText);
}
```

### Activity Options with Aggressive Retries for LLMs

```java
ActivityOptions options = ActivityOptions.newBuilder()
    .setStartToCloseTimeout(Duration.ofMinutes(2))
    .setRetryOptions(RetryOptions.newBuilder()
        .setMaximumAttempts(5)
        .setInitialInterval(Duration.ofSeconds(2))
        .setMaximumInterval(Duration.ofSeconds(60))
        .setBackoffCoefficient(2.0)
        .build())
    .build();
```

### Creating Activity Stub in Workflow

```java
private final PIIScrubberActivity piiScrubber =
    Workflow.newActivityStub(PIIScrubberActivity.class, options);
```

### Signal Quick Reference

**See "Understanding Signals (NEW CONCEPT)" section above for complete tutorial!**

**Define Signal in Interface:**
```java
@WorkflowInterface
public interface SupportTriageWorkflow {
    @WorkflowMethod
    TriageResult triageTicket(String ticketId, String ticketText);

    @SignalMethod
    void approveTicket(boolean approved);  // Must return void
}
```

**Track State in Workflow Implementation:**
```java
public class SupportTriageWorkflowImpl implements SupportTriageWorkflow {
    private boolean approvalReceived = false;  // CRITICAL: Track if signal arrived
    private boolean approved = false;

    @Override
    public void approveTicket(boolean approved) {
        this.approved = approved;
        this.approvalReceived = true;  // Don't forget this!
    }
}
```

**Wait for Signal with Timeout:**
```java
// In workflow method
boolean signalReceived = Workflow.await(
    Duration.ofHours(24),           // Timeout
    () -> approvalReceived          // Condition
);

if (!signalReceived) {
    // Handle timeout
    return new TriageResult(false, "Timeout waiting for approval");
}
```

**Send Signal from Client:**
```java
// Get workflow stub by ID
SupportTriageWorkflow workflow = client.newWorkflowStub(
    SupportTriageWorkflow.class,
    workflowId
);

// Send approval signal (non-blocking)
workflow.approveTicket(true);
```

These are patterns, not complete implementations. Discover the full structure by applying these concepts!

## Real-World Applications

This pattern applies to many Temporal customer use cases:

1. **Content Moderation** - AI screening → human review for edge cases
2. **Document Processing** - AI extraction → human verification
3. **Fraud Detection** - AI risk scoring → analyst approval for high-risk
4. **Resume Screening** - AI filtering → recruiter review for qualified candidates
5. **Medical Diagnosis** - AI analysis → doctor approval before treatment
6. **Financial Trading** - AI strategy → compliance approval for large trades

**Common Thread**: Multi-agent AI orchestration with human-in-the-loop approval for high-risk decisions.

## What's Next?

After completing this exercise, you'll understand:
- How to orchestrate multiple LLM agents with Temporal
- Cost-efficient retry strategies (only retry what failed)
- Human-in-the-loop approval patterns with signals
- Full audit trail of AI decisions for compliance
- Durable AI workflows that survive crashes

**Exercise #7** could introduce:
- Parallel AI agent execution (fan-out/fan-in)
- Dynamic workflows (variable number of AI agents)
- Continue-as-new for long-running AI pipelines

But now you have the foundation for **production-grade AI orchestration**!

---

**Status**: Complete ✅
**Language**: Java
**Concepts**: Multi-agent AI, LLM orchestration, human-in-the-loop, signals, retry policies, cost efficiency
**Difficulty**: Medium-Advanced (3/5)
**Estimated Time**: ~60 minutes
**Prerequisites**: Exercises 01-02, OpenAI API key
