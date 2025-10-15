#!/bin/bash

# Database seeding script for development
echo "🌱 Seeding database with test data..."

# Add sample jobs
docker-compose exec -T postgres psql -U rekindle -d rekindle -c "
INSERT INTO jobs (email, created_at) VALUES 
('test1@example.com', NOW() - INTERVAL '1 day'),
('test2@example.com', NOW() - INTERVAL '2 hours'),
('test3@example.com', NOW() - INTERVAL '30 minutes')
ON CONFLICT DO NOTHING;

INSERT INTO restore_attempts (job_id, s3_key, model, params) VALUES 
((SELECT id FROM jobs WHERE email = 'test1@example.com' LIMIT 1), 'uploaded/test1.jpg', 'restore_model_v1', '{\"strength\": 0.8}'),
((SELECT id FROM jobs WHERE email = 'test2@example.com' LIMIT 1), 'uploaded/test2.jpg', 'restore_model_v1', '{\"strength\": 0.9}')
ON CONFLICT DO NOTHING;
"

echo "✅ Database seeded with test data!"
echo "📊 Current data:"
docker-compose exec postgres psql -U rekindle -d rekindle -c "
SELECT 
    j.email, 
    j.created_at,
    COUNT(r.id) as restore_attempts,
    COUNT(a.id) as animation_attempts
FROM jobs j 
LEFT JOIN restore_attempts r ON j.id = r.job_id 
LEFT JOIN animation_attempts a ON j.id = a.job_id 
GROUP BY j.id, j.email, j.created_at 
ORDER BY j.created_at DESC;
"
