import crypto from 'node:crypto'
import {
    AdminCreateUserCommand,
    CognitoIdentityProviderClient,
    DeliveryMediumType,
    ListUsersCommand
} from '@aws-sdk/client-cognito-identity-provider'

const cognitoClient = new CognitoIdentityProviderClient({})

const USER_POOL_ID = process.env.USER_POOL_ID

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
