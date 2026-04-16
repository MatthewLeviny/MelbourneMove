import { AmplifyClient, UpdateAppCommand, GetAppCommand } from "@aws-sdk/client-amplify";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const amplify = new AmplifyClient({ region: process.env.AWS_REGION_NAME });
const sns = new SNSClient({ region: process.env.AWS_REGION_NAME });

export async function handler(event) {
  const appId = process.env.AMPLIFY_APP_ID;
  const snsTopicArn = process.env.SNS_TOPIC_ARN;

  console.log("Budget alert received:", JSON.stringify(event));

  // Check if this is the 100% threshold (actual overage)
  const message = event.Records?.[0]?.Sns?.Message || "";
  if (!message.includes("ACTUAL") || !message.includes("100%")) {
    console.log("Not a 100% actual threshold alert, skipping kill switch. Message:", message);
    return { statusCode: 200, body: "Alert noted, no action taken (below 100%)" };
  }

  try {
    // Check current app state
    const app = await amplify.send(new GetAppCommand({ appId }));
    console.log("Current app platform:", app.app.platform);

    // Disable auto branch creation and set a custom rule to block all traffic
    await amplify.send(
      new UpdateAppCommand({
        appId,
        enableBranchAutoBuild: false,
        customRules: [
          {
            source: "/<*>",
            target: "/index.html",
            status: "503",
          },
        ],
      })
    );

    console.log("Amplify app disabled successfully");

    // Notify via SNS
    await sns.send(
      new PublishCommand({
        TopicArn: snsTopicArn,
        Subject: "MelbourneMove KILL SWITCH ACTIVATED",
        Message: [
          "The MelbourneMove Amplify app has been automatically disabled because the AWS budget threshold was exceeded.",
          "",
          `App ID: ${appId}`,
          `Time: ${new Date().toISOString()}`,
          "",
          "To re-enable:",
          "1. Go to AWS Amplify Console",
          "2. Remove the 503 custom rule",
          "3. Re-enable auto branch builds",
          "",
          "Or run: terraform apply (after checking your billing)",
        ].join("\n"),
      })
    );

    return { statusCode: 200, body: "App disabled" };
  } catch (error) {
    console.error("Failed to disable app:", error);
    throw error;
  }
}
