variable "db_password" {
  type    = string
  default = "changeme123" # committed default: a hardcoded credential
}

variable "public_lb" {
  type    = bool
  default = false
}

variable "region" {
  type = string # no default: unknown
}
