variable "function_name" {
  description = "Full Lambda function name (already prefixed with qulene-{env}-)"
  type        = string
}

variable "handler" {
  description = "Handler entrypoint"
  type        = string
  default     = "index.handler"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs20.x"
}

variable "package_path" {
  description = "Path to the Lambda deployment ZIP file"
  type        = string
}

variable "environment_variables" {
  description = "Environment variables injected into the Lambda runtime"
  type        = map(string)
  default     = {}
}

variable "memory_size" {
  description = "Lambda memory in MB"
  type        = number
  default     = 256
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 30
}
