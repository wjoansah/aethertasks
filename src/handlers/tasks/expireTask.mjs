import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient, UpdateCommand} from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const tableName = process.env.TASK_TABLE_NAME;

export const handler = async (event) => {
    const id = event.taskId;

    console.log(`updating status of task with id ${id} to expired...`);

    try {
        await ddbDocClient.send(
            new UpdateCommand({
                TableName: tableName,
                Key: {
                    id: id,
                },
                UpdateExpression: "SET #status = :expired",
                ExpressionAttributeNames: {
                    "#status": "status",
                },
                ExpressionAttributeValues: {
                    ":expired": "expired",
                },
            })
        );
    } catch (error) {
        console.error(error);
    }
}