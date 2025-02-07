import {PublishCommand, SNSClient} from "@aws-sdk/client-sns";

const adminEmail = process.env.ADMIN_EMAIL
const closedTopicArn = process.env.TASK_CLOSED_TOPIC_ARN

const snsClient = new SNSClient({})

export const handler = async (event) => {
    const {Responsibility: responsibility, TaskName: taskName} = event
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


        await notifyUser(responsibility, `<!doctypehtml><meta charset=UTF-8><title>Task Expired</title><body style=font-family:Arial,sans-serif;line-height:1.6;color:#333><p>The task <strong>"${taskName}"</strong> has expired.<p>Please take the necessary actions to address this.<p>Best Regards,<br><strong>AetherTasks Team</strong>`);
        await notifyUser(adminEmail, `<!doctypehtml><meta charset=UTF-8><title>Task Expired</title><body style=font-family:Arial,sans-serif;line-height:1.6;color:#333><p>The task <strong>"${taskName}"</strong> assigned to <strong>${responsibility}</strong> has expired.<p>Please take the necessary actions to address this.<p>Best Regards,<br><strong>AetherTasks Team</strong>`);
    } catch (err) {
        console.error(err);
    }

}