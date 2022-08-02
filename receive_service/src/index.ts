import AWS from 'aws-sdk';
import { Context, APIGatewayEvent } from 'aws-lambda';

import sesSend from "./ses";
import delete_msg from './delete_msg';


let dynamoDb = new AWS.DynamoDB.DocumentClient({region:"us-east-1"});

const handler = async function (event: APIGatewayEvent, context: Context) {
	console.log("event", event);
	const { Records } = event;

	for (let i = 0; i < Records.length; i++) {
		var record = Records[i];

		var params: AWS.DynamoDB.DocumentClient.GetItemInput = {
			TableName: 'sqsmessagedb',
			Key: {
				messageId: record.messageId
			}
		};

		let msgStatus = await dynamoDb.get(params).promise();
		console.log("message Status", msgStatus)

		if (msgStatus.Item && msgStatus.Item.emailSended == "false") {
			var formData = JSON.parse(record.body || '{}');

			try {
				await sesSend(formData);
				console.log("Success", { message: 'Email sended' });

				msgStatus.Item.emailSended = "true";
				let putParams: AWS.DynamoDB.DocumentClient.PutItemInput = {
					TableName: 'sqsmessagedb',
					Item: { ...msgStatus.Item }
				}
				await dynamoDb.put(putParams).promise();

				try {
					await delete_msg(record.receiptHandle);
					console.log("Success", { message: "Message removed from queue" });
				} catch (err) {
					console.error("error deleting message", err);
				}
			} catch (err) {
				console.error("error sending via ses", err);
			}
		}
	}

	return { Status: "finished", success: true };
};

export { handler };