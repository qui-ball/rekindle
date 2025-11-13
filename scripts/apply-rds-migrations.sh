#!/bin/bash

# Script to apply database migrations to AWS RDS
# Usage: ./scripts/apply-rds-migrations.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/backend/migrations"
ENV_FILE="$PROJECT_ROOT/backend/.env"

# Load DATABASE_URL from .env file if not already set
if [ -z "$DATABASE_URL" ]; then
    if [ -f "$ENV_FILE" ]; then
        echo "📝 Loading DATABASE_URL from backend/.env..."
        # Extract DATABASE_URL from .env file (handles comments and empty lines)
        DATABASE_URL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" | cut -d '=' -f2- | sed 's/^["'\'']//; s/["'\'']$//' | head -1)
        
        if [ -z "$DATABASE_URL" ]; then
            echo "❌ Error: DATABASE_URL not found in backend/.env"
            echo ""
            echo "Please add DATABASE_URL to backend/.env or set it as an environment variable:"
            echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
            exit 1
        fi
        echo "✅ Found DATABASE_URL in backend/.env"
    else
        echo "❌ Error: DATABASE_URL environment variable is not set"
        echo "   and backend/.env file not found"
        echo ""
        echo "Please either:"
        echo "  1. Set DATABASE_URL as an environment variable:"
        echo "     export DATABASE_URL='postgresql://user:password@host:port/database'"
        echo ""
        echo "  2. Or add it to backend/.env:"
        echo "     DATABASE_URL=postgresql://user:password@host:port/database"
        exit 1
    fi
else
    echo "✅ Using DATABASE_URL from environment"
fi

# Parse DATABASE_URL to extract connection details
# Format: postgresql://user:password@host:port/database
DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+)"
if [[ ! $DATABASE_URL =~ $DB_URL_REGEX ]]; then
    echo "❌ Error: Invalid DATABASE_URL format"
    echo "Expected format: postgresql://user:password@host:port/database"
    exit 1
fi

DB_USER="${BASH_REMATCH[1]}"
DB_PASS="${BASH_REMATCH[2]}"
DB_HOST="${BASH_REMATCH[3]}"
DB_PORT="${BASH_REMATCH[4]}"
DB_NAME="${BASH_REMATCH[5]}"

echo "🗄️  Applying database migrations to RDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check for available PostgreSQL client (psql, Docker, or Python)
USE_DOCKER=false
USE_PYTHON=false
PSQL_CMD=""

if command -v psql &> /dev/null; then
    # Test if psql actually works (not just a wrapper)
    if psql --version > /dev/null 2>&1; then
        PSQL_CMD="psql"
        echo "✅ Using local psql client"
    fi
fi

# If psql doesn't work, try Docker
if [ -z "$PSQL_CMD" ] && command -v docker &> /dev/null; then
    if docker ps > /dev/null 2>&1; then
        USE_DOCKER=true
        PSQL_CMD="docker run --rm -i -e PGPASSWORD=$DB_PASS postgres:15 psql"
        echo "✅ Using Docker PostgreSQL client"
    fi
fi

# If neither works, try Python with psycopg2
if [ -z "$PSQL_CMD" ] && command -v python3 &> /dev/null; then
    if python3 -c "import psycopg2" 2>/dev/null; then
        USE_PYTHON=true
        echo "✅ Using Python with psycopg2"
    fi
fi

if [ -z "$PSQL_CMD" ] && [ "$USE_PYTHON" = false ]; then
    echo "❌ Error: No PostgreSQL client available"
    echo ""
    echo "Please install one of the following:"
    echo "  1. PostgreSQL client:"
    echo "     Ubuntu/Debian: sudo apt-get install postgresql-client-15"
    echo "     macOS:         brew install postgresql"
    echo "     Amazon Linux:  sudo yum install postgresql15"
    echo ""
    echo "  2. Or ensure Docker is available (script will use it automatically)"
    echo ""
    echo "  3. Or install Python psycopg2:"
    echo "     pip install psycopg2-binary"
    exit 1
fi

# Test database connection
echo "🔌 Testing database connection..."

if [ "$USE_PYTHON" = true ]; then
    # Test connection with Python
    python3 << PYEOF
import psycopg2
import sys
from urllib.parse import urlparse

try:
    parsed = urlparse("$DATABASE_URL")
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        database=parsed.path.lstrip('/'),
        user=parsed.username,
        password=parsed.password
    )
    conn.close()
    print("✅ Database connection successful")
    sys.exit(0)
except Exception as e:
    print(f"❌ Error: Cannot connect to database: {e}")
    print("Please verify:")
    print("  1. DATABASE_URL is correct")
    print("  2. RDS instance is accessible from your network")
    print("  3. Security group allows connections from your IP")
    print("  4. Database credentials are correct")
    sys.exit(1)
PYEOF
    if [ $? -ne 0 ]; then
        exit 1
    fi
else
    # Test connection with psql (local or Docker)
    export PGPASSWORD="$DB_PASS"
    if [ "$USE_DOCKER" = true ]; then
        if ! echo "SELECT 1;" | docker run --rm -i -e PGPASSWORD="$DB_PASS" postgres:15 psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
            echo "❌ Error: Cannot connect to database"
            echo "Please verify:"
            echo "  1. DATABASE_URL is correct"
            echo "  2. RDS instance is accessible from your network"
            echo "  3. Security group allows connections from your IP"
            echo "  4. Database credentials are correct"
            unset PGPASSWORD
            exit 1
        fi
    else
        if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
            echo "❌ Error: Cannot connect to database"
            echo "Please verify:"
            echo "  1. DATABASE_URL is correct"
            echo "  2. RDS instance is accessible from your network"
            echo "  3. Security group allows connections from your IP"
            echo "  4. Database credentials are correct"
            unset PGPASSWORD
            exit 1
        fi
    fi
    echo "✅ Database connection successful"
    unset PGPASSWORD
