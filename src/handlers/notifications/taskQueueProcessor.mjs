import {SNSClient, PublishCommand} from "@aws-sdk/client-sns"

const snsClient = new SNSClient();

const TASK_ASSIGNED_TOPIC_ARN = process.env.TASK_ASSIGNED_TOPIC_ARN;
const TASK_CLOSED_TOPIC_ARN = process.env.TASK_CLOSED_TOPIC_ARN;
const TASK_COMPLETED_ARN = process.env.TASK_COMPLETED_ARN;

export const handler = async (event) => {
    for (const record of event.Records) {
        const payload = JSON.parse(record.body);
        const {task} = payload;
        console.log("Processing task:", task);

        const params = buildPublishCommandParams(`task.${task.status.toLowerCase()}`, payload)

        try {
            await snsClient.send(new PublishCommand(params));
        } catch (e) {
            console.error(e);
            return {
                statusCode: 500,
                body: JSON.stringify({
                    message: "Failed to send task notification.",
                }),
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Sent notification on task successfully.",
            }),
        };
    }
}

const buildPublishCommandParams = (eventType, payload) => {
    const {task, operation} = payload;
    switch (eventType) {
        case "task.open":
            let subject = "Task Updates"
            let message = `Task Details:\nName: ${task.name}\nDeadline: ${task.deadline}`

            if (operation === "INSERT") {
                subject = "New Task Assigned";
                message = `Hello ${task.responsibility},\n\nYou have been assigned a new task: "${task.name}".\n\nDescription: ${task.description}\nDue Date: ${task.deadline}\n\nPlease log in to your account to view and manage this task.\n\nBest regards,\nAetherTasks Management System`;
            }

            return {
                TopicArn: TASK_ASSIGNED_TOPIC_ARN,
                Subject: subject,
                Message: message,
                MessageAttributes: {
                    responsibility: {
                        DataType: "String",
                        StringValue: task.responsibility,
                    }
                }
            }
        case "task.closed":
            return {
                TopicArn: TASK_CLOSED_TOPIC_ARN,
                Subject: "Task Updates - Task Closed",
                Message: `Hello ${task.responsibility},\n\nThe task "${task.name}" has been closed.\n\nFor more information, please log in to your account.\n\nBest regards,\nAetherTasks Management System`,
                MessageAttributes: {
                    responsibility: {
                        DataType: "String",
                        StringValue: task.responsibility,
                    }
                }
            }
        case "task.completed":
            return {
                TopicArn: TASK_COMPLETED_ARN,
                Subject: "Task Updates - Task Completed",
                Message: `Dear AetherTasks Admin,\n\nThe task "${task.name}" has been marked as completed by ${task.responsibility}.\n\nCompletion Date: ${task.completedAt}\n\nYou can review the details of this task in your account.\n\nBest regards,\nAetherTasks Management System`,
            }
        default:
            console.warn(`Received an event of type ${eventType} which is not implemented`);
            break;
    }
}
