import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, PutCommand, ScanCommand} from '@aws-sdk/lib-dynamodb';
import {marshall} from "@aws-sdk/util-dynamodb";
import uuid from "uuid";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.USERS_TABLE;

export const handler = async (event, context) => {
    const routeKey = `${event['httpMethod']} ${event['resource']}`;
    let responseBody = {"message": "unsupported route"}
    let statusCode = 400;

    let queryParams = {}

    try {
        if (routeKey === "GET /users") {
            queryParams = {TableName: tableName};
            responseBody["body"] = await ddbDocClient.send(new ScanCommand(queryParams));
            statusCode = 200;
        }

        if (routeKey === "POST /users/invite") {
            const body = JSON.parse(event.body);
            const {name, email} = body
            const id = uuid.v7().toString();
            const params = {
                TableName: tableName,
                Item: marshall({
                    id,
                    name,
                    email
                })
            }

            responseBody["body"] = await ddbDocClient.send(new PutCommand(queryParams));
            statusCode = 201;
        }

    } catch (err) {
        statusCode = 400;
        responseBody = {"error": err};
        console.error(err)
    }

    return {
        statusCode,
        body: responseBody,
    }
}