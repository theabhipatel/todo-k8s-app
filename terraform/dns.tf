resource "cloudflare_dns_record" "todo" {
  zone_id = var.cloudflare_zone_id
  name    = "todo.theabhipatel.com"
  type    = "A"
  content = aws_eip.main.public_ip
  ttl     = 1
  proxied = false
}

resource "cloudflare_dns_record" "todo_api" {
  zone_id = var.cloudflare_zone_id
  name    = "api.todo.theabhipatel.com"
  type    = "A"
  content = aws_eip.main.public_ip
  ttl     = 1
  proxied = false
}

resource "cloudflare_dns_record" "grafana" {
  zone_id = var.cloudflare_zone_id
  name    = "grafana.todo.theabhipatel.com"
  type    = "A"
  content = aws_eip.main.public_ip
  ttl     = 1
  proxied = false
}