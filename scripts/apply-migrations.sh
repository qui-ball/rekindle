#!/bin/bash

# Apply Database Migrations Script
# Applies all migrations in backend/migrations/ directory in order

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/backend/migrations"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️  Applying database migrations...${NC}"

TARGET=""
DB_HOST=""
APP_ENVIRONMENT="${APP_ENV:-${ENVIRONMENT:-}}"

if [ -n "$DATABASE_URL" ]; then
    TARGET="remote"
    DB_HOST=$(python - <<'PY'
import os
from urllib.parse import urlparse
url = os.environ.get("DATABASE_URL")
if not url:
    print("")
else:
    parsed = urlparse(url)
    print(parsed.hostname or "")
PY
)

    if [ -z "$DB_HOST" ]; then
        echo -e "${YELLOW}⚠️  Unable to determine database host from DATABASE_URL.${NC}"
    fi

    if [ "${ALLOW_PROD_DB_MIGRATIONS}" != "true" ]; then
        if [ "$APP_ENVIRONMENT" = "prod" ] || [ "$APP_ENVIRONMENT" = "production" ]; then
            echo -e "${RED}❌ Refusing to run migrations against production environment without ALLOW_PROD_DB_MIGRATIONS=true${NC}"
            exit 1
        fi

        if [[ "$DB_HOST" == *"prod"* ]] || [[ "$DB_HOST" == *"production"* ]]; then
            echo -e "${RED}❌ Refusing to run migrations against host '$DB_HOST' without ALLOW_PROD_DB_MIGRATIONS=true${NC}"
            echo "   Set ALLOW_PROD_DB_MIGRATIONS=true if this is intentional."
            exit 1
        fi
    fi
else
    if docker compose ps postgres 2>/dev/null | grep -q "Up"; then
        TARGET="docker"
    else
        echo -e "${YELLOW}⚠️  No DATABASE_URL set and local postgres container is not running. Skipping migrations.${NC}"
        echo "   Start the dev environment with: ./dev start"
        exit 0
    fi
fi

# Get list of migration files in order
MIGRATIONS=($(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort))

if [ ${#MIGRATIONS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No migration files found in $MIGRATIONS_DIR${NC}"
    exit 0
fi

echo "   Found ${#MIGRATIONS[@]} migration file(s)"
echo ""

# Apply each migration
APPLIED=0
SKIPPED=0
FAILED=0

for migration_file in "${MIGRATIONS[@]}"; do
    migration_name=$(basename "$migration_file")
    
    echo -n "   📄 Applying $migration_name... "
    
    # Apply migration (errors are caught and handled)
    if [ "$TARGET" = "remote" ]; then
        OUTPUT=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 < "$migration_file" 2>&1) && STATUS=$? || STATUS=$?
    else
        OUTPUT=$(docker compose exec -T postgres psql -U rekindle -d rekindle -v ON_ERROR_STOP=1 < "$migration_file" 2>&1) && STATUS=$? || STATUS=$?
    fi

    if [ $STATUS -eq 0 ]; then
        echo -e "${GREEN}✅${NC}"
        APPLIED=$((APPLIED + 1))
    else
        if echo "$OUTPUT" | grep -qi "already exists\|duplicate\|already present"; then
            echo -e "${YELLOW}⏭️  (already applied)${NC}"
            SKIPPED=$((SKIPPED + 1))
        else
            echo -e "${RED}❌${NC}"
            echo "      Error: $OUTPUT" | head -3
            FAILED=$((FAILED + 1))
        fi
    fi
done

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ Migrations complete: ${APPLIED} applied, ${SKIPPED} skipped${NC}"
else
    echo -e "${RED}❌ Migrations incomplete: ${APPLIED} applied, ${SKIPPED} skipped, ${FAILED} failed${NC}"
    exit 1
fi

