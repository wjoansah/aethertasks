import crypto from 'node:crypto'
import {
    AdminAddUserToGroupCommand,
    AdminCreateUserCommand,
    CognitoIdentityProviderClient,
    DeliveryMediumType,
    ListUsersCommand
} from '@aws-sdk/client-cognito-identity-provider'
import {SFNClient, StartExecutionCommand} from "@aws-sdk/client-sfn";

const cognitoClient = new CognitoIdentityProviderClient({})
const sfnClient = new SFNClient({});

const USER_POOL_ID = process.env.USER_POOL_ID
const ADMIN_GROUP_NAME = process.env.ADMIN_GROUP_NAME
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN

export const handler = async (event, context) => {
    const routeKey = `${event['httpMethod']} ${event['resource']}`;
    let responseBody = {"message": "unsupported route"}
    let statusCode = 400;

    try {
        if (routeKey === "GET /users") {
            try {
                const command = new ListUsersCommand({UserPoolId: USER_POOL_ID})
                const response = await cognitoClient.send(command)
                const users = response.Users

                statusCode = response['$metadata'].httpStatusCode || 200;
                responseBody = {
                    message: "List of users retrieved successfully",
                    users,
                };
            } catch (err) {
                statusCode = 500;
                console.error(err)
            }
        }

        if (routeKey === "POST /users/invite") {
            const body = JSON.parse(event.body);
            const {name, email, role} = body

            const createUserRequest = {
                UserPoolId: USER_POOL_ID,
                Username: email,
                UserAttributes:
                    [{Name: "name", Value: name},
                        {Name: "email", Value: email},
                        {Name: "custom:role", Value: role},
                        {Name: "email_verified", Value: "true"}],
                TemporaryUserAttributes: generateTemporaryPassword(),
                DesiredDeliveryMediums: [DeliveryMediumType.EMAIL]
            }

            responseBody = await cognitoClient.send(new AdminCreateUserCommand(createUserRequest))

            if (role.toLowerCase() === 'admin') {
                await cognitoClient.send(new AdminAddUserToGroupCommand({
                    UserPoolId: USER_POOL_ID,
                    Username: email,
                    GroupName: ADMIN_GROUP_NAME,
                }));
            }

            await startUserOnboarding(role, email);

            statusCode = 201;
        }

    } catch (err) {
        statusCode = 400;
        responseBody = {"error": err};
        console.error(err)
    }

    return {
        statusCode,
        body: JSON.stringify(responseBody),
    }
}

const generateTemporaryPassword = () => {
    return crypto.randomBytes(64).toString("hex")
}

const startUserOnboarding = async (role, userEmail) => {
    const onBoardingType = role.toLowerCase() === 'admin' ? 'admin-' : ''
    const input = `{"workflowType":"${onBoardingType}onboarding","userEmail":"${userEmail}"}"}`
    const params = {
        stateMachineArn: STATE_MACHINE_ARN,
        input
    }
    const command = new StartExecutionCommand(params)

    try {
        await sfnClient.send(command)
    } catch (error) {
        console.error(error)
    }
}
