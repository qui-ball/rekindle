#!/bin/bash

# Script to verify database migrations on AWS RDS
# Usage: ./scripts/verify-rds-migrations.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/backend/.env"

# Load DATABASE_URL from .env file if not already set
if [ -z "$DATABASE_URL" ]; then
    if [ -f "$ENV_FILE" ]; then
        echo "📝 Loading DATABASE_URL from backend/.env..."
        DATABASE_URL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f2- | sed 's/^["'\'']//; s/["'\'']$//' | head -1)
        
        if [ -z "$DATABASE_URL" ]; then
            echo "❌ Error: DATABASE_URL not found in backend/.env"
            exit 1
        fi
        echo "✅ Found DATABASE_URL in backend/.env"
    else
        echo "❌ Error: DATABASE_URL environment variable is not set and backend/.env file not found"
        exit 1
    fi
fi

# Parse DATABASE_URL
DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)"
if [[ ! $DATABASE_URL =~ $DB_URL_REGEX ]]; then
    echo "❌ Error: Invalid DATABASE_URL format"
    exit 1
fi

DB_USER="${BASH_REMATCH[1]}"
DB_PASS="${BASH_REMATCH[2]}"
DB_HOST="${BASH_REMATCH[3]}"
DB_PORT="${BASH_REMATCH[4]}"
DB_NAME="${BASH_REMATCH[5]}"

echo "🗄️  Verifying database migrations on RDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check for available PostgreSQL client
USE_DOCKER=false
USE_PYTHON=false

if command -v psql &> /dev/null && psql --version > /dev/null 2>&1; then
    PSQL_CMD="psql"
elif command -v docker &> /dev/null && docker ps > /dev/null 2>&1; then
    USE_DOCKER=true
    echo "✅ Using Docker PostgreSQL client"
elif command -v python3 &> /dev/null && python3 -c "import psycopg2" 2>/dev/null; then
    USE_PYTHON=true
    echo "✅ Using Python with psycopg2"
else
    echo "❌ Error: No PostgreSQL client available"
    echo "Please install postgresql-client or ensure Docker is available"
    exit 1
fi

# Verification queries
echo "📋 Checking database schema..."
echo ""

# Function to run query and display results
run_query() {
    local query="$1"
    local description="$2"
    
    if [ "$USE_DOCKER" = true ]; then
        echo "$query" | docker run --rm -i -e PGPASSWORD="$DB_PASS" postgres:15 psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A
    elif [ "$USE_PYTHON" = true ]; then
        python3 << PYEOF
import psycopg2
from urllib.parse import urlparse
import sys

try:
    parsed = urlparse("$DATABASE_URL")
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        database=parsed.path.lstrip('/'),
        user=parsed.username,
        password=parsed.password
    )
    cur = conn.cursor()
    cur.execute("""$query""")
    results = cur.fetchall()
    for row in results:
        print('|'.join(str(cell) if cell is not None else '' for cell in row))
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
    else
        export PGPASSWORD="$DB_PASS"
        echo "$query" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A
        unset PGPASSWORD
    fi
}

# Check 1: Verify all expected tables exist
echo "1️⃣  Checking required tables..."
REQUIRED_TABLES=("jobs" "restore_attempts" "animation_attempts" "photos" "users")
MISSING_TABLES=()

for table in "${REQUIRED_TABLES[@]}"; do
    TABLE_CHECK=$(run_query "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table');" "")
    if [ "$TABLE_CHECK" = "t" ]; then
        echo "   ✅ $table table exists"
    else
        echo "   ❌ $table table MISSING"
        MISSING_TABLES+=("$table")
    fi
done

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    echo ""
    echo "⚠️  Missing tables: ${MISSING_TABLES[*]}"
    echo "   Run migrations: ./scripts/apply-rds-migrations.sh"
else
    echo "   ✅ All required tables exist"
fi
echo ""

