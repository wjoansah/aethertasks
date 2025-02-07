import {SNSClient, PublishCommand} from "@aws-sdk/client-sns"

const snsClient = new SNSClient();

const TASK_ASSIGNED_TOPIC_ARN = process.env.TASK_ASSIGNED_TOPIC_ARN;
const TASK_CLOSED_TOPIC_ARN = process.env.TASK_CLOSED_TOPIC_ARN;
const TASK_COMPLETED_ARN = process.env.TASK_COMPLETED_ARN;
const REOPENED_TASK_TOPIC_ARN = process.env.REOPENED_TASK_TOPIC_ARN;

export const handler = async (event) => {
    for (const record of event.Records) {
        const payload = JSON.parse(record.body);
        const {task} = payload;
        console.log("Processing task:", task);

        const params = buildPublishCommandParams(`task.${task.status.toLowerCase()}`, payload)
        if (!params) {
            console.log("nothing to send returning...")
            return {
                statusCode: 204,
                body: JSON.stringify({message: "nothing to do"})
            }
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
            let message = `<!doctypehtml><meta charset=UTF-8><title>Task Details</title><body style=font-family:Arial,sans-serif;line-height:1.6;color:#333><h3>Task Details:</h3><p><strong>Name:</strong> ${task.name}<p><strong>Deadline:</strong> ${new Date(task.deadline).toLocaleString()}`

            if (operation === "INSERT") {
                subject = "New Task Assigned";
                message = `<!doctypehtml><meta charset=UTF-8><title>New Task Assigned</title><body style=font-family:Arial,sans-serif;line-height:1.6;color:#333><p>Hello ${task.responsibility},<p>You have been assigned a new task: <strong>\"${task.name}\"</strong>.<p><strong>Description:</strong> ${task.description}<p><strong>Due Date:</strong> ${new Date(task.deadline).toLocaleString()}<p>Please log in to your account to view and manage this task.<p>Best Regards,<br><strong>AetherTasks Team</strong>`;
            }

            if (statusHasChanged(task, oldTask) && (oldTask.status === "closed" || oldTask.status === "expired")) {
                return {
                    TopicArn: REOPENED_TASK_TOPIC_ARN,
                    Subject: "Task Reopened",
                    Message: message,
                    MessageAttributes: {
                        responsibility: {
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
                    responsibility: {
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
                    Message: `<!doctypehtml><meta charset=UTF-8><title>Task Closed</title><body style=font-family:Arial,sans-serif;line-height:1.6;color:#333><p>Hello ${task.responsibility},<p>The task <strong>"${task.name}"</strong> has been closed.<p>For more information, please log in to your account.<p>Best Regards,<br><strong>AetherTasks Team</strong>`,
                    MessageAttributes: {
                        responsibility: {
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
                    Message: `<!doctypehtml><meta charset=UTF-8><title>Task Completed</title><body style=font-family:Arial,sans-serif;line-height:1.6;color:#333><p>Dear AetherTasks Admin,<p>The task <strong>"${task.name}"</strong> has been marked as completed by <strong>${task.responsibility}</strong>.<p><strong>Completion Date:</strong> ${task.completedAt}<p>You can review the details of this task in your account.<p>Best Regards,<br><strong>AetherTasks Team</strong>`,
                }
            }
            break;
        default:
            console.warn(`Received an event of type ${eventType} which is not implemented`);
            break;
    }
}

const statusHasChanged = (task, oldTask) => {
    return task.status !== oldTask.status;
}