# Database Migrations

This directory contains SQL migration files for database schema changes.

## How to Apply Migrations

1. Connect to your PostgreSQL database
2. Run the SQL file in order (prefixed with sequential numbers)

Example:
```bash
psql -U username -d database_name -f 001_add_thumbnail_s3_key.sql
```

Or using Docker:
```bash
docker exec -i postgres_container psql -U user -d dbname < 001_add_thumbnail_s3_key.sql
```

## Migration History

- **001_add_thumbnail_s3_key.sql** - Add thumbnail_s3_key column to jobs table for performance optimization
  - Adds nullable VARCHAR column to store S3 thumbnail paths
  - Creates index for faster lookups
  - Safe to run on existing databases (nullable field)

