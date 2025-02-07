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

        for (const email of adminEmails) {
            await notifyUser(email, `The task "${taskName}" assigned to ${responsibility} has expired.\n\nPlease take the necessary actions to address this.\n\nBest Regards,\nAetherTasks Team`);
        }
    } catch (err) {
        console.error(err);
    }
}

const getUsersInAdminGroup = async () => {
    const allEmails = [];
    let nextToken = undefined;

    do {
        const result = await cognitoClient.send(new ListUsersInGroupCommand({
            GroupName: adminGroupName,
            UserPoolId: userPoolId,
            NextToken: nextToken,
            Limit: 60,
        }));

        const emails = result.Users
            .map(user => user.Attributes.find(attr => attr.Name === "email")?.Value)
            .filter(email => email !== undefined);

        allEmails.push(...emails);
        nextToken = result.NextToken;
    } while (nextToken);

    return allEmails;
};
