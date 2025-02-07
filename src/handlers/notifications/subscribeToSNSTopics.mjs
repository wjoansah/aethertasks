import {SNSClient, SubscribeCommand} from '@aws-sdk/client-sns'

const snsClient = new SNSClient();

export const handler = async (event) => {
    const topicArn = event['TopicArn']
    const email = event['Email']

    console.log(`Subscribing ${email} to ${topicArn}`)
    const filterPolicies = {
        responsibility: [email],
        email: [email]
    }

    const params = {
        Protocol: "email",
        TopicArn: topicArn,
        Endpoint: email,
        Attributes: {
            FilterPolicy: JSON.stringify(filterPolicies),
        }
    }

    try {
        await snsClient.send(new SubscribeCommand(params))
        return {
            statusCode: 200,
            body: JSON.stringify(
                {"message": `Successfully subscribed ${email} to ${topicArn}`}
            )
        }

    } catch (error) {
        console.error(error)
        return {
            statusCode: 500,
            body: JSON.stringify({message: "Failed to subscribe user to sns topic."})
        }
    }
}