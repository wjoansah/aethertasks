import {DynamoDBClient, ScanCommand} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";
import {SFNClient, StartExecutionCommand} from "@aws-sdk/client-sfn";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const sfnClient = new SFNClient({});

const tableName = process.env.TASK_TABLE_NAME;
const stateMachineArn = process.env.STATE_MACHINE_ARN;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

export const handler = async (event) => {
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    console.log("Current time:", currentTime);

    try {
        const result = await ddbDocClient.send(
            new ScanCommand({
                TableName: tableName,
                FilterExpression: "deadline <= :currentTime AND #status = :open",
                ExpressionAttributeNames: {
                    "#status": "status",
                },
                ExpressionAttributeValues: {
                    ":currentTime": currentTime,
                    ":open": "open",
                },
            })
        );

        const expiredTasks = result.Items || [];
        console.log("Expired tasks found:", expiredTasks);

        for (const task of expiredTasks) {
            try {
                console.log("Processing task:", task);

                const input = {
                    workflowType: "taskDeadline",
                    taskId: task.id,
                    responsibility: task.responsibility,
                    adminEmail: ADMIN_EMAIL,
                };

                await sfnClient.send(
                    new StartExecutionCommand({
                        stateMachineArn: stateMachineArn,
                        input: JSON.stringify(input),
                    })
                );

                console.log(`Step Function started for task ID: ${task.id}`);
            } catch (error) {
                console.error(`Error starting Step Function for task ID: ${task.id}`, error);
            }
        }
    } catch (err) {
        console.error("Error scanning expired tasks:", err);
        throw err;
    }
};
