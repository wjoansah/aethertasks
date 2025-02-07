import {
    CognitoIdentityProviderClient,
    AdminGetUserCommand,
    AdminCreateUserCommand,
    UpdateUserPoolCommand,
    AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {SFNClient, StartExecutionCommand} from "@aws-sdk/client-sfn";

const sfnClient = new SFNClient({});
const cognitoClient = new CognitoIdentityProviderClient();

export const handler = async (event, context) => {
    const responseUrl = event.ResponseURL;
    let status = 'SUCCESS';
    const responseData = {};

    try {
        if (event.RequestType === 'Delete') {
            await sendResponse(responseUrl, event, context, status, responseData);
            return;
        }

        await updateUserPoolConfig(event, responseData)
        await createAdminUser(event, responseData, context);

    } catch (error) {
        status = 'FAILED';
        console.error('Error:', error);
        responseData.Error = error.message;
    } finally {
        console.log("----------------------SENDING RESPONSE TO CLOUDFORMATION-------------------")
        await sendResponse(responseUrl, event, context, status, responseData);
    }
};

const createAdminUser = async (event, responseData, context) => {
    const adminEmail = event.ResourceProperties.AdminEmail;
    const userPoolId = event.ResourceProperties.UserPoolId;

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
                    {Name: 'email', Value: adminEmail},
                    {Name: 'email_verified', Value: 'true'},
                    {Name: 'custom:role', Value: 'admin'},
                ];

                const temporaryPassword = generateTemporaryPassword(16);

                await cognitoClient.send(new AdminCreateUserCommand({
                    UserPoolId: userPoolId,
                    Username: adminEmail,
                    UserAttributes: userAttributes,
                    TemporaryPassword: temporaryPassword,
                    DesiredDeliveryMediums: ['EMAIL'],
                }));

                await startUserOnboarding(event, adminEmail)

                await cognitoClient.send(new AdminAddUserToGroupCommand({
                    UserPoolId: userPoolId,
                    Username: adminEmail,
                    GroupName: event.ResourceProperties.AdminGroupName,
                }))

                console.log('Admin created successfully');
                responseData.Message = 'Admin created successfully';
            } else {
                throw error;
            }
        }
    }
};

const startUserOnboarding = async (event, userEmail) => {
    const stateMachineArn = event.ResourceProperties.StateMachineArn
    const input = `{"workflowType":"admin-onboarding","userEmail":"${userEmail}"}"}`

    const command = new StartExecutionCommand({
        stateMachineArn,
        input
    })

    try {
        await sfnClient.send(command)
    } catch (error) {
        console.error(error)
    }
}


const updateUserPoolConfig = async (event, responseData) => {
    const userPoolId = event.ResourceProperties.UserPoolId;

    const domain = event.ResourceProperties.UserPoolDomain;
    const clientId = event.ResourceProperties.UserPoolClient;
    const frontendHost = event.ResourceProperties.ProdFrontendUrl;
    const region = event.ResourceProperties.Region;

    const emailMessage = `<!doctypehtml><meta charset=UTF-8><title>Welcome to AetherTasks</title><body style=font-family:Arial,sans-serif;line-height:1.6;color:#333><p>Hello {username},<p>Welcome to <strong>AetherTasks</strong>! We're excited to have you on board.<p><strong>Your temporary password:</strong> <code>{####}</code><p>To get started, sign in using the link below:<p><a href="https://${domain}.auth.${region}.amazoncognito.com/login?client_id=${clientId}&response_type=code&redirect_uri=${frontendHost}"style="display:inline-block;padding:10px 15px;background-color:#007bff;color:#fff;text-decoration:none;border-radius:5px">Sign In</a><p>For the best experience, ensure you subscribe to email notifications.<p>If you have any questions, feel free to reach out to our support team.<p>Best Regards,<br><strong>AetherTasks Team</strong>`;

    await cognitoClient.send(new UpdateUserPoolCommand({
        UserPoolId: userPoolId,
        AdminCreateUserConfig: {
            AllowAdminCreateUserOnly: true,
            InviteMessageTemplate: {
                EmailMessage: emailMessage,
                EmailSubject: 'Welcome to AetherTasks!',
            },
        },
    }))

    console.log('UserPool Config updated successfully');
    responseData.Message = 'UserPool Config updated successfully';
}

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

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': '',
                'Content-Length': responseBody.length,
            },
            body: responseBody
        })
        if (!response.ok) {
            console.error(`Failed to send response to CloudFormation: ${response.statusText}`);
        }
        console.log(`Status code: ${response.status}`);
    } catch (e) {
        console.error('Failed to send response to Cloudformation with error: ', e);
    }
};

const generateTemporaryPassword = (length) => {
    return generatePassword(length)
};

function generatePassword(length) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

    // Ensure the password contains at least one character from each category
    const allCharacters = uppercase + lowercase + numbers + symbols;
    let password = [
        uppercase[Math.floor(Math.random() * uppercase.length)],
        lowercase[Math.floor(Math.random() * lowercase.length)],
        numbers[Math.floor(Math.random() * numbers.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
    ];

    // Fill the remaining length of the password
    for (let i = password.length; i < length; i++) {
        password.push(allCharacters[Math.floor(Math.random() * allCharacters.length)]);
    }

    // Shuffle the password array to ensure randomness
    return password
        .sort(() => Math.random() - 0.5)
        .join('');
}
