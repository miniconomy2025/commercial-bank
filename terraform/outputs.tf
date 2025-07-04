output "ec2_endpoint" {
  value = aws_instance.app_server.public_dns
}

output "db_endpoint" {
  value = aws_db_instance.database.endpoint
}


