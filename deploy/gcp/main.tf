terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  backend "gcs" {
    bucket = "holaprime-tf-state"
    prefix = "admin-panel"
  }
}

variable "project_id" { default = "holaprime-prod" }
variable "region"     { default = "us-central1" }
variable "db_password" { sensitive = true }

provider "google" {
  project = var.project_id
  region  = var.region
}

# ── Cloud SQL (PostgreSQL 16) ──────────────────────────────────────────────────
resource "google_sql_database_instance" "postgres" {
  name             = "holaprime-admin-db"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = "db-custom-2-7680"  # 2 vCPU, 7.5GB — scale up as needed
    availability_type = "REGIONAL"          # HA with automatic failover
    disk_autoresize   = true
    disk_size         = 50

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      retained_backups               = 14
    }

    insights_config {
      query_insights_enabled = true
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "holaprime" {
  name     = "holaprime"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "holaprime" {
  name     = "holaprime"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

# ── Memorystore (Redis 7) ──────────────────────────────────────────────────────
resource "google_redis_instance" "cache" {
  name           = "holaprime-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = 2
  region         = var.region
  redis_version  = "REDIS_7_0"

  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"
}

# ── GCS Bucket for KYC documents ──────────────────────────────────────────────
resource "google_storage_bucket" "kyc_docs" {
  name          = "holaprime-kyc-docs"
  location      = var.region
  force_destroy = false

  versioning { enabled = true }

  lifecycle_rule {
    condition { age = 2555 }  # 7 years retention
    action    { type = "Delete" }
  }

  uniform_bucket_level_access = true

  cors {
    origin          = ["https://admin.holaprimemarkets.com"]
    method          = ["GET"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}

# ── Secret Manager entries (values set manually, not in tf) ────────────────────
resource "google_secret_manager_secret" "db_url"       { secret_id = "holaprime-db-url";      replication { auto {} } }
resource "google_secret_manager_secret" "redis_url"    { secret_id = "holaprime-redis-url";   replication { auto {} } }
resource "google_secret_manager_secret" "jwt_secret"   { secret_id = "holaprime-jwt-secret";  replication { auto {} } }
resource "google_secret_manager_secret" "jwt_refresh"  { secret_id = "holaprime-jwt-refresh"; replication { auto {} } }
