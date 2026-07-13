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