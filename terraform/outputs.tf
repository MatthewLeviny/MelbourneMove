output "sns_topic_arn" {
  description = "SNS topic ARN for budget alerts"
  value       = aws_sns_topic.budget_alert.arn
}

output "lambda_function_name" {
  description = "Kill switch Lambda function name"
  value       = aws_lambda_function.kill_switch.function_name
}

output "budget_name" {
  description = "AWS Budget name"
  value       = aws_budgets_budget.monthly.name
}
