# AGENTS.md

This file provides guidance to LLMs when working with code in this repository.

## Repository Overview

This is a progressive collection of hands-on exercises for building proficiency with Temporal workflow orchestration. Each exercise converts procedural code into durable Temporal workflows with proper activity separation, retry policies, and error handling across Python, Java, Go, and TypeScript.

**Goal:** Complete each exercise, building speed and confidence over time.

Critical - The AI assistant's goal is to teach, create metaphors, give tips and tricks, and help the engineer reason through Temporal concepts.
The assistant should not write the Temporal solution code for the learner.
This is the exercise for the engineer: the assistant guides, the engineer codes the new Temporal concepts.

Critical - exercises should not spend student time on generic application logic.
Business/domain logic should be ready to run in the exercise starter: services, fake databases, model transformations, API adapters, payment/email/LLM stubs, and other non-Temporal plumbing should already exist.
The student should implement only the Temporal portions: workflow/activity boundaries, workflow orchestration, activity stubs/proxies, retry policies, signals, queries, timers, child workflows, compensation, worker registration, clients/starters, and other Temporal SDK concepts.
When writing READMEs, make this explicit: "application logic is provided; your job is to make it durable with Temporal."

All Temporal concepts should be explained to a year one college student persona.

## Prerequisites

**Temporal Server:**

```bash
temporal server start-dev
```

**Language Requirements:**

- Python: 3.9-3.10 (NOT 3.14 - has compatibility issues with Temporal SDK)
- Java: JDK 11+, Maven
- Go: 1.21+
- TypeScript: Node.js 18+

## Common Commands

### Python Exercises

**Install dependencies:**

```bash
cd exercise-XX-name/
pip install -r requirements.txt
```

**Run worker (Terminal 1):**

```bash
python worker.py
```

**Run client (Terminal 2):**

```bash
python client.py
```

**View Temporal UI:**

```
http://localhost:8233
```

### Java Exercises

**Build and run (from exercise directory):**

```bash
mvn compile exec:java
```

## Repository Structure

```
temporal-warmups/
├── exercise-01-registration/    # Basic workflow + activities + retries
├── exercise-02-email/           # Muscle memory building
├── exercise-02-orders/          # Multiple activities, external state
├── exercise-03-hotel/           # Messy code refactoring, fallback patterns
├── exercise-04-registration-java/  # Java implementation
├── exercise-05-booking/         # Saga/compensation patterns
├── exercise-06-support-triage/   # Multi-agent AI, Signals, Human-in-the-loop
├── exercise-06a-parallel-tickets/ # Parallel workflow execution, Business ID patterns
├── exercise-07-saga/             # TypeScript saga + signals exercise
└── temporal-warmups-curriculum.md  # Full curriculum with learning objectives
```

Each exercise contains:

- `README.md` or `exercise-XX-README.md` - Exercise goals and instructions
- Original code without Temporal which needs to be "temporalized"
- Language-specific implementation folder (`python/`, `java/`, `go/`, `typescript/`)
- .svg diagrams to show workflow and different concepts (similar to exercise-1300)
- interactive .html diagram to visually convey data flows, nexus boundaries, data mutation (similar to exercise-1301)
- cool and interesting interactive diagrams embedded in the README to help the student learn
- Step-by-step guidance, acronyms similar to exercise 1300, metaphors, humor
- The poor implementation is located in /exercise folder along with skeleton of Temporal classes. The /solution folder contains the full solution to the exercise.
- We begin each exercise by executing code and understanding the problem through a running app. Show something running as fast as possible.
- Every small lesson contains a checkpoint to run code and test new implementation.
- Every few exercises we also have small quizzes for people to try.
- Every exercise also has some humor and interesting analogies.

## Key Architectural Patterns

### Workflow vs Activity Decision Framework

**Workflow logic (deterministic):**

- Pure calculations (no I/O)
- Conditional logic based on inputs
- Data transformations
- Input validation

**Activity logic (non-deterministic):**

- Database reads/writes
- API calls to external services
- File I/O
- Email/SMS sending
- Anything using `time`, `random`, `datetime.now()`
- Anything that can fail due to external factors

### Standard Exercise Pattern

**Python:**

```python
# workflow.py
from temporalio import workflow
from datetime import timedelta

@workflow.defn
class MyWorkflow:
    @workflow.run
    async def run(self, input_data):
        # Workflow orchestration logic
        result = await workflow.execute_activity(
            my_activity,
            args=[input_data],
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=DEFAULT_RETRY_POLICY,
        )
        return result

# activities.py
from temporalio import activity

@activity.defn
async def my_activity(input_data):
    # Non-deterministic operations
    # Database calls, API calls, etc.
    return result

# worker.py
worker = Worker(
    client,
    task_queue="my-task-queue",
    workflows=[MyWorkflow],
    activities=[my_activity],
)
```

## Critical Type Serialization Constraints

Temporal's default JSON converter has limitations:

**Works out of the box:**

- Strings, integers, floats, booleans
- Lists, dicts
- Dataclasses (if all fields are serializable)

**Does NOT work (use simple types instead):**

- ❌ Enums → Use `str` instead
- ❌ `datetime`/`date` objects → Use `str` in ISO 8601 format (YYYY-MM-DD)
- ❌ `Decimal` types → Use `float` instead
- ❌ Custom classes → Use dataclasses with serializable fields

**Example:**

```python
# ❌ Don't use
room_type: RoomType  # Enum
check_in: datetime
price: Decimal

# ✅ Use instead
room_type: str  # "standard", "deluxe"
check_in: str   # "2024-12-20"
price: float    # 99.99
```

## Common Pitfalls & Debugging

### Python-Specific Issues

