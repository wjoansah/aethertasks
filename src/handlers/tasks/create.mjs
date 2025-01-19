import {v7 as uuidv7} from "uuid";
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, PutCommand} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.TASK_TABLE_NAME;

export const handler = async (event) => {
    if (event.httpMethod !== "POST") {
        throw new Error(`postMethod only accepts POST method, you tried: ${event.httpMethod} method.`);
    }

    const body = JSON.parse(event.body);
    const {name, description, status, deadline, responsibility, completedAt, userComment} = body

    const id = uuidv7().toString();

    const queryParams = {
        TableName: tableName,
        Item: {id, name, description, status, deadline, responsibility, completedAt, userComment},
    }

    try {
        const data = await ddbDocClient.send(new PutCommand(queryParams));
        console.log("Success - new task added ", data);
    } catch (err) {
        console.error("Error", err.stack);
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify({id, ...body})
    };

    console.info(`response from: ${event.path} statusCode: ${response.statusCode} body: ${response.body}`);
    return response;
}