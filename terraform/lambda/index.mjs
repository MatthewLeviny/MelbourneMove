import { AmplifyClient, UpdateAppCommand, GetAppCommand, DeleteBranchCommand } from "@aws-sdk/client-amplify";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const amplify = new AmplifyClient({ region: process.env.AWS_REGION_NAME });
const sns = new SNSClient({ region: process.env.AWS_REGION_NAME });

export async function handler(event) {
  const appId = process.env.AMPLIFY_APP_ID;
  const branchName = process.env.BRANCH_NAME || "main";
  const snsTopicArn = process.env.SNS_TOPIC_ARN;

  // Check if this is the 100% threshold (actual overage)
  const message = event.Records?.[0]?.Sns?.Message || "";
  if (!message.includes("ACTUAL") || !message.includes("100%")) {
    console.log("Budget alert received, below 100% threshold — no action taken");
    return { statusCode: 200, body: "Alert noted, no action taken" };
  }

  try {
    await amplify.send(new GetAppCommand({ appId }));

    // Disable auto-build so branch doesn't redeploy when reconnected
    await amplify.send(
      new UpdateAppCommand({
        appId,
        enableBranchAutoBuild: false,
      })
    );

    // Delete the branch to stop serving traffic entirely
    await amplify.send(
      new DeleteBranchCommand({
        appId,
        branchName,
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
          "The 'main' branch has been deleted to stop serving traffic.",
          "",
          "To re-enable:",
          "1. Go to Amplify Console → Hosting → Branches",
          "2. Click 'Connect branch' and select 'main'",
          "3. App settings → General → re-enable auto branch builds",
          "4. Trigger a new deployment",
        ].join("\n"),
      })
    );

    return { statusCode: 200, body: "App disabled" };
  } catch (error) {
    console.error("Kill switch failed:", error.name);
    throw error;
  }
}