1. **Non-deterministic imports in workflow.py**
   - ❌ `import time` in workflow file
   - ✅ Wrap activity imports: `from temporalio.workflow import unsafe` and use `unsafe.imports_passed_through()`

2. **Missing `await` on activity calls**
   - Always use `await workflow.execute_activity(...)`

3. **Type serialization errors**
   - `TypeError: Object of type RoomType is not JSON serializable` → Use `str` instead of Enum
   - `ValueError: Invalid isoformat string: '2025-7-12'` → Use zero-padded dates: `'2025-07-12'`

4. **Logger usage**
   - ❌ `activity.logger()` (calling as function)
   - ✅ `activity.logger.info()` (calling method)

5. **UUID generation**
   - In client code: Use `uuid.uuid4()`
   - In workflow code: Use `workflow.uuid4()`

6. **Cached imports issue**
   - Delete `__pycache__/` when debugging cryptic errors
   - Temporal's sandbox can cache old, broken code

7. **Python version compatibility**
   - Use Python 3.9-3.10
   - Python 3.14 has compatibility issues with Temporal SDK

### Java-Specific Patterns

- Interface-based design for workflows and activities
- Use Activity stubs for type-safe activity invocation
- Builder patterns for retry policies and timeouts
- Dependencies via Maven (pom.xml)
- Using System.out.println(...) directly in Workflow code is discouraged.
  Temporal Workflows can be replayed many times, and any side effects (like printing to stdout) will be repeated on every replay. This leads to duplicated and misleading logs. Instead, you should use the Java SDK’s replay-safe Workflow logger

#### Parallel Workflow Execution (Java)

Start multiple workflows concurrently using `WorkflowClient.execute()`:

```java
List<CompletableFuture<Result>> futures = new ArrayList<>();
for (Item item : items) {
    MyWorkflow workflow = client.newWorkflowStub(MyWorkflow.class, options);
    // Returns immediately - workflow runs in background
    CompletableFuture<Result> future = WorkflowClient.execute(workflow::process, item);
    futures.add(future);
}
// Wait for all to complete
CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
```

**Key Methods:**

- `WorkflowClient.start()` - Fire and forget, returns `WorkflowExecution`
- `WorkflowClient.execute()` - Returns `CompletableFuture<R>` for result

#### Business Identifier Workflow IDs

Use meaningful workflow IDs based on business entities:

```java
// Instead of: TASK_QUEUE + "-" + UUID.randomUUID()
// Use:        "{type}-{business-id}"
String workflowId = "triage-" + ticketId;   // e.g., "triage-TKT-001"
String workflowId = "order-" + orderId;     // e.g., "order-ORD-12345"
String workflowId = "payment-" + paymentId; // e.g., "payment-PAY-98765"
```

**Benefits:**

- Find workflows easily in Temporal UI by business entity
- Idempotent: same business ID = same workflow ID (prevents duplicates)
- Meaningful for logging, debugging, and operations

## Progression Path

**Week 1-2 (Fundamentals):**

- Exercise #1 (Registration) - Basic workflow/activity pattern
- Exercise #2.5 (Email) - Muscle memory
- Exercise #2 (Orders) - Multiple activities, debugging

**Week 3-4 (Real-World Patterns):**

- Exercise #3 (Hotel) - Messy code refactoring, fallback patterns
- Exercise #5 (Booking) - Saga/compensation patterns
- Exercise #6 (Support Triage) - **Signals (first introduction!)**, human-in-the-loop, multi-agent AI

**Week 5+ (Advanced):**

- Exercise #6a (Parallel Tickets) - **Parallel workflow execution**, Business identifier workflow IDs
- Queries (read workflow state)
- Parent-child workflows
- Workflow versioning
- Continue-as-new
- Performance tuning

## Important Notes

- **Fallback vs Compensation:**
  - Fallback: Try alternative methods for same goal (email → SMS → manual)
  - Compensation: Rollback previous business steps (refund payment, release inventory)

- **External State Management:**
  - Database state is external to workflows
  - Activities interact with databases, not workflows
  - Workflows coordinate but don't hold persistent state

- **Retry Policies:**
  - Configure on activity execution, not in activity code
  - Let Temporal handle retries automatically
  - Don't implement manual retry logic

- **Determinism:**
  - Workflow code must be deterministic (same inputs → same outputs)
  - Never use `time.time()`, `random.random()`, `datetime.now()` in workflows
  - Use `workflow.now()`, `workflow.uuid4()` instead

- **Signals (Introduced in Exercise #6):**
  - Signals allow external code to send data INTO a running workflow
  - Use signals for human approvals, external notifications, or real-time updates
  - Signal methods must return `void` in Java (`None` in Python)
  - Always use `Workflow.await()` with a timeout to avoid infinite waits
  - Track signal state with workflow instance fields (e.g., `approvalReceived = false`)
  - Signals are durable - Temporal persists them even if workflow hasn't reached the await yet

## Testing & Development

1. Start Temporal server first
2. Run worker in one terminal (keeps running)
3. Run client in another terminal (executes once)
4. Check Temporal UI at http://localhost:8233 to see workflows
5. Kill worker mid-execution to observe durability/recovery

## Exericse Readme structure

- File Structure section is not valuable

## Resources

- Full curriculum: `temporal-warmups-curriculum.md`
- Exercise-specific instructions: Each exercise has its own README
- Temporal Documentation: https://docs.temporal.io
- Python SDK: https://docs.temporal.io/dev-guide/python
- Java SDK: https://docs.temporal.io/dev-guide/java

## Call To Action

Every README should have the following CTA added after the ## Scenario

## Quickstart Docs By Temporal

🚀 [Get started in a few mins](https://docs.temporal.io/quickstarts?utm_campaign=awareness-nikolay-advolodkin&utm_medium=code&utm_source=github)
