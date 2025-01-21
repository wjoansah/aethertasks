const {
    CognitoIdentityProviderClient,
    AdminGetUserCommand,
    AdminCreateUserCommand,
    AdminAddUserToGroupCommand,
    UpdateUserPoolCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { SNSClient, SubscribeCommand } = require('@aws-sdk/client-sns');
import https from 'https'

const cognitoClient = new CognitoIdentityProviderClient();
const snsClient = new SNSClient();

exports.handler = async (event, context) => {
    const responseUrl = event.ResponseURL;
    let status = 'SUCCESS';
    const responseData = {};

    try {
        if (event.RequestType === 'Delete') {
            await sendResponse(responseUrl, event, context, status, responseData);
            return;
        }

        const userPoolId = event.ResourceProperties.UserPoolId;

        await addInviteMessageTemplate(event, userPoolId, responseData, context);
        await createAdminUser(event, userPoolId, responseData, context);

    } catch (error) {
        status = 'FAILED';
        console.error('Error:', error);
        responseData.Error = error.message;
    } finally {
        await sendResponse(responseUrl, event, context, status, responseData);
    }
};

const createAdminUser = async (event, userPoolId, responseData, context) => {
    const adminEmail = event.ResourceProperties.AdminEmail;
    const adminGroup = event.ResourceProperties.AdminGroup;
    const closedTaskTopicArn = event.ResourceProperties.ClosedTaskTopicArn;
    const taskCompleteTopicArn = event.ResourceProperties.TaskCompleteTopicArn;

    if (adminEmail && adminEmail.trim() !== 'None') {
        try {
            await cognitoClient.send(new AdminGetUserCommand({
                UserPoolId: userPoolId,
                Username: adminEmail,
            }));

            console.log(`User already exists: ${adminEmail}`);
            responseData.Message = `User already exists: ${adminEmail}`;
        } catch (error) {
            if (error.name === 'UserNotFoundException') {
                const userAttributes = [
                    { Name: 'email', Value: adminEmail },
                    { Name: 'email_verified', Value: 'true' },
                ];

                const temporaryPassword = generateTemporaryPassword(9);

                await cognitoClient.send(new AdminCreateUserCommand({
                    UserPoolId: userPoolId,
                    Username: adminEmail,
                    UserAttributes: userAttributes,
                    TemporaryPassword: temporaryPassword,
                    DesiredDeliveryMediums: ['EMAIL'],
                }));

                await cognitoClient.send(new AdminAddUserToGroupCommand({
                    UserPoolId: userPoolId,
                    Username: adminEmail,
                    GroupName: adminGroup,
                }));

                await subscribeToTopic(closedTaskTopicArn, adminEmail);
                await subscribeToTopic(taskCompleteTopicArn, adminEmail);

                console.log('Admin created successfully');
                responseData.Message = 'Admin created successfully';
            } else {
                throw error;
            }
        }
    }
};

const subscribeToTopic = async (topicArn, endpoint) => {
    await snsClient.send(new SubscribeCommand({
        TopicArn: topicArn,
        Protocol: 'email',
        Endpoint: endpoint,
    }));
};

const addInviteMessageTemplate = async (event, userPoolId, responseData, context) => {
    const domain = event.ResourceProperties.UserPoolDomain;
    const clientId = event.ResourceProperties.UserPoolClient;
    const frontendHost = event.ResourceProperties.ProdFrontendUrl;
    const region = event.ResourceProperties.Region;

    const emailMessage = `Hello {username}, Welcome to AetherTasks!

Your temporary password is {####}

Click here to sign in:
https://${domain}.auth.${region}.amazoncognito.com/login?client_id=${clientId}&response_type=code&redirect_uri=${frontendHost}

Ensure to subscribe to the SNS topics`;

    await cognitoClient.send(new UpdateUserPoolCommand({
        UserPoolId: userPoolId,
        AdminCreateUserConfig: {
            AllowAdminCreateUserOnly: true,
            InviteMessageTemplate: {
                EmailMessage: emailMessage,
                EmailSubject: 'Welcome to AetherTasks',
            },
        },
    }));

    console.log('UserPool updated successfully');
    responseData.Message = 'UserPool updated successfully';
};

// Function to send a response back to CloudFormation
const sendResponse = async (url, event, context, status, data) => {
    const responseBody = JSON.stringify({
        Status: status,
        Reason: `See the details in CloudWatch Log Stream: ${context.logStreamName}`,
        PhysicalResourceId: event.PhysicalResourceId || context.logStreamName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: data,
    });

    const parsedUrl = new URL(url);
    const options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'PUT',
        headers: {
            'Content-Type': '',
            'Content-Length': responseBody.length,
        },
    };

    const request = https.request(options, (response) => {
        console.log(`Status code: ${response.statusCode}`);
        console.log(`Status message: ${response.statusMessage}`);
    });

    request.on('error', (error) => {
        console.error('sendResponse Error:', error);
    });

    request.write(responseBody);
    request.end();
};

// Function to generate a temporary password
const generateTemporaryPassword = (length) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * charset.length);
        password += charset[randomIndex];
    }
    return password;
};
