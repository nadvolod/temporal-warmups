package solution.temporal;

import exercise.SupportTriageService;
import io.temporal.client.WorkflowClient;
import io.temporal.client.WorkflowOptions;
import io.temporal.serviceclient.WorkflowServiceStubs;
import solution.domain.TriageResult;

import java.util.UUID;

public class Starter {
    // 1. Provide a task queue
    private static final String TASK_QUEUE = "support-triage";

    //2. Starter typically gets a main()
    public static void main(String[] args) {
        //3. connect to temporal server, same as Worker
        WorkflowServiceStubs service = WorkflowServiceStubs.newLocalServiceStubs();
        WorkflowClient client = WorkflowClient.newInstance(service);

        //define the logic to iterate through tickets
        // Sample tickets
        String[] tickets = {
                "TKT-001|How do I reset my password? I forgot it.",
                "TKT-002|Account hacked! Someone charged my card 4532-1234-5678-9012 for $500!"
        };

        int successful = 0;
        int failed = 0;

        for (String ticket : tickets) {
            String[] parts = ticket.split("\\|");
            String ticketId = parts[0];
            String ticketText = parts[1];
            //4. create workflowId
            String workflowId = TASK_QUEUE + "-" + ticketId;

            //5. create a workflow stub
            SupportTriageWorkflow workflow = client.newWorkflowStub(SupportTriageWorkflow.class,
                    WorkflowOptions.newBuilder()
                            .setTaskQueue(TASK_QUEUE)
                            .setWorkflowId(workflowId)
                            .build());

            //6. call the workflow
            TriageResult result = workflow.triageTicket(ticketId, ticketText);

            if (result.success) {
                successful++;
            } else {
                failed++;
            }

            // Pause between tickets
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        // Summary
        String separator = "==================================================";
        System.out.println("\n\n" + separator);
        System.out.println("RESULTS");
        System.out.println(separator);
        System.out.println("Tickets processed successfully: " + successful);
        System.out.println("Tickets failed: " + failed);
    }
}
