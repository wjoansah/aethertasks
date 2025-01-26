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
    const currentTime = Math.floor(Date.now() / 1000);

    try {
        const result = await ddbDocClient.send(
            new ScanCommand({
                TableName: tableName,
                FilterExpression: "deadline <= :currentTime AND #status = :open",
                ExpressionAttributeNames: {
                    "#status": "status",
                },
                ExpressionAttributeValues: {
                    ":currentTime": currentTime.toString(),
                    ":open": "open",
                },
            })
        );

        const expiredTasks = result.Items

        for (const task of expiredTasks) {
            await sfnClient.send(new StartExecutionCommand({
                stateMachineArn: stateMachineArn,
                input: `{"workflowType":"taskDeadline","taskId":"${task.id}","responsibility":"${task.responsibility}","admin":"${ADMIN_EMAIL}"}`
            }))
        }
    } catch (err) {
        console.error("Error processing expired tasks:", err);
        throw err;
    }
}