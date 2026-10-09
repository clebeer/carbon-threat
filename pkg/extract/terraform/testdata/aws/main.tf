locals {
  env  = "prod"
  name = "shop-${local.env}"
}

module "vpc" {
  source = "./modules/vpc"
}

resource "aws_security_group" "db" {
  name = "${local.name}-db"
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "web" {
  name = "${local.name}-web"
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.web.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
}

resource "aws_db_instance" "orders" {
  engine                 = "postgres"
  instance_class         = "db.t4g.micro"
  publicly_accessible    = true
  password               = var.db_password
  vpc_security_group_ids = [aws_security_group.db.id]
}

resource "aws_db_instance" "replica" {
  count               = 0
  engine              = "postgres"
  replicate_source_db = aws_db_instance.orders.identifier
}

resource "aws_s3_bucket" "uploads" {
  bucket = "${local.name}-uploads"
}

resource "aws_s3_bucket_acl" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  acl    = "public-read"
}

resource "aws_s3_bucket" "assets" {
  bucket = "${local.name}-assets"
  acl    = "public-read"
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "sessions" {
  name     = "${local.name}-sessions"
  hash_key = "id"
}

resource "aws_elasticache_replication_group" "cache" {
  replication_group_id = "${local.name}-cache"
  description          = "sessions"
}

resource "aws_lambda_function" "api" {
  function_name = "${local.name}-api"
  runtime       = "nodejs22.x"
  environment {
    variables = {
      TABLE   = aws_dynamodb_table.sessions.name
      BUCKET  = aws_s3_bucket.uploads.id
      DB_HOST = aws_db_instance.orders.address
      API_KEY = "sk_live_abc123"
    }
  }
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${local.name}-http"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_route" "orders" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /orders"
}

resource "aws_apigatewayv2_integration" "api" {
  api_id           = aws_apigatewayv2_api.http.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.api.invoke_arn
}

resource "aws_instance" "web" {
  ami                         = "ami-123"
  associate_public_ip_address = true
  vpc_security_group_ids      = [aws_security_group.web.id]
  user_data                   = "CACHE=${aws_elasticache_replication_group.cache.primary_endpoint_address}"
}

resource "aws_lb" "web" {
  internal = !var.public_lb
}

resource "aws_lb_target_group" "web" {
  port     = 80
  protocol = "HTTP"
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.web.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_lb_target_group_attachment" "web" {
  target_group_arn = aws_lb_target_group.web.arn
  target_id        = aws_instance.web.id
}
