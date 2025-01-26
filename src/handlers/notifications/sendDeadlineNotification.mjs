import {SNSClient, PublishCommand} from "@aws-sdk/client-sns";
import {DynamoDBClient, ScanCommand} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";

const snsClient = new SNSClient();
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const tableName = process.env.TASK_TABLE_NAME;
const taskDeadlineTopicArn = process.env.TASK_DEADLINE_TOPIC_ARN;

export const handler = async (event) => {
    console.log(event)
    const currentTime = Math.floor(Date.now() / 1000)
    const oneHourLater = currentTime + 3600

    try {
        const result = await ddbDocClient.send(new ScanCommand({
            TableName: tableName,
            FilterExpression: "deadline BETWEEN :now AND :oneHourLater AND #status = :open",
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":now": currentTime,
                ":oneHourLater": oneHourLater,
                ":open": "open"
            }
        }))

        for (const item of result.Items) {
            await snsClient.send(
                new PublishCommand({
                    TopicArn: taskDeadlineTopicArn,
                    Subject: `Task Deadline - ${item.name}`,
                    Message: `Task ${item.name} is due in 1 hour.`,
                    MessageAttributes: {
                        responsibility: {
                            DataType: "String",
                            StringValue: item.responsibility,
                        },
                    },
                })
            );
        }
    } catch (error) {
        console.error(error);
    }
}

