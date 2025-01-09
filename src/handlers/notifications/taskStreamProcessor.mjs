import {SQSClient, SendMessageCommand} from "@aws-sdk/client-sqs"
import {unmarshall} from "@aws-sdk/util-dynamodb";

const sqsClient = new SQSClient();

export const handler = async (event) => {
    for (const record of event.Records) {
        if (record.eventName === "INSERT") {
            const task = unmarshall(record.dynamodb.NewImage);
            console.log("New task created:", task);

            const params = {
                QueueUrl: process.env.TASK_QUEUE_URL,
                MessageBody: JSON.stringify(task),
            };

            await sqsClient.send(new SendMessageCommand(params));
        }
    }

}