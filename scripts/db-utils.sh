#!/bin/bash

# Database utility functions for development

case "$1" in
  "seed")
    echo "🌱 Seeding database with test data..."
    ./scripts/seed-database.sh
    ;;
  "reset")
    echo "🗑️  Resetting database (keeping tables)..."
    docker-compose exec postgres psql -U rekindle -d rekindle -c "
    TRUNCATE jobs, restore_attempts, animation_attempts CASCADE;
    "
    echo "✅ Database reset (tables preserved)"
    ;;
  "backup")
    echo "💾 Creating database backup..."
    docker-compose exec postgres pg_dump -U rekindle rekindle > "backup-$(date +%Y%m%d-%H%M%S).sql"
    echo "✅ Backup created: backup-$(date +%Y%m%d-%H%M%S).sql"
    ;;
  "restore")
    if [ -z "$2" ]; then
      echo "❌ Please specify backup file: ./scripts/db-utils.sh restore backup-20250101-120000.sql"
      exit 1
    fi
    echo "📥 Restoring database from $2..."
    docker-compose exec -T postgres psql -U rekindle -d rekindle < "$2"
    echo "✅ Database restored from $2"
    ;;
  "status")
    echo "📊 Database Status:"
    docker-compose exec postgres psql -U rekindle -d rekindle -c "
    SELECT 
        'jobs' as table_name, COUNT(*) as record_count FROM jobs
    UNION ALL
    SELECT 
        'restore_attempts' as table_name, COUNT(*) as record_count FROM restore_attempts
    UNION ALL
    SELECT 
        'animation_attempts' as table_name, COUNT(*) as record_count FROM animation_attempts;
    "
    ;;
  "shell")
    echo "🐚 Opening database shell..."
    docker-compose exec postgres psql -U rekindle -d rekindle
    ;;
  *)
    echo "🗄️  Database Utilities"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  seed     Add test data to database"
    echo "  reset    Clear all data (keep tables)"
    echo "  backup   Create database backup"
    echo "  restore  Restore from backup file"
    echo "  status   Show database statistics"
    echo "  shell    Open interactive database shell"
    echo ""
    echo "Examples:"
    echo "  $0 seed                    # Add test data"
    echo "  $0 reset                   # Clear all data"
    echo "  $0 backup                  # Create backup"
    echo "  $0 restore backup.sql      # Restore from backup"
    echo "  $0 status                  # Show stats"
    echo "  $0 shell                   # Interactive shell"
    ;;
esac
