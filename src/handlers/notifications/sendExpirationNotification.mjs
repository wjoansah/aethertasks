import {PublishCommand, SNSClient} from "@aws-sdk/client-sns";

const adminEmail = process.env.ADMIN_EMAIL
const closedTopicArn = process.env.TASK_CLOSED_TOPIC_ARN

const snsClient = new SNSClient({})

export const handler = async (event) => {
    const {TaskId: taskId, Responsibility: responsibility} = event
    try {
        const notifyUser = async (email, message) => {
            await snsClient.send(
                new PublishCommand({
                    TopicArn: closedTopicArn,
                    Subject: "Task Expired",
                    Message: message,
                    MessageAttributes: {
                        userEmail: {DataType: "String", StringValue: email},
                    },
                })
            );
        };

        const message = `Task ${taskId} has expired.`;

        await notifyUser(responsibility, message);
        await notifyUser(adminEmail, `Task ${taskId} assigned to ${Responsibility} has expired.`);
    } catch (err) {
        console.error(err);
    }

}