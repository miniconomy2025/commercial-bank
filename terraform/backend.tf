# terraform backend
terraform {
  backend "s3" {
    bucket  = "levelup-commercial-bank-terraform-state"
    key     = "terraform.tfstate"
    region  = "af-south-1"
  }
}
