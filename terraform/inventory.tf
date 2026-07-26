resource "local_file" "ansible_inventory" {
  content = <<-EOT
[k3s_server]
${aws_eip.main.public_ip} ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/usEast-1-key.pem
EOT

  filename = "${path.module}/../ansible/inventory.ini"
}