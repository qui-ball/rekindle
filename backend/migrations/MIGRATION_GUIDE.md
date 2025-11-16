# Database Migration Guide

## Overview

This project uses **SQL migration files** for database schema changes. Migrations are automatically applied when you start the development environment.

## Automatic Migration Application

**Migrations are automatically applied** when you run:
```bash
./dev start
```

The `dev-docker.sh` script calls `scripts/apply-migrations.sh` which applies all migrations in order.

## Manual Migration Application

If you need to apply migrations manually:

### Using Docker Compose
```bash
# Apply all migrations
./scripts/apply-migrations.sh

# Or apply a specific migration
docker compose exec -T postgres psql -U rekindle -d rekindle < backend/migrations/005_add_deletion_fields.sql
```

### Direct PostgreSQL Connection
```bash
# Using psql
psql $DATABASE_URL -f backend/migrations/005_add_deletion_fields.sql

# Or with connection details
psql -U rekindle -d rekindle -h localhost -p 5432 -f backend/migrations/005_add_deletion_fields.sql
```

## Migration Files

Migrations are numbered sequentially and applied in order:

- `001_add_thumbnail_s3_key.sql` - Add thumbnail column to jobs
- `002_ensure_thumbnail_consistency.sql` - Ensure thumbnail consistency
- `003_create_photos_table.sql` - Create photos table
- `004_create_users_table.sql` - Create users table
- `005_add_deletion_fields.sql` - Add deletion task ID and archive fields

## Migration Best Practices

1. **Always use IF NOT EXISTS** - Makes migrations idempotent
2. **Number sequentially** - Use `001_`, `002_`, etc. prefix
3. **Test migrations** - Test on a copy of production data
4. **Document changes** - Include description in SQL comments
5. **Make reversible** - Consider creating down migrations

## Migration Tracking (Future Enhancement)

Currently, migrations don't track which ones have been applied. For production, consider:

1. **Migration tracking table** - Store applied migration names/timestamps
2. **Alembic** - Python migration tool with built-in tracking
3. **Flyway** - Java-based migration tool

## Troubleshooting

### "Column already exists" errors
This is **safe to ignore** - it means the migration was already applied.

### "Table does not exist" errors
Make sure you've applied migrations in order. Earlier migrations create tables that later ones depend on.

### Migration fails partway through
1. Check the error message
2. Fix the migration SQL
3. Manually fix the database state if needed
4. Re-run the migration

## For New Developers

When setting up your local environment:

1. **First time setup:**
   ```bash
   ./dev start
   ```
   This automatically applies all migrations.

2. **If migrations fail:**
   - Check Docker logs: `docker compose logs postgres`
   - Manually apply: `./scripts/apply-migrations.sh`
   - Check database state: `docker compose exec postgres psql -U rekindle -d rekindle -c "\dt"`

3. **After pulling new migrations:**
   ```bash
   ./dev start  # Automatically applies new migrations
   # Or manually:
   ./scripts/apply-migrations.sh
   ```

## Production Deployment

For production, migrations should be applied as part of your deployment process:

1. **Before deploying code** - Apply migrations
2. **Rollback plan** - Have a way to rollback migrations if needed
3. **Backup first** - Always backup database before migrations
4. **Test in staging** - Test migrations in staging environment first

