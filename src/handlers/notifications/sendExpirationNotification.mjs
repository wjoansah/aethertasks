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
            console.log(`Sending expiration notification to ${email}`)
            await snsClient.send(
                new PublishCommand({
                    TopicArn: closedTopicArn,
                    Subject: "Task Expired",
                    Message: message,
                    MessageAttributes: {
                        email: {DataType: "String", StringValue: email},
                    },
                })
            );
        };


        await notifyUser(responsibility, `The task "${taskName}" has expired.\n\nPlease take the necessary actions to address this.\n\nBest Regards,\nAetherTasks Team`);

        for (const email in adminEmails) {
            await notifyUser(email, `The task "${taskName}" assigned to ${responsibility} has expired.\n\nPlease take the necessary actions to address this.\n\nBest Regards,\nAetherTasks Team`);
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