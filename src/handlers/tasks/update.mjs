import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, UpdateCommand} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.TASK_TABLE_NAME;

export const handler = async (event) => {
    if (event.httpMethod !== "PUT") {
        throw new Error(`postMethod only accepts PUT method, you tried: ${event.httpMethod} method.`);
    }

    const id = event.pathParameters.id;

    let updateExpression = "SET";
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    try {
        const body = JSON.parse(event.body);

        for (const [key, value] of Object.entries(body)) {
            updateExpression += ` #${key} = :${key},`;
            expressionAttributeValues[`:${key}`] = value;
            expressionAttributeNames[`#${key}`] = key;
        }

        // Remove trailing comma
        updateExpression = updateExpression.slice(0, -1);

        const params = {
            TableName: tableName,
            Key: {
                id: id
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
            ReturnValues: "ALL_NEW",
        };

        const result = await ddbDocClient.send(new UpdateCommand(params));
        console.log('updated task successfully', result.Attributes);

        const response = {
            statusCode: 200,
            body: JSON.stringify(body)
        };

        console.info(`response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`);
        return response;
    } catch (error) {
        console.error("Error", error.stack);
        return {
            statusCode: 500,
            body: "something went wrong",
        }
    }
}
