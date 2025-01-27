import {SQSClient, SendMessageCommand} from "@aws-sdk/client-sqs"
import {unmarshall} from "@aws-sdk/util-dynamodb";

const sqsClient = new SQSClient();

export const handler = async (event) => {
    for (const record of event.Records) {
        console.log(record)
        const task = unmarshall(record.dynamodb.NewImage);
        const oldTask = unmarshall(record.dynamodb.OldImage);

        if (record.eventName === "INSERT") {
            console.log("New task created:", task);

            const params = {
                QueueUrl: process.env.TASK_QUEUE_URL,
                MessageBody: JSON.stringify({task, operation: record.eventName}),
            };

            await sqsClient.send(new SendMessageCommand(params));
        }


        if (record.eventName === "MODIFY") {
            console.log("task updated:", task);

            const params = {
                QueueUrl: process.env.TASK_QUEUE_URL,
                MessageBody: JSON.stringify({task, operation: record.eventName, oldTask}),
            };

            await sqsClient.send(new SendMessageCommand(params));
        }
    }

}