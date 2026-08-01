output "controller_instance_id" {
  value = aws_instance.controller.id
}

output "controller_public_ip" {
  value = aws_eip.main.public_ip
}

output "controller_public_dns" {
  value = aws_instance.controller.public_dns
}

output "worker_instance_ids" {
  value = aws_instance.workers[*].id
}

output "worker_public_ips" {
  value = aws_instance.workers[*].public_ip
}

output "worker_private_ips" {
  value = aws_instance.workers[*].private_ip
}