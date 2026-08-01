variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "controller_instance_type" {
  description = "EC2 instance type for the controller"
  type        = string
  default     = "t3.large"
}

variable "worker_instance_type" {
  description = "EC2 instance type for worker nodes"
  type        = string
  default     = "t3.large"
}

variable "worker_count" {
  description = "Number of Kubernetes worker nodes"
  type        = number
  default     = 2
}

variable "key_name" {
  description = "Existing AWS Key Pair name"
  type        = string
}

variable "my_ip" {
  description = "Your public IP with /32"
  type        = string
}

# ====> Cloudflare Configuration
variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for theabhipatel.com"
  type        = string
}

variable "cloudflare_api_token" {
  description = "Cloudflare API Token"
  type        = string
  sensitive   = true
}