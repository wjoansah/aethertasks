import {SQSClient, SendMessageCommand} from "@aws-sdk/client-sqs"
import {unmarshall} from "@aws-sdk/util-dynamodb";

const sqsClient = new SQSClient();

export const handler = async (event) => {
    for (const record of event.Records) {
        console.log(event.Record)
        if (record.eventName === "INSERT") {
            const task = unmarshall(record.dynamodb.NewImage);
            console.log("New task created:", task);

            const params = {
                QueueUrl: process.env.TASK_QUEUE_URL,
                MessageBody: JSON.stringify({task, operation: "INSERT"}),
            };

            await sqsClient.send(new SendMessageCommand(params));
        }


        if (record.eventName === "MODIFY") {
            const task = unmarshall(record.dynamodb.NewImage);
            console.log("task updated:", task);

            const params = {
                QueueUrl: process.env.TASK_QUEUE_URL,
                MessageBody: JSON.stringify({task, operation: "MODIFY"}),
            };

            await sqsClient.send(new SendMessageCommand(params));
        }
    }

}