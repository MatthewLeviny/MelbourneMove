import { AmplifyClient, UpdateAppCommand, GetAppCommand } from "@aws-sdk/client-amplify";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const amplify = new AmplifyClient({ region: process.env.AWS_REGION_NAME });
const sns = new SNSClient({ region: process.env.AWS_REGION_NAME });

export async function handler(event) {
  const appId = process.env.AMPLIFY_APP_ID;
  const snsTopicArn = process.env.SNS_TOPIC_ARN;

  // Check if this is the 100% threshold (actual overage)
  const message = event.Records?.[0]?.Sns?.Message || "";
  if (!message.includes("ACTUAL") || !message.includes("100%")) {
    console.log("Budget alert received, below 100% threshold — no action taken");
    return { statusCode: 200, body: "Alert noted, no action taken" };
  }

  try {
    await amplify.send(new GetAppCommand({ appId }));

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

    console.log("Kill switch activated — Amplify app disabled");

    await sns.send(
      new PublishCommand({
        TopicArn: snsTopicArn,
        Subject: "MelbourneMove KILL SWITCH ACTIVATED",
        Message: [
          "The MelbourneMove Amplify app has been automatically disabled because the AWS budget threshold was exceeded.",
          "",
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
    console.error("Kill switch failed:", error.name);
    throw error;
  }
}
