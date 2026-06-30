# Temporal Warmups - Learning Curriculum (Updated)

## Overview

A progressive series of hands-on exercises designed to build expertise with Temporal workflow orchestration through daily practice. Each exercise focuses on converting ordinary procedural code into durable Temporal workflows with proper activity separation, retry policies, and error handling.

**Goal:** Complete each exercise in approximately 1 hour, building speed and confidence over time across Python, Java, Go, and TypeScript.

**Brand Color:** `#AEB6D9` (Temporal's primary brand color)

---

## Exercise Design Contract

Each warmup should teach Temporal, not ask the student to rebuild ordinary product code.

Provide the application logic up front: fake databases, API adapters, email/payment/LLM stubs, domain models, calculations, and any noisy business plumbing should already run before the student starts the Temporal portion.

Leave TODOs for Temporal concepts only:
- workflow and activity boundaries
- activity stubs/proxies and options
- retry policies and timeouts
- workflow orchestration and deterministic state
- signals, queries, timers, child workflows, Nexus calls, and continue-as-new
- saga compensation and recovery behavior
- worker registration and starter/client code when those are the lesson

README language should make the contract explicit: **application logic is provided; your job is to make it durable with Temporal.**

---

## Common Type Serialization Issues (Exercises #1-4)

**CRITICAL:** Temporal's default JSON converter has limitations that affect all beginner exercises.

### What Works Out of the Box:
- ✅ Strings, integers, floats, booleans
- ✅ Lists, dicts
- ✅ Dataclasses (if all fields are serializable types)

### What DOES NOT Work:
- ❌ Enums (use `str` instead)
- ❌ datetime/date objects (use `str` in ISO 8601 format)
- ❌ Decimal types (use `float` instead)
- ❌ Custom classes (unless dataclass with serializable fields)

### Week 1-4 Strategy: Keep It Simple
```python
# ❌ Don't use in dataclasses
room_type: RoomType  # Enum
check_in: datetime   # datetime object
price: Decimal       # Decimal type

# ✅ Use simple types instead
room_type: str       # "standard", "deluxe", "suite"
check_in: str        # "2024-12-20" (ISO 8601: YYYY-MM-DD)
price: float         # 99.99
```

### Week 5+ Topic: Custom Data Converters
Once you master the basics, learn to build custom converters for Enums, Decimals, and complex types.

---

## Activity vs Workflow Logic - Decision Framework

When analyzing code for conversion to Temporal, use this framework:

### Should This Be WORKFLOW Logic?
- ✅ Pure calculations (no I/O)
- ✅ Conditional logic based on inputs
- ✅ Data transformations
- ✅ Input validation
- ❌ NO external system calls
- ❌ NO randomness or time-based operations

### Should This Be an ACTIVITY?
- ✅ Database reads/writes
- ✅ API calls to external services
- ✅ File I/O
- ✅ Email/SMS sending
- ✅ Anything with `time`, `random`, `datetime.now()`
- ✅ Anything that can fail due to external factors

### Examples from Exercise #3:

| Code | Location | Why? |
|------|----------|------|
| `nights = (check_out - check_in).days` | Workflow | Pure calculation from inputs |
| `total = base_price * nights` | Workflow | Deterministic arithmetic |
| `if nights >= 7: total *= 0.9` | Workflow | Deterministic conditional |
| `if not email or '@' not in email` | Workflow | Input validation |
| `check_room_availability()` | Activity | Reads external inventory system |
| `process_payment()` | Activity | Calls external payment gateway |
| `send_email()` | Activity | External email service (can fail) |

**Rule of thumb:** If you can write it as a pure function with no side effects, it belongs in the workflow.

---

## Week 1-2: Fundamentals

Focus on learning the basic workflow → activity pattern across multiple languages. Clean starting code, straightforward scenarios, emphasis on getting the pattern down.

### Exercise #1: User Registration ⭐⭐
**Language:** Python  
**Time:** ~1 hour  
**Concepts:** Basic workflow, activities, retries

**Scenario:** Simple 4-step user registration flow (validate, create user, send welcome email, send verification email).

**Learning Goals:**
- Separate workflow orchestration from activities
- Implement retry policies
- See automatic failure recovery
- Understand durability (workflow survives worker restarts)

**Key Takeaways:**
- Workflow vs Activity boundaries
- Deterministic vs non-deterministic code
- External state management (database)
- Basic retry policies

**Status:** ✅ Complete

---

### Exercise #2: Order Processing ⭐⭐⭐
**Language:** Python  
**Time:** ~3 hours (includes debugging)  
**Concepts:** Multiple activities, external state, debugging

**Scenario:** E-commerce order processing (validate, calculate total, process payment, reserve inventory, schedule shipment).

**Learning Goals:**
- Handle more complex state across multiple activities
- Remove naive retry logic and trust Temporal's retry policies
- Work with external state (inventory database, payment tracking)
- Debug complex Temporal errors systematically

**Key Takeaways:**
- Python version compatibility (3.9-3.10, NOT 3.14)
- Temporal's sandbox restrictions
- Dataclass serialization (use `float` not `Decimal`)
- `__pycache__` can cache old, broken code
- How to debug cryptic `os.stat` errors

**Common Pitfalls:**
- Non-deterministic imports in workflow.py
- Missing `await` on activity calls
- Wrong Python version
- Cached imports

**Status:** ✅ Complete

---

### Exercise #2.5: Email Verification ⭐
**Language:** Python  
**Time:** 20-45 minutes  
**Concepts:** Muscle memory, speed building

**Scenario:** Two-step email verification (generate token, send email).

**Learning Goals:**
- Build muscle memory for basic pattern
- Practice setup rhythm without debugging distractions
- Get comfortable with development loop
- Speed: Target under 30 minutes

**Key Takeaways:**
- Reinforce the basic pattern through repetition
- Build confidence and speed
- Clean, minimal exercise for practice

**Status:** ✅ Complete

---

### Exercise #3: Hotel Reservation ⭐⭐⭐
**Language:** Python  
**Time:** ~3 hours (includes business logic analysis)  
**Concepts:** Messy code refactoring, fallback patterns, architectural decisions

**Scenario:** Hotel booking with payment, room assignment, and confirmation (starting from messy 100+ line monolithic function).

**Learning Goals:**
- Refactor poorly organized code to Temporal patterns
- Make judgment calls about workflow vs activity boundaries
- Implement fallback notification patterns (email → SMS → manual)
- Understand when NOT to compensate (auxiliary failures vs business-critical)
- Handle type serialization constraints (Enum → str, datetime → str)

**Key Takeaways:**
- Breaking apart monolithic functions
- When calculations should be workflow logic vs activities
- Fallback patterns for non-critical operations
- When auxiliary failures (email) don't warrant compensation
- Type serialization: Enum/datetime don't serialize, use strings
- ISO 8601 date format requirements (zero-padded: `2024-07-12` not `2024-7-12`)

**The "Audit" Benefit:**
Converting legacy code to Temporal forces architectural clarity. You must answer:
- What's deterministic vs non-deterministic?
- What's core business logic vs external dependencies?
- Where are the failure boundaries?
- What failures are critical vs auxiliary?

This analysis adds time but provides architectural value beyond just learning Temporal.

**Common Issues:**
- `TypeError: Object of type RoomTypes is not JSON serializable` → Use `str` instead of Enum
- `ValueError: Invalid isoformat string: '2025-7-12'` → Use zero-padded dates: `'2025-07-12'`
- `TypeError: 'LoggerAdapter' object is not callable` → Use `activity.logger.info()` not `activity.logger()`
- Using `workflow.uuid4()` in client code → Use standard `uuid.uuid4()` instead

**Status:** ✅ Complete

---

### Exercise #4 (Optional): Multi-Language Rotation
**Languages:** Java or Go  
**Time:** ~1.5 hours  
**Concepts:** Same patterns, different syntax

**Scenario:** Pick Exercise #1, #2.5, or #3 and implement in Java or Go.

**Learning Goals:**
- Apply the same Temporal patterns in a different language
- Understand SDK differences
- Build cross-language fluency

**Key Differences to Learn:**
- **Java:** Interface-based design, activity stubs, builder patterns
- **Go:** Context everywhere, struct-based workflows, channels

---

## Fallback Patterns (Introduced in Exercise #3)

**Pattern:** Progressive degradation through multiple service channels

**Use Case:** Non-critical operations with multiple backup options

**Example from Exercise #3:**
```python
try:
    # Primary notification channel
    await workflow.execute_activity(send_email_notification, ...)
except ActivityError:
    # Fallback: Try SMS
    workflow.logger.warning("Email failed, trying SMS")
    try:
        await workflow.execute_activity(send_sms_notification, ...)
    except ActivityError:
        # Ultimate fallback: Manual intervention
        workflow.logger.warning("SMS failed, queuing for manual notification")
        await workflow.execute_activity(front_desk_confirmation, ...)
```

**Key Insight:** Don't fail the entire workflow for auxiliary failures. Degrade gracefully.

**Contrast with Compensation:**
- **Fallback:** Try alternative methods for same goal (notify customer via email → SMS → phone)
- **Compensation:** Rollback previous business steps (refund payment, release inventory)

**When to Use Fallback vs Compensation:**
- **Fallback:** Notification failures, optional integrations, non-critical features
- **Compensation:** Payment failures after inventory reserved, booking failures after payment processed

---

## Week 3-4: Real-World Patterns

Introduce complexity through realistic business scenarios and advanced Temporal features. Starting code becomes messier, patterns more sophisticated.

### Exercise #5: Saga/Compensation Patterns ⭐⭐⭐⭐
**Language:** Python  
**Time:** ~2 hours  
**Concepts:** Distributed transactions, rollback logic

**Scenario:** Multi-step booking flow (flight + hotel + car rental) where any step can fail after others succeed.

**Learning Goals:**
- Implement proper compensation logic
- Handle partial success scenarios
- Build saga pattern from scratch
- Understand when to compensate vs when to retry

**Key Patterns:**
- Forward recovery (retry until success)
- Backward recovery (compensate/rollback)
- Compensation ordering (reverse of execution order)
- Idempotent compensating activities

---

### Exercise #6: Parallel Execution (Fan-out/Fan-in) ⭐⭐⭐⭐
**Language:** Python  
**Time:** ~2 hours  
**Concepts:** Concurrent activities, partial failures, claim check pattern

**Scenario:** Process batch of orders simultaneously, aggregate results, handle partial failures.

**Learning Goals:**
- Execute activities in parallel
- Wait for all/any to complete
- Handle scenario where 2 of 5 parallel activities fail
- Aggregate results from concurrent execution
- **NEW:** Introduce claim check pattern for large datasets

**Key Patterns:**
- `asyncio.gather()` in Python
- `Async.function()` in Java
- `workflow.Go()` in Go
- Cancellation scopes for cleanup
- Partial success handling
- Claim check for 10,000+ record datasets

---

### Exercise #7: Signals & Queries ⭐⭐⭐
**Language:** Python  
**Time:** ~1.5 hours  
**Concepts:** Interactive workflows, external communication

**Scenario:** Long-running approval workflow that can be paused, resumed, approved, or rejected from outside.

**Learning Goals:**
- Send signals to running workflows
- Query workflow state without affecting execution
- Implement pause/resume functionality
- Handle human-in-the-loop scenarios

**Key Patterns:**
- Signal handlers
- Query methods
- Workflow state management
- External interaction patterns

---

### Exercise #8: Parent-Child Workflows ⭐⭐⭐⭐
**Language:** Python  
**Time:** ~2 hours  
**Concepts:** Workflow composition, state across boundaries

**Scenario:** Order processing parent that spawns child workflows for each item, aggregates results.

**Learning Goals:**
- Start child workflows from parent
- Pass state between parent and child
- Signal children from parent
- Handle child workflow failures
- Maintain pause/resume across workflow boundaries

**Key Patterns:**
- Child workflow execution
- Parent-child communication via signals
- State aggregation
- Cascading cancellation

---

## Week 5+: Advanced & Production Patterns

Focus on debugging, optimization, versioning, and handling complex real-world scenarios.

### Exercise #9: Code Review from Hell ⭐⭐⭐⭐⭐
**Language:** Python  
**Time:** 2-3 hours  
**Concepts:** Anti-patterns, refactoring, best practices

**Scenario:** Inherited "working" workflow with terrible practices - technically runs but violates everything.

**Bad Patterns to Identify:**
- ❌ Non-deterministic code in workflow (`time.time()`, `random.random()`)
- ❌ Database calls directly in workflow code
- ❌ No retry policies configured
- ❌ Mega-activities doing too much
- ❌ Mutable workflow state that doesn't persist
- ❌ Using `time.sleep()` instead of `workflow.sleep()`
- ❌ No error handling
- ❌ Excessive activity timeouts (1 hour!)
- ❌ Non-idempotent workflow IDs
- ❌ Wrong imports at workflow level
- ❌ Using `datetime.now()` instead of `workflow.now()`

**Learning Goals:**
- Recognize anti-patterns in real code
- Understand WHY each pattern is problematic
- Practice refactoring to best practices
- Build code review checklist mindset

**Deliverable:** Refactored code + documented list of fixes with explanations

---

### Exercise #10: The Broken Workflow ⭐⭐⭐⭐⭐
**Language:** Python  
**Time:** 2-3 hours  
**Concepts:** Debugging, troubleshooting, production issues

**Scenario:** Contractor built a payment workflow, said it works, disappeared. Now it's failing in production and you're on-call.

**Hidden Problems:**
- ❌ Activities registered with wrong names in worker
- ❌ Activity signatures don't match workflow calls
- ❌ Workflow imports outside `unsafe.imports_passed_through()`
- ❌ Client passes wrong argument types
- ❌ Missing `await` on critical activity
- ❌ Task queue name mismatch
- ❌ Retry policy configured but never applied
- ❌ Non-serializable return object
- ❌ Activity references non-existent state
- ❌ Hardcoded database connection is wrong

**Learning Goals:**
- Debug systematically using error messages
- Interpret Temporal error messages
- Use Temporal UI for debugging
- Understand common integration mistakes
- Build troubleshooting muscle memory

**Realistic Touch:** Cascading errors - some only appear after fixing previous ones

**Deliverable:** Working workflow + debugging process documentation

---

### Exercise #11: Workflow & Worker Versioning ⭐⭐⭐⭐
**Language:** Python  
**Time:** ~2 hours  
**Concepts:** Safe deployments, backwards compatibility

**Scenario:** Production workflow needs a new activity added in the middle. Must support both old (in-flight) and new workflows.

**Part A: Workflow Versioning**
- Use `workflow.patch()` for code evolution
- Support in-flight workflows during deployments

**Part B: Worker Versioning (NEW)**
- Deploy versioned workers side-by-side
- Use Worker Build IDs and Version Sets
- Route workflows to correct worker versions
- Safely migrate workflows to new versions

**Learning Goals:**
- Use `workflow.patch()` for versioning
- Deploy changes without breaking in-flight workflows
- Understand determinism implications
- Test version compatibility
- Implement zero-downtime deployments

**Key Patterns:**
- Patching workflows
- Version markers
- Safe rollout strategies
- Testing multiple versions
- Worker Build ID management

---

### Exercise #12: Continue-as-New ⭐⭐⭐⭐
**Language:** Python  
**Time:** ~2 hours  
**Concepts:** Long-running workflows, history limits

**Scenario:** Subscription billing workflow that runs monthly for years. Must avoid history size limits.

**Learning Goals:**
- Implement continue-as-new pattern
- Understand when and why to reset workflow history
- Preserve necessary state across continuations
- Handle timing/scheduling considerations

**Key Patterns:**
- `workflow.continue_as_new()`
- State preservation
- History management
- Cron workflows vs continue-as-new

---

### Exercise #13: Complex Multi-Service Orchestration ⭐⭐⭐⭐⭐
**Language:** Python (or multi-language)  
**Time:** 3-4 hours  
**Concepts:** Everything combined

**Scenario:** E-commerce checkout that coordinates: payment gateway, inventory system, shipping provider, notification service, fraud detection, loyalty points - with compensations, parallelization, and human approvals.

**Learning Goals:**
- Combine all learned patterns
- Handle real-world complexity
- Make architectural decisions
- Optimize for performance and reliability

**Patterns Used:**
- Parallel execution
- Sagas/compensations
- Signals/queries
- Parent-child workflows
- Proper error handling
- Retry strategies
- Timeout tuning

---

### Exercise #14: Worker Optimization & Performance Tuning ⭐⭐⭐⭐⭐
**Language:** Python  
**Time:** 2-3 hours  
**Concepts:** Performance, timeouts, parallelization, worker configuration, resource management

**Scenario:** Production workflow that "works" but takes 5 minutes when it should take 30 seconds, times out randomly, and can't handle load.

**Problems to Diagnose & Fix:**
- Timeout misconfigurations (too short, too long, wrong hierarchy)
- Serial execution when should be parallel
- Worker configuration issues (too few/many concurrent tasks)
- Activity design problems (mega-activities blocking workers)
- Resource starvation (database connection exhaustion)
- No graceful degradation

**Learning Goals:**
- Understand timeout hierarchy (schedule-to-start, start-to-close, schedule-to-close)
- Activity heartbeats for long-running operations
- Parallelization strategies
- Worker configuration tuning
- Resource management (connection pooling, rate limiting)
- Monitoring & metrics
- **Claim check pattern for large payloads** (performance optimization)

**Performance Scenarios:**
- **The Slow Workflow:** 5 minutes → 30 seconds
- **The Overwhelmed Worker:** Crashes at 10 concurrent → handles 100+
- **The Timeout Spiral:** 30% timeout rate → <1%
- **The Database Bottleneck:** Connection pool exhausted → stable under 200 concurrent

**Claim Check Pattern:**
- Reduce workflow history: 50MB → 500KB
- Improve replay time: 10s → <1s
- Lower worker memory: 2GB → 200MB

---

## Cross-Language Exercises

### Java Track
- Exercise #1 (Registration) in Java
- Exercise #2.5 (Email Verification) in Java
- Exercise #6 (Parallel Execution) in Java - learn `Async.function()`

**Key Java Patterns:**
- Interface-based design
- Activity stubs
- Builder patterns for options
- CompletableFuture patterns

### Go Track
- Exercise #1 (Registration) in Go
- Exercise #2.5 (Email Verification) in Go
- Exercise #7 (Signals/Queries) in Go

**Key Go Patterns:**
- Context management
- Struct-based workflows
- Channels and goroutines
- Error handling patterns

### TypeScript Track
- Exercise #1 (Registration) in TypeScript
- Exercise #2.5 (Email Verification) in TypeScript
- Exercise #8 (Parent-Child) in TypeScript

**Key TypeScript Patterns:**
- Promise-based async
- Type definitions
- Worker configuration
- Module system

---

## Progression Philosophy

### Complexity Vectors

**Week 1-2 (Beginner):**
- ✅ Clean starting code
- ✅ Add ONE concept per exercise
- ✅ Focus on fundamentals
- ✅ Build muscle memory

**Week 3-4 (Intermediate):**
- ✅ Introduce messiness
- ✅ Real-world patterns (sagas, parallel, signals)
- ✅ Combine multiple concepts
- ✅ Realistic failure scenarios

**Week 5+ (Advanced):**
- ✅ Production patterns
- ✅ Debugging challenges
- ✅ Optimization
- ✅ Everything combined

### Code Messy-ness Scale

1. **Clean** - Well-organized, clear separation, easy to understand
2. **Slightly Messy** - Long functions, some mixed concerns
3. **Moderately Messy** - Nested logic, inconsistent patterns, some spaghetti
4. **Very Messy** - 100+ line functions, multiple responsibilities, hard to follow
5. **Realistic Legacy** - Multiple files, unclear architecture, anti-patterns everywhere

**Progression:** Start at 1, gradually increase to 5 by Week 5.

---

## Common Mistakes (Updated)

1. **Importing `time`, `random`, `datetime.now()` in workflow.py**
2. **Forgetting `await` on activity calls**
3. **Passing mutable workflow state to activities**
4. **Activity functions with `self` parameter** (they're not methods)
5. **Missing activities in worker registration**
6. **Using `time.sleep()` instead of `await asyncio.sleep()`** in async activities
7. **Accessing dict keys on dataclass objects** (`item['sku']` vs `item.sku`)
8. **Using Enums/datetime in dataclasses** without custom data converter
   - Error: `TypeError: Object of type RoomType is not JSON serializable`
   - Fix: Use `str` for now, custom converter in Week 5+
9. **Non-zero-padded ISO dates**
   - Error: `ValueError: Invalid isoformat string: '2025-7-12'`
   - Fix: Use `'2025-07-12'` (zero-padded month/day: YYYY-MM-DD)
10. **Calling `activity.logger()` as function**
    - Error: `TypeError: 'LoggerAdapter' object is not callable`
    - Fix: `activity.logger.info()` not `activity.logger()`
11. **Using `workflow.uuid4()` in client code**
    - Error: `AttributeError` or context errors
    - Fix: Use standard `uuid.uuid4()` in client, `workflow.uuid4()` only in workflows

---

## Workshop Application

These exercises form the foundation for two workshop tracks:

### Beginner Workshop (6 hours)
**Session 1:** Foundations (Exercise #1 concepts)  
**Session 2:** Handling Failure (Exercise #2 concepts + light compensations)  
**Session 3:** Advanced Orchestration (Exercise #6 - parallel execution)  
**Session 4:** Production Patterns (Signals/Queries + versioning basics + claim check)

### Advanced Workshop (6 hours)
**Session 1:** Deep Dive on Workflow Design (Best practices, anti-patterns)  
**Session 2:** Testing Strategies (Unit, integration, replay tests)  
**Session 3:** Complex State Management (Parent-child, sagas)  
**Session 4:** Production Readiness (Exercise #9 & #10 concepts, debugging)

---

## Success Metrics

**Speed Targets:**
- Exercise #1 (first time): 60 minutes → (experienced): 20 minutes
- Exercise #2.5 (first time): 45 minutes → (experienced): 15 minutes
- Complex exercises: 2-3 hours → (experienced): 1-1.5 hours

**Skill Markers:**
- ✅ Can identify workflow vs activity boundaries instantly
- ✅ Recognizes anti-patterns in code review
- ✅ Debugs Temporal errors systematically
- ✅ Implements compensations correctly
- ✅ Understands type serialization constraints
- ✅ Knows when to use fallback vs compensation patterns
- ✅ Comfortable across Python, Java, Go
- ✅ Ready to design production workflows

---

## Resources & References

**Temporal Documentation:**
- https://docs.temporal.io
- https://docs.temporal.io/dev-guide/python
- https://docs.temporal.io/dev-guide/java
- https://docs.temporal.io/dev-guide/go
- https://docs.temporal.io/dev-guide/typescript

**SDK Repositories:**
- Python: https://github.com/temporalio/sdk-python
- Java: https://github.com/temporalio/sdk-java
- Go: https://github.com/temporalio/sdk-go
- TypeScript: https://github.com/temporalio/sdk-typescript

**Best Practices:**
- Use Python 3.9-3.10 (NOT 3.14)
- Delete `__pycache__` when debugging
- Use `float` for money (or implement custom converter)
- Use `str` for dates in ISO 8601 format (YYYY-MM-DD)
- Use `str` for enums (or implement custom converter)
- Never import `time`, `random`, `datetime.now()` in workflows
- Always wrap activity imports in `unsafe.imports_passed_through()`
- Keep workflow logic deterministic
- Put all I/O and external calls in activities

---

**Status:** Active Development (December 2024 - January 2025)
**Current Progress:** Exercises #1, #2, #2.5, #3 Complete
**Next Up:** Multi-language rotation or Exercise #4-5

---

## Future Exercises Roadmap

Planned exercises organized by domain. Priority items are marked with 🔥.

### AI/ML Orchestration

| Exercise | Description | Concepts | Priority |
|----------|-------------|----------|----------|
| **Deep Research Orchestration** | Coordinate multi-step research workflows: query decomposition → parallel searches → synthesis → fact-checking → report generation | Parallel execution, long-running workflows, continue-as-new | 🔥 |
| **OpenAI Agents SDK Integration** | Orchestrate OpenAI function-calling agents with Temporal for durability and observability | External API activities, agent state management, tool execution | 🔥 |
| **OpenAI Codex Workflow** | Code generation pipeline: requirements → code gen → validation → testing → human review | Human-in-the-loop, signals, multi-stage pipelines | 🔥 |
| **ML Model Training Pipeline** | Coordinate data prep → training → evaluation → model registry → deployment | Long-running activities, checkpointing, heartbeats |  |
| **RAG Pipeline Orchestration** | Document ingestion → chunking → embedding → indexing with retry and fallback | Parallel processing, claim check pattern |  |
| **Multi-Agent Coordination** | Multiple AI agents collaborating on complex tasks with handoffs and consensus | Parent-child workflows, signals between workflows |  |
| **LLM Gateway with Fallbacks** | Route requests across multiple LLM providers with rate limiting and fallback | Fallback patterns, rate limiting, circuit breaker |  |

### Order Management & Bookings (OMS)

| Exercise | Description | Concepts | Priority |
|----------|-------------|----------|----------|
| **Order Lifecycle Management** | Full order flow: create → validate → payment → fulfillment → shipping → delivery tracking | Saga pattern, state machines, long-running workflows | 🔥 |
| **Inventory Reservation System** | Reserve → hold → confirm/release with timeout-based auto-release | Timers, compensation, distributed locking |  |
| **Multi-Vendor Marketplace Order** | Split orders across vendors, coordinate fulfillment, handle partial failures | Fan-out/fan-in, partial success handling |  |
| **Subscription & Recurring Orders** | Subscription lifecycle with billing cycles, renewals, upgrades/downgrades | Continue-as-new, cron workflows, versioning |  |
| **Returns & Refunds Processing** | Return request → approval → shipping → inspection → refund/exchange | Signals for approvals, compensation chains |  |

### Payment Processing

| Exercise | Description | Concepts | Priority |
|----------|-------------|----------|----------|
| **Payment Gateway Orchestration** | Auth → capture → settlement with idempotency and retry handling | Idempotency keys, retry policies, compensation | 🔥 |
| **Multi-PSP Failover** | Route payments across Stripe/PayPal/Adyen with intelligent fallback | Fallback patterns, circuit breaker, health checks |  |
| **Escrow & Marketplace Payments** | Hold → release/refund based on delivery confirmation or dispute | Timers, signals, human-in-the-loop |  |
| **Split Payments & Payouts** | Collect payment → calculate splits → payout to multiple parties | Parallel execution, compensation |  |
| **Fraud Detection Pipeline** | Real-time scoring → rules evaluation → human review for edge cases | Async activities, signals, decision workflows |  |

### Human-in-the-Loop Approval Workflows

| Exercise | Description | Concepts | Priority |
|----------|-------------|----------|----------|
| **Multi-Level Approval Chain** | Sequential approvals with escalation, delegation, and timeout auto-actions | Signals, timers, workflow queries | 🔥 |
| **Document Review Workflow** | Submit → assign reviewer → review → approve/reject/revise cycle | Signals, workflow state, update handlers |  |
| **Expense Approval System** | Submit → manager → finance → payment with policy-based routing | Dynamic routing, parallel approvals |  |
| **Content Moderation Pipeline** | Auto-classify → flag for review → human decision → action | ML integration, signals, SLAs with timers |  |
| **Change Management (ITSM)** | RFC → impact assessment → CAB review → implementation → validation | Long-running, multiple signals, audit trail |  |

### Infrastructure Management & CI/CD

| Exercise | Description | Concepts | Priority |
|----------|-------------|----------|----------|
| **CI/CD Pipeline Orchestration** | Build → test → security scan → deploy → smoke test → rollback on failure | Compensation (rollback), parallel stages | 🔥 |
| **Infrastructure Provisioning** | Terraform/Pulumi orchestration with drift detection and remediation | Long-running activities, heartbeats, compensation |  |
| **Blue-Green Deployment** | Provision → deploy → health check → traffic shift → cleanup old | Staged execution, compensation, signals |  |
| **Incident Response Automation** | Detect → triage → notify → remediate → postmortem | Signals, escalation timers, human-in-the-loop |  |
| **Database Migration Orchestration** | Backup → migrate → validate → cutover with rollback capability | Compensation, checkpointing, long-running |  |
| **Kubernetes Operator Patterns** | Reconciliation loops, desired state management, self-healing | Continue-as-new, periodic execution |  |

### Exercise Ideas by Temporal Feature

For exercises that focus on teaching specific Temporal features:

| Feature | Exercise Idea | Domain |
|---------|---------------|--------|
| **Signals** | Real-time order status updates from external systems | OMS |
| **Queries** | Dashboard polling workflow state without affecting execution | Any |
| **Update Handlers** | Modify in-flight workflow parameters (price adjustments, priority changes) | OMS/Payments |
| **Schedules** | Recurring report generation, scheduled maintenance windows | Infrastructure |
| **Child Workflows** | Order items processed as individual child workflows | OMS |
| **Continue-as-New** | Subscription billing running for years | Payments |
| **Versioning** | Safe deployment of workflow changes in production | All |
| **Interceptors** | Cross-cutting concerns: logging, metrics, authorization | All |
| **Custom Data Converters** | Handle Enums, Decimals, complex types properly | All |

### Implementation Priority Order

**Phase 1 (Next 🔥):**
1. Deep Research Orchestration - AI/ML + parallel execution + long-running
2. Multi-Level Approval Chain - Human-in-the-loop + signals
3. Payment Gateway Orchestration - Idempotency + compensation

**Phase 2:**
4. OpenAI Agents SDK Integration - Modern AI patterns
5. CI/CD Pipeline Orchestration - Infrastructure patterns
6. Order Lifecycle Management - Comprehensive OMS

**Phase 3:**
7. OpenAI Codex Workflow - Code generation with human review
8. ML Model Training Pipeline - Long-running ML ops
9. Multi-Vendor Marketplace Order - Complex fan-out scenarios

---

## Contributing New Exercises

When adding new exercises, follow this template:

```markdown
### Exercise #XX: [Name] ⭐⭐⭐
**Language:** Python/Java/Go/TypeScript
**Time:** ~X hours
**Concepts:** [List key Temporal concepts]

**Scenario:** [1-2 sentence real-world scenario]

**Learning Goals:**
- Goal 1
- Goal 2
- Goal 3

**Key Patterns:**
- Pattern 1
- Pattern 2

**Status:** 🔲 Not Started / 🟡 In Progress / ✅ Complete
```

---
