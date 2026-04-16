terraform {
  required_version = ">= 1.0"

  backend "s3" {
    bucket         = "melbournemove-tfstate"
    key            = "infra/terraform.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "melbournemove-tflock"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "MelbourneMove"
      ManagedBy   = "Terraform"
      Environment = "production"
    }
  }
}

# SNS topic for budget alerts
resource "aws_sns_topic" "budget_alert" {
  name = "melbournemove-budget-alert"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.budget_alert.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# Budget with alerts at 50%, 80%, and 100% (100% triggers Lambda)
resource "aws_budgets_budget" "monthly" {
  name         = "melbournemove-monthly"
  budget_type  = "COST"
  limit_amount = var.budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 50
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.budget_alert.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.budget_alert.arn]
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_sns_topic_arns = [aws_sns_topic.budget_alert.arn]
  }
}

# IAM role for the kill-switch Lambda
resource "aws_iam_role" "kill_switch" {
  name = "melbournemove-kill-switch"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "kill_switch" {
  name = "melbournemove-kill-switch"
  role = aws_iam_role.kill_switch.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "amplify:UpdateApp",
          "amplify:StopJob",
          "amplify:ListJobs",
          "amplify:GetApp"
        ]
        Resource = "arn:aws:amplify:${var.aws_region}:*:apps/${var.amplify_app_id}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "amplify:UpdateApp",
          "amplify:GetApp"
        ]
        Resource = "arn:aws:amplify:${var.aws_region}:*:apps/${var.amplify_app_id}"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/melbournemove-kill-switch:*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.budget_alert.arn
      }
    ]
  })
}

# Lambda function
data "archive_file" "kill_switch" {
  type        = "zip"
  source_file = "${path.module}/lambda/index.mjs"
  output_path = "${path.module}/lambda/kill-switch.zip"
}

resource "aws_lambda_function" "kill_switch" {
  filename         = data.archive_file.kill_switch.output_path
  function_name    = "melbournemove-kill-switch"
  role             = aws_iam_role.kill_switch.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.kill_switch.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 30

  environment {
    variables = {
      AMPLIFY_APP_ID   = var.amplify_app_id
      BRANCH_NAME      = var.amplify_branch_name
      SNS_TOPIC_ARN    = aws_sns_topic.budget_alert.arn
      AWS_REGION_NAME  = var.aws_region
    }
  }
}

# Allow SNS to invoke the Lambda
resource "aws_lambda_permission" "sns" {
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.kill_switch.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.budget_alert.arn
}

# Subscribe Lambda to the SNS topic
resource "aws_sns_topic_subscription" "lambda" {
  topic_arn = aws_sns_topic.budget_alert.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.kill_switch.arn
}
