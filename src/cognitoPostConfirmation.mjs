import {AdminAddUserToGroupCommand, CognitoIdentityProviderClient,} from '@aws-sdk/client-cognito-identity-provider';
import {SFNClient, StartExecutionCommand} from "@aws-sdk/client-sfn";

const sfnClient = new SFNClient({});
const cognitoClient = new CognitoIdentityProviderClient();

const ADMIN_GROUP_NAME = process.env.ADMIN_GROUP_Name
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN

export const handler = async (event) => {
    const {'custom:role': role, email} = event.request.Attributes

    try {
        await startUserOnboarding(role, email);

        if (role === 'admin') {
            await cognitoClient.send(new AdminAddUserToGroupCommand({
                UserPoolId: event.UserPoolId,
                Username: email,
                GroupName: ADMIN_GROUP_NAME,
            }));
        }

        return event
    } catch (err) {
        console.log(err)
    }
}


const startUserOnboarding = async (role, userEmail) => {
    const onBoardingType = role === 'admin' ? 'admin-' : ''
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

