import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, ScanCommand} from '@aws-sdk/lib-dynamodb';
import * as assert from "node:assert";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.USERS_TABLE;

export const handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        throw new Error(`getMyTasks only accept GET method, you tried: ${event.httpMethod}`);
    }

    const userEmail = event.requestContext.authorizer.claims.email;
    assert(userEmail);

    const queryParams = {
        TableName: tableName,
        FilterExpression: "#responisibility = :email",
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