# Check 2: Verify pgcrypto extension
echo "2️⃣  Checking extensions..."
EXT_CHECK=$(run_query "SELECT EXISTS (SELECT FROM pg_extension WHERE extname = 'pgcrypto');" "")
if [ "$EXT_CHECK" = "t" ]; then
    echo "   ✅ pgcrypto extension installed"
else
    echo "   ❌ pgcrypto extension MISSING"
fi
echo ""

# Check 3: Verify users table structure
echo "3️⃣  Verifying users table structure..."
USERS_COLUMNS=$(run_query "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position;" "")
REQUIRED_USERS_COLUMNS=("id" "supabase_user_id" "email" "subscription_tier" "created_at")

if [ -n "$USERS_COLUMNS" ]; then
    echo "   ✅ users table exists"
    for col in "${REQUIRED_USERS_COLUMNS[@]}"; do
        if echo "$USERS_COLUMNS" | grep -q "^$col|"; then
            echo "      ✅ Column '$col' exists"
        else
            echo "      ❌ Column '$col' MISSING"
        fi
    done
else
    echo "   ❌ users table not found"
fi
echo ""

# Check 4: Verify photos table structure
echo "4️⃣  Verifying photos table structure..."
PHOTOS_COLUMNS=$(run_query "SELECT column_name FROM information_schema.columns WHERE table_name = 'photos' ORDER BY ordinal_position;" "")
REQUIRED_PHOTOS_COLUMNS=("id" "owner_id" "original_key" "status" "created_at")

if [ -n "$PHOTOS_COLUMNS" ]; then
    echo "   ✅ photos table exists"
    for col in "${REQUIRED_PHOTOS_COLUMNS[@]}"; do
        if echo "$PHOTOS_COLUMNS" | grep -q "^$col|"; then
            echo "      ✅ Column '$col' exists"
        else
            echo "      ❌ Column '$col' MISSING"
        fi
    done
else
    echo "   ❌ photos table not found"
fi
echo ""

# Check 5: Verify indexes
echo "5️⃣  Checking indexes..."
REQUIRED_INDEXES=(
    "idx_users_supabase_id"
    "idx_users_email"
    "idx_photos_owner_id"
    "idx_photos_owner_original_key"
)

for idx in "${REQUIRED_INDEXES[@]}"; do
    IDX_CHECK=$(run_query "SELECT EXISTS (SELECT FROM pg_indexes WHERE indexname = '$idx');" "")
    if [ "$IDX_CHECK" = "t" ]; then
        echo "   ✅ Index '$idx' exists"
    else
        echo "   ⚠️  Index '$idx' not found (may not be critical)"
    fi
done
echo ""

# Check 6: Verify constraints
echo "6️⃣  Checking constraints..."
CONSTRAINTS=$(run_query "SELECT constraint_name, table_name FROM information_schema.table_constraints WHERE table_name IN ('users', 'photos') AND constraint_type = 'UNIQUE' ORDER BY table_name, constraint_name;" "")

if [ -n "$CONSTRAINTS" ]; then
    echo "   ✅ Unique constraints found:"
    echo "$CONSTRAINTS" | while IFS='|' read -r constraint table; do
        echo "      - $constraint on $table"
    done
else
    echo "   ⚠️  No unique constraints found (may indicate migration issue)"
fi
echo ""

# Check 7: Table row counts (if any data exists)
echo "7️⃣  Checking table row counts..."
for table in "${REQUIRED_TABLES[@]}"; do
    COUNT=$(run_query "SELECT COUNT(*) FROM $table;" "" 2>/dev/null || echo "0")
    if [ -n "$COUNT" ] && [ "$COUNT" != "0" ]; then
        echo "   📊 $table: $COUNT rows"
    else
        echo "   📊 $table: 0 rows (empty - this is okay for new database)"
    fi
done
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ ${#MISSING_TABLES[@]} -eq 0 ]; then
    echo "✅ Migration verification complete!"
    echo "   All required tables and structures are in place."
else
    echo "⚠️  Migration verification found issues"
    echo "   Please run: ./scripts/apply-rds-migrations.sh"
    exit 1
fi
echo ""

