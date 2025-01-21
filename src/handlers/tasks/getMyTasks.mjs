import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, ScanCommand} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.TASK_TABLE_NAME;

export const handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        throw new Error(`getMyTasks only accept GET method, you tried: ${event.httpMethod}`);
    }
    const userEmail = event.requestContext.authorizer.email;

    const queryParams = {
        TableName: tableName,
        FilterExpression: "#responsibility = :email",
        ExpressionAttributeNames: {
            "#responsibility": "responsibility"
        },
        ExpressionAttributeValues: {
            ":email": userEmail
        }
    };

    let results = {}
    try {
        const data = await ddbDocClient.send(new ScanCommand(queryParams));
        results = data.Items;
    } catch (err) {
        console.log("Error", err);
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify(results)
    }

    console.info(`response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`);
    return response;
}