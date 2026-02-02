package solution.temporal.workflow;

import exercise.model.*;
import io.temporal.activity.ActivityOptions;
import io.temporal.common.RetryOptions;
import io.temporal.workflow.Workflow;
import org.slf4j.Logger;
import solution.temporal.activity.*;
import solution.temporal.model.*;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

public class BatchPRReviewWorkflowImpl implements BatchPRReviewWorkflow {

    // ═══════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════

    /*
    * Temporal Workflows can be replayed many times, a
    * nd any side effects (like printing to stdout)
    * will be repeated on every replay.
    * This leads to duplicated and misleading logs.
    * Instead, you should use the Java SDK’s replay-safe Workflow logger
    * */
    private static final Logger logger = Workflow.getLogger(BatchPRReviewWorkflowImpl.class);
    /**
     * When to trigger continue-as-new.
     * <p>
     * Q: Why 4000 and not 49000 (just under the limit)?
     * A: Safety margin! You want to continue-as-new WELL before hitting the limit.
     * Also, fewer events = faster replay if the worker restarts.
     * <p>
     * Q: What if you set this too LOW (like 100)?
     * A: Too many continuations. More overhead, harder to debug.
     * <p>
     * Q: What if you set this too HIGH (like 45000)?
     * A: Risk of hitting the hard limit if there's unexpected overhead.
     */
    private static final int HISTORY_THRESHOLD = 4000;

    /**
     * Activity options - same pattern as Exercise 901.
     * <p>
     * Q: Why do we configure retry here and not in the activity?
     * A: Separation of concerns. The activity does the work.
     * The workflow decides HOW to call it (timeout, retries, etc.)
     */
    private static final ActivityOptions ACTIVITY_OPTIONS = ActivityOptions.newBuilder()
            .setStartToCloseTimeout(Duration.ofSeconds(60))
            .setRetryOptions(RetryOptions.newBuilder()
                    .setInitialInterval(Duration.ofSeconds(5))
                    .setBackoffCoefficient(2.0)
                    .build())
            .build();

    private final CodeQualityActivity codeQualityActivity =
            Workflow.newActivityStub(CodeQualityActivity.class, ACTIVITY_OPTIONS);
    private final TestQualityActivity testQualityActivity =
            Workflow.newActivityStub(TestQualityActivity.class, ACTIVITY_OPTIONS);
    private final SecurityQualityActivity securityQualityActivity =
            Workflow.newActivityStub(SecurityQualityActivity.class, ACTIVITY_OPTIONS);

    // ═══════════════════════════════════════════════════════════════
    // WORKFLOW STATE (for query method)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Q: Why do we need these fields if we have BatchState?
     * A: The query method needs access to current state.
     *    These are "windows" into what's happening right now.
     *
     * Q: Are these persisted across continue-as-new?
     * A: NO! These are local variables. Only BatchState survives.
     *    That's why we copy state to currentState at the start.
     */
    private BatchState currentState;
    private BatchRequest currentRequest;
    private String currentPrTitle;
    private long chunkStartMs;

    @Override
    public BatchResult processBatch(BatchRequest request, BatchState state) {
        // ─────────────────────────────────────────────────────────
        // STEP 1: Initialize or resume state
        // ─────────────────────────────────────────────────────────

        /**
         * Q: Why check if state is null?
         * A: First run: state is null (caller passes null)
         *    Continuation: state has data from previous run
         */
        if (state == null) {
            // FIRST RUN - create fresh state
            // Q: Why use Workflow.currentTimeMillis() instead of System.currentTimeMillis()?
            // A: Determinism! System time changes on replay. Workflow time is consistent.
            String startedAt = Instant.ofEpochMilli(Workflow.currentTimeMillis()).toString();
            state = BatchState.initial(startedAt);
            logger.info("Starting batch: " + request.getTotalCount() + " PRs");
        } else {
            // CONTINUATION - resuming from previous run
            logger.info("Continuing batch at chunk #" + (state.chunkIndex + 1));
            logger.info("Already processed: " + state.processedCount);
        }

        // Store for query access
        this.currentState = state;
        this.currentRequest = request;
        this.chunkStartMs = Workflow.currentTimeMillis();

        // ─────────────────────────────────────────────────────────
        // STEP 2: The main processing loop
        // ─────────────────────────────────────────────────────────

        List<ReviewRequest> allPRs = request.pullRequests;

        /**
         * Q: Why start at state.processedCount instead of 0?
         * A: To skip PRs we already processed in previous runs!
         *
         * Example:
         *   Run 1 processes PRs 0-24, then continues-as-new with processedCount=25
         *   Run 2 starts loop at i=25, skipping the first 25 PRs
         */
        for (int i = state.processedCount; i < allPRs.size(); i++) {

            ReviewRequest pr = allPRs.get(i);
            currentPrTitle = pr.prTitle;  // For query visibility

            logger.info("[PR " + (i + 1) + "/" + allPRs.size() + "] " + pr.prTitle);

            try {
                // TODO: Process the PR through all 3 agents
                // Hint: Create a helper method processSinglePR(pr) that returns ReviewResponse
                 ReviewResponse response = processSinglePR(pr);
                 state.recordSuccess(response);

            } catch (Exception e) {
                // Q: Why catch and continue instead of letting it fail?
                // A: One bad PR shouldn't stop the whole batch!

                // TODO: Record the failure
                 String failedAt = Instant.ofEpochMilli(Workflow.currentTimeMillis()).toString();
                 PRData prData = new PRData();
                 prData.prIndex = i;
                 prData.prTitle = pr.prTitle;
                 prData.errorMessage = e.getMessage();
                 prData.failedAt = failedAt;
                 PRFailure failure = new PRFailure(prData);
                 state.recordFailure(failure);

                logger.info("  FAILED: " + e.getMessage());
            }

            // ─────────────────────────────────────────────────────
            // STEP 3: Check if we need to continue-as-new
            // ─────────────────────────────────────────────────────

            if (shouldContinueAsNew()) {
                logger.info("\n>>> History threshold reached. Passing the baton...");

                /**
                 * CRITICAL: Update state BEFORE calling continueAsNew!
                 *
                 * Q: What happens if you forget to update accumulatedDurationMs?
                 * A: You lose this chunk's time from the total.
                 *
                 * Q: What happens if you forget to increment chunkIndex?
                 * A: Your continuation count will be wrong.
                 */
                long chunkDurationMs = Workflow.currentTimeMillis() - chunkStartMs;
                state.accumulatedDurationMs += chunkDurationMs;
                state.chunkIndex++;

                // ═══════════════════════════════════════════════════
                //           THE MAGIC LINE - Pass the baton!
                // ═══════════════════════════════════════════════════
                Workflow.continueAsNew(request, state);

                // ⚠️⚠️⚠️ NOTHING BELOW THIS LINE EVER EXECUTES ⚠️⚠️⚠️
                //
                // The workflow has ALREADY restarted with fresh history.
                // This code is unreachable. If you put important logic here,
                // it will be SILENTLY IGNORED.
                //
                // Common mistake: Putting cleanup code after continueAsNew()
            }
        }

        // ─────────────────────────────────────────────────────────
        // STEP 4: All PRs processed - build final result
        // ─────────────────────────────────────────────────────────

        /**
         * Q: When does this code run?
         * A: Only on the LAST continuation, when all PRs are done.
         *    Previous runs exit via continueAsNew() above.
         */

        currentPrTitle = null;  // Clear for query - we're done
        long finalChunkDurationMs = Workflow.currentTimeMillis() - chunkStartMs;
        String completedAt = Instant.ofEpochMilli(Workflow.currentTimeMillis()).toString();

        // TODO: Build and return the final result
        logger.info("\n=== BATCH COMPLETE ===");
         return BatchResult.from(state, request, completedAt, finalChunkDurationMs);

    }

