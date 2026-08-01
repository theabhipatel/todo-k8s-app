resource "local_file" "ansible_inventory" {
  content = <<-EOT
[k3s_controller]
${aws_eip.main.public_ip} ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/usEast-1-key.pem

[k3s_workers]
%{for worker in aws_instance.workers~}
${worker.public_ip} ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/usEast-1-key.pem
%{endfor~}
EOT

  filename = "${path.module}/../ansible/inventory.ini"
}