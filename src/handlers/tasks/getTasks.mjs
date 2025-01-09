import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, ScanCommand} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.TASK_TABLE_NAME;

export const handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        throw new Error(`getTasks only accept GET method, you tried: ${event.httpMethod}`);
    }
    console.info('received:', event);

    const queryParams = {
        TableName: tableName
    };

    let items = {};
    try {
        const data = await ddbDocClient.send(new ScanCommand(queryParams));
        items = data.Items;
    } catch (err) {
        console.log("Error", err);
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify(items)
    };

    console.info(`response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`);
    return response;
}