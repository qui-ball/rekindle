# Database Migrations

This directory contains SQL migration files for database schema changes.

## How to Apply Migrations

### Development (Automatic)

Migrations are automatically applied when you run `./dev start` or `./dev https`. The development script runs all migrations in order.

### Production / AWS RDS (Manual)

For production RDS databases, you need to run migrations manually:

#### Option 1: Using the Migration Script (Recommended)

```bash
# Set your DATABASE_URL (or load from .env)
export DATABASE_URL='postgresql://user:password@rds-host:5432/database'

# Run the migration script
./scripts/apply-rds-migrations.sh
```

The script will:
- ✅ Test database connectivity
- ✅ Create base tables (jobs, restore_attempts, animation_attempts)
- ✅ Apply all migrations in order
- ✅ Handle errors gracefully (safe to re-run)

#### Option 2: Manual Application

1. Connect to your RDS database:
   ```bash
   psql -h your-rds-endpoint.region.rds.amazonaws.com \
        -p 5432 \
        -U your_username \
        -d your_database
   ```

2. Run migrations in order:
   ```bash
   # From the project root
   psql -h your-rds-endpoint.region.rds.amazonaws.com \
        -p 5432 \
        -U your_username \
        -d your_database \
        -f backend/migrations/001_add_thumbnail_s3_key.sql
   
   psql -h your-rds-endpoint.region.rds.amazonaws.com \
        -p 5432 \
        -U your_username \
        -d your_database \
        -f backend/migrations/002_ensure_thumbnail_consistency.sql
   
   psql -h your-rds-endpoint.region.rds.amazonaws.com \
        -p 5432 \
        -U your_username \
        -d your_database \
        -f backend/migrations/003_create_photos_table.sql
   
   psql -h your-rds-endpoint.region.rds.amazonaws.com \
        -p 5432 \
        -U your_username \
        -d your_database \
        -f backend/migrations/004_create_users_table.sql
   ```

#### Prerequisites for RDS

1. **PostgreSQL Extension**: Ensure `pgcrypto` extension is available
   - Most RDS PostgreSQL instances have this enabled by default
   - If needed, enable it: `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`

2. **Network Access**: Ensure your IP is allowed in RDS security group
   - Add your IP to the inbound rules for PostgreSQL (port 5432)

3. **Database Credentials**: Have your RDS master username and password ready
   - Or use IAM database authentication if configured

#### Using Docker (Alternative)

If you have Docker but not local psql:
```bash
docker run --rm -it \
  -v "$(pwd)/backend/migrations:/migrations" \
  -e PGPASSWORD=your_password \
  postgres:15 \
  psql -h your-rds-endpoint.region.rds.amazonaws.com \
       -p 5432 \
       -U your_username \
       -d your_database \
       -f /migrations/001_add_thumbnail_s3_key.sql
```

## Migration History

- **001_add_thumbnail_s3_key.sql** - Add thumbnail_s3_key column to jobs table for performance optimization
  - Adds nullable VARCHAR column to store S3 thumbnail paths
  - Creates index for faster lookups
  - Safe to run on existing databases (nullable field)

- **002_ensure_thumbnail_consistency.sql** - Ensure thumbnail data consistency
  - Adds NOT NULL constraint to thumbnail_s3_key
  - Adds check constraint for thumbnail format
  - Safe to run on existing databases

- **003_create_photos_table.sql** - Create photos table for per-user storage isolation
  - Introduces photos table with owner-scoped constraints and metadata
  - Creates indexes for performance
  - Safe to run on existing databases

- **004_create_users_table.sql** - Create users table with Supabase linkage
  - Introduces users table with Supabase linkage and subscription metadata
  - Creates indexes and triggers for automatic timestamp updates
  - Safe to run on existing databases

