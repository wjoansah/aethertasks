import {SNSClient, PublishCommand} from "@aws-sdk/client-sns"
import {unmarshall} from "@aws-sdk/util-dynamodb";

const snsClient = new SNSClient();

const TASK_ASSIGNED_TOPIC_ARN = process.env.TASK_ASSIGNED_TOPIC_ARN;
const TASK_CLOSED_TOPIC_ARN = process.env.TASK_CLOSED_TOPIC_ARN;
const TASK_COMPLETED_ARN = process.env.TASK_COMPLETED_ARN;
const REOPENED_TASK_TOPIC_ARN = process.env.REOPENED_TASK_TOPIC_ARN;

export const handler = async (event) => {
    for (const record of event.Records) {
        const payload = JSON.parse(record.body);
        const task = payload.task

        console.log("Processing task:", task);

        const params = buildPublishCommandParams(`task.${task.status.toLowerCase()}`, payload)
        if (!params) {
            console.log("nothing to send returning...")
            continue;
        }

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
    const {task, operation, oldTask} = payload;

    switch (eventType) {
        case "task.open":
            let subject = "Task Updates"
            let message = `Task Details:\nName: ${task.name}\nDeadline: ${new Date(task.deadline).toLocaleString()}`;

            if (operation === "INSERT") {
                subject = "New Task Assigned";
                message = `Hello ${task.responsibility},\nYou have been assigned a new task: "${task.name}".\nDescription: ${task.description}\nDue Date: ${new Date(task.deadline).toLocaleString()}\nPlease log in to your account to view and manage this task.\nBest Regards,\n AetherTasks Team`;
            }

            if (statusHasChanged(task, oldTask) && oldTask && (oldTask.status === "closed" || oldTask.status === "expired")) {
                return {
                    TopicArn: REOPENED_TASK_TOPIC_ARN,
                    Subject: "Task Reopened",
                    Message: message,
                    MessageAttributes: {
                        email: {
                            DataType: "String",
                            StringValue: task.responsibility,
                        }
                    }
                }
            }

            return {
                TopicArn: TASK_ASSIGNED_TOPIC_ARN,
                Subject: subject,
                Message: message,
                MessageAttributes: {
                    email: {
                        DataType: "String",
                        StringValue: task.responsibility,
                    }
                }
            }
        case "task.closed":
            if (statusHasChanged(task, oldTask)) {
                return {
                    TopicArn: TASK_CLOSED_TOPIC_ARN,
                    Subject: "Task Updates - Task Closed",
                    Message: `Hello ${task.responsibility},\n\nThe task "${task.name}" has been closed.\n\nFor more information, please log in to your account.\n\nBest Regards,\nAetherTasks Team`,
                    MessageAttributes: {
                        email: {
                            DataType: "String",
                            StringValue: task.responsibility,
                        }
                    }
                }
            }
            break;
        case "task.completed":
            if (statusHasChanged(task, oldTask)) {
                return {
                    TopicArn: TASK_COMPLETED_ARN,
                    Subject: "Task Updates - Task Completed",
                    Message: `Dear AetherTasks Admin,\n\nThe task "${task.name}" has been marked as completed by ${task.responsibility}.\n\nCompletion Date: ${task.completedAt}\n\nYou can review the details of this task in your account.\n\nBest Regards,\nAetherTasks Team`,
                }
            }
            break;
        default:
            console.warn(`Received an event of type ${eventType} which is not implemented`);
            return null
    }
}

const statusHasChanged = (task, oldTask) => {
    console.log("Comparing statuses:", oldTask.status, "vs", task.status);
    if (!oldTask) return true
    return oldTask.status !== task.status;
}