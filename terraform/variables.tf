variable "aws_region" {
  description = "AWS Region"
  type        = string
}

variable "instance_type" {
  type    = string
  default = "t3.large"
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