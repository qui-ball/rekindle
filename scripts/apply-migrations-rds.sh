#!/bin/bash

# Apply Database Migrations Script for RDS
# Applies all migrations in backend/migrations/ directory to RDS database

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/backend/migrations"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️  Applying database migrations to RDS...${NC}"

# Load DATABASE_URL from backend/.env
if [ ! -f "$PROJECT_ROOT/backend/.env" ]; then
    echo -e "${RED}❌ Error: backend/.env file not found${NC}"
    exit 1
fi

# Extract DATABASE_URL from .env file
DATABASE_URL=$(grep "^DATABASE_URL=" "$PROJECT_ROOT/backend/.env" | cut -d '=' -f2- | tr -d "'\"")

if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL not found in backend/.env${NC}"
    exit 1
fi

echo "   Using DATABASE_URL: ${DATABASE_URL:0:50}..."
echo ""

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
    
    # Apply migration using psql with DATABASE_URL
    ERROR_OUTPUT=$(psql "$DATABASE_URL" -f "$migration_file" 2>&1 || true)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅${NC}"
        APPLIED=$((APPLIED + 1))
    else
        # Check if error is "already exists" (safe to ignore)
        if echo "$ERROR_OUTPUT" | grep -qi "already exists\|duplicate"; then
            echo -e "${YELLOW}⏭️  (already applied)${NC}"
            SKIPPED=$((SKIPPED + 1))
        else
            echo -e "${RED}❌${NC}"
            echo "      Error: $ERROR_OUTPUT" | head -5
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

