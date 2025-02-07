import {SQSClient, SendMessageCommand} from "@aws-sdk/client-sqs"
import {unmarshall} from "@aws-sdk/util-dynamodb";

const sqsClient = new SQSClient();

export const handler = async (event) => {
    const messages = event.Records.map((record) => {
        console.log("Processing record:", record);

        if (record.eventName === "REMOVE") {
            console.log(`Skipping DELETE event for task ID ${record.dynamodb.Keys?.id.S}`);
            return null; // Ignore deleted tasks
        }

        const task = record.dynamodb.NewImage ? unmarshall(record.dynamodb.NewImage) : null;
        const oldTask = record.dynamodb.OldImage ? unmarshall(record.dynamodb.OldImage) : null;
        const operation = record.eventName;

        const params = {
            QueueUrl: process.env.TASK_QUEUE_URL,
            MessageBody: JSON.stringify({ task, operation, oldTask }),
        };

        return sqsClient.send(new SendMessageCommand(params));
    });

    await Promise.all(messages.filter(Boolean)); // Filter out nulls and send messages concurrently
};