fi
echo ""

# Create base tables first (if they don't exist)
echo "📋 Creating base tables (jobs, restore_attempts, animation_attempts)..."

# Create temporary SQL file for base tables
BASE_TABLES_SQL=$(mktemp)
cat > "$BASE_TABLES_SQL" <<'EOFBASE'
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    selected_restore_id UUID,
    latest_animation_id UUID
);

CREATE TABLE IF NOT EXISTS restore_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id),
    s3_key VARCHAR(500),
    model VARCHAR(100),
    params JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS animation_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id),
    restore_id UUID REFERENCES restore_attempts(id),
    preview_s3_key VARCHAR(500),
    result_s3_key VARCHAR(500),
    thumb_s3_key VARCHAR(500),
    model VARCHAR(100),
    params JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
EOFBASE

if [ "$USE_DOCKER" = true ]; then
    docker run --rm -i -e PGPASSWORD="$DB_PASS" -v "$BASE_TABLES_SQL:/base_tables.sql:ro" postgres:15 psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /base_tables.sql > /dev/null 2>&1
elif [ "$USE_PYTHON" = true ]; then
    python3 << PYEOF
import psycopg2
from urllib.parse import urlparse

parsed = urlparse("$DATABASE_URL")
conn = psycopg2.connect(
    host=parsed.hostname,
    port=parsed.port or 5432,
    database=parsed.path.lstrip('/'),
    user=parsed.username,
    password=parsed.password
)
cur = conn.cursor()
cur.execute("""
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    selected_restore_id UUID,
    latest_animation_id UUID
);

CREATE TABLE IF NOT EXISTS restore_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id),
    s3_key VARCHAR(500),
    model VARCHAR(100),
    params JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS animation_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id),
    restore_id UUID REFERENCES restore_attempts(id),
    preview_s3_key VARCHAR(500),
    result_s3_key VARCHAR(500),
    thumb_s3_key VARCHAR(500),
    model VARCHAR(100),
    params JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
""")
conn.commit()
cur.close()
conn.close()
PYEOF
    > /dev/null 2>&1
else
    export PGPASSWORD="$DB_PASS"
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<'EOFBASE'
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    selected_restore_id UUID,
    latest_animation_id UUID
);

CREATE TABLE IF NOT EXISTS restore_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id),
    s3_key VARCHAR(500),
    model VARCHAR(100),
    params JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS animation_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id),
    restore_id UUID REFERENCES restore_attempts(id),
    preview_s3_key VARCHAR(500),
    result_s3_key VARCHAR(500),
    thumb_s3_key VARCHAR(500),
    model VARCHAR(100),
    params JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
EOFBASE
    > /dev/null 2>&1
    unset PGPASSWORD
fi

# Clean up temporary file
rm -f "$BASE_TABLES_SQL"

if [ $? -eq 0 ]; then
    echo "✅ Base tables created/verified"
else
    echo "⚠️  Note: Some tables may already exist (this is okay)"
fi
echo ""

# Run migration files in order
MIGRATION_FILES=(
    "001_add_thumbnail_s3_key.sql"
    "002_ensure_thumbnail_consistency.sql"
    "003_create_photos_table.sql"
    "004_create_users_table.sql"
)

echo "📋 Applying database migrations..."
echo ""

for migration_file in "${MIGRATION_FILES[@]}"; do
    migration_path="$MIGRATIONS_DIR/$migration_file"
    if [ -f "$migration_path" ]; then
        echo "  📄 Running migration: $migration_file..."
        
        # Run migration and capture output
        if [ "$USE_DOCKER" = true ]; then
            MIGRATION_OUTPUT=$(docker run --rm -i -e PGPASSWORD="$DB_PASS" -v "$migration_path:/migration.sql:ro" postgres:15 psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /migration.sql 2>&1)
            MIGRATION_EXIT_CODE=$?
        elif [ "$USE_PYTHON" = true ]; then
            MIGRATION_OUTPUT=$(python3 << PYEOF
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
    with open("$migration_path", 'r') as f:
        cur.execute(f.read())
    conn.commit()
    cur.close()
    conn.close()
    sys.exit(0)
except Exception as e:
    print(str(e), file=sys.stderr)
    sys.exit(1)
PYEOF
            2>&1)
            MIGRATION_EXIT_CODE=$?
        else
            export PGPASSWORD="$DB_PASS"
            MIGRATION_OUTPUT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_path" 2>&1)
            MIGRATION_EXIT_CODE=$?
            unset PGPASSWORD
        fi
        
        if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
            echo "    ✅ $migration_file applied successfully"
        else
            # Check if error is due to already existing objects (safe to ignore)
            if echo "$MIGRATION_OUTPUT" | grep -qiE "(already exists|duplicate|already present|relation.*already exists)"; then
                echo "    ⚠️  $migration_file: Some objects already exist (skipping - this is okay)"
            else
                # Show the actual error
                echo "    ❌ $migration_file: Error applying migration"
                echo "       Error: $(echo "$MIGRATION_OUTPUT" | head -3 | tr '\n' ' ')"
                echo ""
                echo "       Full error output:"
                echo "$MIGRATION_OUTPUT" | sed 's/^/       /'
                echo ""
                read -p "       Continue with next migration? (y/N): " continue_choice
                if [[ ! $continue_choice =~ ^[Yy]$ ]]; then
                    echo "❌ Migration process cancelled"
                    exit 1
                fi
            fi
        fi
    else
        echo "    ⚠️  Migration file not found: $migration_file (skipping)"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Database migrations complete!"
echo ""
echo "📊 Verify tables were created:"
echo "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"\\dt\""
echo ""

