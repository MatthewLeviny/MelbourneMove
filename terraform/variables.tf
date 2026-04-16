variable "alert_email" {
  description = "Email address for budget and kill-switch notifications"
  type        = string
}

variable "amplify_app_id" {
  description = "Amplify App ID (from Amplify Console → App settings → General)"
  type        = string
}

variable "amplify_branch_name" {
  description = "Amplify branch name to disable when budget is exceeded"
  type        = string
  default     = "main"
}

variable "budget_limit" {
  description = "Monthly budget limit in USD that triggers the kill switch"
  type        = string
  default     = "0.65"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-2"
}
