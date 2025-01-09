import {SNSClient, PublishCommand} from "@aws-sdk/client-sns"

const snsClient = new SNSClient();

const TASK_ASSIGNED_TOPIC_ARN = process.env.TASK_ASSIGNED_TOPIC_ARN;
const TASK_CLOSED_TOPIC_ARN = process.env.TASK_CLOSED_TOPIC_ARN;

export const handler = async (event) => {
    for (const record of event.Records) {
        const task = JSON.parse(record.body);
        console.log("Processing task:", task);

        let topicArn;
        if (task.status === 'open') {
            topicArn = TASK_ASSIGNED_TOPIC_ARN;
        }
        if (task.status === 'closed') {
            topicArn = TASK_CLOSED_TOPIC_ARN;
        }
        const params = {
            TopicArn: topicArn,
            Message: `Task Details:\nName: ${task.name}\nDeadline: ${task.deadline}`,
            MessageAttributes: {
                responsibility: {
                    DataType: "String",
                    StringValue: task.responsibility,
                },
            },
        };

        await snsClient.send(new PublishCommand(params));
    }
}