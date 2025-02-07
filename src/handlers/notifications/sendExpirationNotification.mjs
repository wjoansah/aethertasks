import {PublishCommand, SNSClient} from "@aws-sdk/client-sns";
import {CognitoIdentityProviderClient, ListUsersInGroupCommand} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient();

const closedTopicArn = process.env.TASK_CLOSED_TOPIC_ARN
const adminGroupName = process.env.ADMIN_GROUP_NAME
const userPoolId = process.env.USER_POOL_ID

const snsClient = new SNSClient({})

export const handler = async (event) => {
    const {Responsibility: responsibility, TaskName: taskName} = event
    try {
        const adminEmails = await getUsersInAdminGroup()
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

        for (const email in adminEmails) {
            await notifyUser(email, `<!doctypehtml><meta charset=UTF-8><title>Task Expired</title><body style=font-family:Arial,sans-serif;line-height:1.6;color:#333><p>The task <strong>"${taskName}"</strong> assigned to <strong>${responsibility}</strong> has expired.<p>Please take the necessary actions to address this.<p>Best Regards,<br><strong>AetherTasks Team</strong>`);
        }
    } catch (err) {
        console.error(err);
    }
}

const getUsersInAdminGroup = async () => {
    const result = await cognitoClient.send(new ListUsersInGroupCommand({
        GroupName: adminGroupName,
        UserPoolId: userPoolId,
    }))

    return result.Users.map(user => {
        const emailAttribute = user.Attributes.find((attr) => attr.Name === "email")
        return emailAttribute.Value
    })
}