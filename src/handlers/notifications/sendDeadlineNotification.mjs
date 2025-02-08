import {SNSClient, PublishCommand} from "@aws-sdk/client-sns";
import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient, ScanCommand, UpdateCommand} from "@aws-sdk/lib-dynamodb";

const snsClient = new SNSClient();
const ddbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const tableName = process.env.TASK_TABLE_NAME;
const taskDeadlineTopicArn = process.env.TASK_DEADLINE_TOPIC_ARN;

export const handler = async (event) => {
    console.log("Event received:", event);

    const currentTime = Date.now();
    const oneHourLater = currentTime + 3600 * 1000; // plus 1 hr

    try {
        const result = await ddbDocClient.send(
            new ScanCommand({
                TableName: tableName,
                FilterExpression: "deadline BETWEEN :now AND :oneHourLater AND #status = :open AND (attribute_not_exists(#processed) OR #processed <> :processed)",
                ExpressionAttributeNames: {
                    "#status": "status",
                    "#processed": "processedDeadlineNotification",
                },
                ExpressionAttributeValues: {
                    ":now": currentTime,
                    ":oneHourLater": oneHourLater,
                    ":open": "open",
                    ":processed": true,
                },
            })
        );

        const items = result.Items || [];
        console.log("Tasks found:", items);

        for (const item of items) {
            console.log("Processing task:", item);

            await snsClient.send(
                new PublishCommand({
                    TopicArn: taskDeadlineTopicArn,
                    Subject: `Task Deadline - ${item.name}`,
                    Message: `Task "${item.name}" is due at ${new Date(item.deadline).toLocaleTimeString()}.\n\nPlease take the necessary actions to address this.\n\nBest Regards,\nAetherTasks Team`,
                    MessageAttributes: {
                        email: {
                            DataType: "String",
                            StringValue: item.responsibility,
                        },
                    },
                })
            );

            await ddbDocClient.send(new UpdateCommand({
                TableName: tableName,
                Key: {id: item.id},
                UpdateExpression: 'SET processedDeadlineNotification = :val',
                ExpressionAttributeValues: {
                    ":val": true,
                }
            }))

            console.log(`Notification sent for task: ${item.name}`);
        }
    } catch (error) {
        console.error("Error occurred:", error);
    }
};
