#!/bin/bash
#
# Smoke test script for presigned URL access validation (Task 6.2b)
#
# This script validates that presigned URLs enforce user-scoped storage isolation.
# It should be run in CI/CD and staging environments to ensure storage security.
#
# Usage:
#   ./scripts/test-presigned-access.sh
#   RUN_INTEGRATION_TESTS=1 ./scripts/test-presigned-access.sh  # With real AWS
#
# Exit codes:
#   0 - All tests passed
#   1 - Tests failed
#   2 - Prerequisites not met
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to backend directory
cd "$BACKEND_DIR"

echo "=========================================="
echo "Presigned URL Access Smoke Test"
echo "=========================================="
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Error: python3 not found${NC}"
    exit 2
fi

# Check if we're in a virtual environment or have dependencies
if ! python3 -c "import app" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Warning: app module not found. Make sure dependencies are installed.${NC}"
    echo "   Run: cd backend && uv sync"
    echo ""
fi

# Run the Python storage isolation test
echo "Running storage isolation tests..."
echo ""

if python3 "$SCRIPT_DIR/test_storage_isolation.py"; then
    echo ""
    echo -e "${GREEN}✅ All presigned URL access tests passed!${NC}"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}❌ Presigned URL access tests failed!${NC}"
    echo ""
    exit 1
fi


