import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, GetCommand, UpdateCommand} from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.TASK_TABLE_NAME;

export const handler = async (event, context) => {
    if (event.httpMethod !== "PUT") {
        throw new Error(`postMethod only accepts PUT method, you tried: ${event.httpMethod} method.`);
    }

    const {id, userComment} = JSON.parse(event.body);

    const status = "completed"

    const getParams = {
        TableName: tableName,
        Key: {id: id}
    }

    try {
        const result = await ddbDocClient.send(new GetCommand(getParams));

        if (!result.Item) {
            return {
                statusCode: result['$metadata'].httpStatusCode,
                body: JSON.stringify({message: "task not found"})
            }
        }
        if (result.Item.responsibility !== event.requestContext.authorizer.email) {
            return {
                statusCode: 403,
                body: {
                    message: `You are not authorized to perform this action.`,
                }
            }
        }
    } catch (e) {
        console.error(e)
        return {
            statusCode: 500,
            body: {message: "failed to retrieve task"}
        }
    }

    const updateParams = {
        TableName: tableName,
        Key: {
            id: id,
        },
        UpdateExpression: 'SET #s = :status, #uc = :comment, #ca = :completedAt ',
        ExpressionAttributeNames: {
            '#s': 'status',
            '#uc': 'userComment',
            '#ca': 'completedAt',
        },
        ExpressionAttributeValues: {
            ':status': status,
            ':comment': userComment,
            ':completedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW', // Returns only the updated attributes
    };

    try {
        const result = await ddbDocClient.send(new UpdateCommand(updateParams));
        console.log('Update succeeded:', result.Attributes);
        return result.Attributes;
    } catch (error) {
        console.error('Error updating item:', error);
        throw error;
    }
}