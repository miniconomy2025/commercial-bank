resource "aws_db_subnet_group" "db_subnet_group" {
  name       = "commercial_bank_subnet_group_db"
  subnet_ids = [aws_subnet.default_subnet.id, aws_subnet.second_subnet.id]
}

resource "aws_db_instance" "database" {
  identifier             = "commercial-bank-db-instance"
  instance_class         = "db.t3.micro"
  allocated_storage      = 5
  engine                 = "postgres"
  engine_version         = "17.2"
  skip_final_snapshot    = true
  publicly_accessible    = true
  vpc_security_group_ids = [aws_security_group.db_security_group.id]
  db_subnet_group_name   = aws_db_subnet_group.db_subnet_group.name
  username               = var.db_username
  password               = var.db_password
  db_name = var.db_name
}
