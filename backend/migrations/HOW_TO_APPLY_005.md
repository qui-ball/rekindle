# How to Apply Migration 005: Add Deletion Fields

## Quick Answer

**If using Docker Compose (recommended):**
```bash
docker-compose exec postgres psql -U rekindle -d rekindle -f /app/migrations/005_add_deletion_fields.sql
```

**Or copy the file into the container:**
```bash
docker-compose exec -T postgres psql -U rekindle -d rekindle < backend/migrations/005_add_deletion_fields.sql
```

---

## Detailed Instructions

### Option 1: Using Docker Compose (Recommended)

If your database is running in Docker Compose:

```bash
# Make sure services are running
docker-compose ps

# Apply the migration
docker-compose exec postgres psql -U rekindle -d rekindle -f /app/migrations/005_add_deletion_fields.sql
```

**Note:** The file path `/app/migrations/005_add_deletion_fields.sql` assumes the migrations folder is mounted. If not, use Option 2.

### Option 2: Copy File into Container

If the migrations folder isn't mounted in the postgres container:

```bash
# Copy migration file into container
docker cp backend/migrations/005_add_deletion_fields.sql $(docker-compose ps -q postgres):/tmp/005_add_deletion_fields.sql

# Apply migration
docker-compose exec postgres psql -U rekindle -d rekindle -f /tmp/005_add_deletion_fields.sql
```

### Option 3: Pipe SQL File Directly

```bash
# Pipe the SQL file directly into psql
docker-compose exec -T postgres psql -U rekindle -d rekindle < backend/migrations/005_add_deletion_fields.sql
```

### Option 4: Direct PostgreSQL Connection (Not Using Docker)

If you're connecting to PostgreSQL directly (not via Docker):

```bash
# Using psql command line
psql -U rekindle -d rekindle -h localhost -p 5432 -f backend/migrations/005_add_deletion_fields.sql

# Or using connection string from .env
psql $DATABASE_URL -f backend/migrations/005_add_deletion_fields.sql
```

---

## Verify Migration Applied Successfully

After applying, verify the new columns exist:

```bash
# Check if columns were added
docker-compose exec postgres psql -U rekindle -d rekindle -c "\d users"
```

You should see:
- `deletion_task_id` (VARCHAR(255), nullable, indexed)
- `archived_at` (TIMESTAMP WITH TIME ZONE, nullable)

And the constraint should include `'archived'`:
```sql
CHECK (account_status IN ('active', 'suspended', 'deleted', 'archived'))
```

---

## Troubleshooting

### Error: "column already exists"
This means the migration was already applied. This is safe to ignore.

### Error: "relation does not exist"
Make sure you've run migrations 001-004 first, especially `004_create_users_table.sql`.

### Error: "permission denied"
Make sure you're using the correct database user (`rekindle`).

### Error: "could not connect to server"
Make sure Docker Compose services are running:
```bash
docker-compose up -d postgres
```

---

## What This Migration Does

1. ✅ Adds `deletion_task_id` column (stores Celery task ID for cancellation)
2. ✅ Adds `archived_at` column (tracks when account was archived)
3. ✅ Creates index on `deletion_task_id` for faster lookups
4. ✅ Updates `account_status` constraint to include `'archived'` status

**Safe to run:** Yes - all new columns are nullable, so existing data is unaffected.

