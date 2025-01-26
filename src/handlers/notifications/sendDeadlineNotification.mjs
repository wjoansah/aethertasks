import {SNSClient, PublishCommand} from "@aws-sdk/client-sns";
import {DynamoDBClient, QueryCommand} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";

const snsClient = new SNSClient();
const ddbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const tableName = process.env.TASK_TABLE_NAME;
const taskDeadlineTopicArn = process.env.TASK_DEADLINE_TOPIC_ARN;

export const handler = async (event) => {
    console.log("Event received:", event);

    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const oneHourLater = currentTime + 3600;

    try {
        const result = await ddbDocClient.send(
            new QueryCommand({
                TableName: tableName,
                FilterExpression: "deadline BETWEEN :now AND :oneHourLater AND #status = :open",
                ExpressionAttributeNames: {
                    "#status": "status",
                },
                ExpressionAttributeValues: {
                    ":now": currentTime,
                    ":oneHourLater": oneHourLater,
                    ":open": "open",
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
                    Message: `Task "${item.name}" is due in 1 hour.`,
                    MessageAttributes: {
                        responsibility: {
                            DataType: "String",
                            StringValue: item.responsibility,
                        },
                    },
                })
            );

            console.log(`Notification sent for task: ${item.name}`);
        }
    } catch (error) {
        console.error("Error occurred:", error);
    }
};
