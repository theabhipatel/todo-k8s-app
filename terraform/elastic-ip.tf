resource "aws_eip" "main" {
  domain = "vpc"

  tags = {
    Name = "todo-eip"
  }
}

resource "aws_eip_association" "main" {
  allocation_id = aws_eip.main.id
  instance_id   = aws_instance.main.id
}