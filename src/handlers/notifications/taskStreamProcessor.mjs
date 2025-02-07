import {SQSClient, SendMessageCommand} from "@aws-sdk/client-sqs"
import {unmarshall} from "@aws-sdk/util-dynamodb";

const sqsClient = new SQSClient();

export const handler = async (event) => {
    for (const record of event.Records) {
        console.log("Processing record:", JSON.stringify(record, null, 2));

        if (record.eventName === "REMOVE") {
            console.log(`Skipping DELETE event for task ID ${record.dynamodb.Keys?.id.S}`);
            continue
        }

        try {
            const task = record.dynamodb.NewImage ? unmarshall(record.dynamodb.NewImage) : null;
            const oldTask = record.dynamodb.OldImage ? unmarshall(record.dynamodb.OldImage) : null;
            const operation = record.eventName;

            console.log('task: ', task)
            console.log('old task: ', oldTask)

            const params = {
                QueueUrl: process.env.TASK_QUEUE_URL,
                MessageBody: JSON.stringify({task, operation, oldTask}),
            };

            await sqsClient.send(new SendMessageCommand(params));
        } catch (error) {
            console.error(error);
        }
    }
};