    private ReviewResponse processSinglePR(ReviewRequest request) {
        // 1. Call Code Quality Agent (BLOCKS for ~2-3 seconds)
        System.out.println("[1/3] Calling Code Quality Agent...");
        AgentResult codeQuality = codeQualityActivity.analyze(
                request
        );
        System.out.println("      → " + codeQuality.recommendation + " (Risk: " + codeQuality.riskLevel + ")");

        // 2. Call Test Quality Agent (BLOCKS for ~2-3 seconds)
        System.out.println("[2/3] Calling Test Quality Agent...");
        AgentResult testQuality = testQualityActivity.analyze(
                request
        );
        System.out.println("      → " + testQuality.recommendation + " (Risk: " + testQuality.riskLevel + ")");

        // 3. Call Security Agent (BLOCKS for ~2-3 seconds)
        System.out.println("[3/3] Calling Security Agent...");
        AgentResult security = securityQualityActivity.analyze(
                request
        );
        System.out.println("      → " + security.recommendation + " (Risk: " + security.riskLevel + ")");

        // 4. Aggregate results
        String overall = aggregate(codeQuality, testQuality, security);

        // 5. Build response
        // Use this instead of System.currentTimeMillis()
        long tookMs = Workflow.currentTimeMillis() - chunkStartMs;

        Metadata metadata = new Metadata(
                Instant.ofEpochMilli(Workflow.currentTimeMillis()).toString(),
                tookMs,
                System.getenv().getOrDefault("OPENAI_MODEL", "gpt-4o-mini")
        );

        ReviewResponse response = new ReviewResponse(
                overall,
                Arrays.asList(codeQuality, testQuality, security),
                metadata
        );

        System.out.println("=".repeat(60));
        System.out.println("Review Complete: " + overall + " (took " + tookMs + "ms)");
        System.out.println("=".repeat(60));

        return response;
    }

    /**
     * Aggregate agent results into overall recommendation.
     *
     * Logic: If ANY agent says BLOCK → BLOCK
     *        Else if ANY says REQUEST_CHANGES → REQUEST_CHANGES
     *        Else → APPROVE
     */
    private String aggregate(AgentResult... results) {
        for (AgentResult result : results) {
            if ("BLOCK".equals(result.recommendation)) {
                return "BLOCK";
            }
        }
        for (AgentResult result : results) {
            if ("REQUEST_CHANGES".equals(result.recommendation)) {
                return "REQUEST_CHANGES";
            }
        }
        return "APPROVE";
    }
    /**
     * Should we pass the baton to a new workflow run?
     */
    private boolean shouldContinueAsNew() {
        /**
         * Q: What is isContinueAsNewSuggested()?
         * A: Temporal's internal recommendation based on history size.
         */
        if (Workflow.getInfo().isContinueAsNewSuggested()) {
            return true;
        }

        /**
         * Q: Why have our own threshold too?
         * A: Defense in depth. Don't rely solely on Temporal's suggestion.
         */
        return Workflow.getInfo().getHistoryLength() > HISTORY_THRESHOLD;
    }

    @Override
    public BatchProgress getProgress() {
        /**
         * Q: What if someone queries before processBatch starts?
         * A: currentState would be null. Handle that gracefully!
         */
        if (currentState == null || currentRequest == null) {
            return new BatchProgress(); // Empty progress
        }

        long currentChunkDurationMs = Workflow.currentTimeMillis() - chunkStartMs;

        // TODO: Return actual progress
         return BatchProgress.from(currentState, currentRequest.getTotalCount(),
                                   currentPrTitle, currentChunkDurationMs);
    }
}