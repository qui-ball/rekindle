# Development Standards (MVP)

## Overview
Development standards optimized for AI-assisted development with Kiro. Focus on code clarity, maintainability, and rapid MVP delivery.

## Project Structure
```
rekindle/
├── frontend/                 # Next.js PWA
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/           # Route components
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API layer
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Helper functions
│   └── public/              # PWA assets
├── backend/                 # FastAPI Python
│   ├── app/
│   │   ├── api/            # Route handlers
│   │   ├── models/         # Database models
│   │   ├── services/       # Business logic
│   │   └── workers/        # Background jobs
│   └── tests/              # Test files
└── infrastructure/          # Deployment configs
```

## Naming Conventions
- **Directories:** kebab-case (`user-profile/`)
- **React Components:** PascalCase (`UserProfile.tsx`)
- **Functions/Variables:** camelCase (`processPhoto()`)
- **Constants:** UPPER_CASE (`MAX_FILE_SIZE`)
- **API Endpoints:** RESTful (`POST /api/photos`)

## TypeScript Standards

### Core Types
```typescript
interface ProcessingOptions {
  restoration: boolean;
  coloring: boolean;
  quality: 'standard' | 'hd'; // 480p/720p
}

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
type UserTier = 'free' | 'remember' | 'cherish' | 'forever';

// Error handling
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };
```

## React Component Standards

### Component Structure
```typescript
interface PhotoUploadProps {
  onUploadComplete?: (result: UploadResult) => void;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ onUploadComplete }) => {
  // 1. State and hooks
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  
  // 2. Event handlers
  const handleFileSelect = useCallback(async (file: File) => {
    setStatus('uploading');
    try {
      const result = await uploadPhoto(file);
      setStatus('success');
      onUploadComplete?.(result);
    } catch (error) {
      setStatus('error');
    }
  }, [onUploadComplete]);

  // 3. Render
  return <div className="photo-upload">{/* JSX */}</div>;
};
```

### Custom Hooks
```typescript
export const usePhotoUpload = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const uploadPhoto = useCallback(async (file: File): Promise<Result<UploadResult>> => {
    setStatus('uploading');
    try {
      const result = await uploadToS3(file, { onProgress: setProgress });
      setStatus('success');
      return { success: true, data: result };
    } catch (error) {
      setStatus('error');
      return { success: false, error: error as Error };
    }
  }, []);

  return { uploadPhoto, progress, status };
};
```

## API Design Standards

### FastAPI Routes
```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from app.services.photo_service import PhotoService
from app.core.auth import get_current_user

router = APIRouter(prefix="/api/photos", tags=["photos"])

@router.post("/upload")
async def upload_photo(
    file: UploadFile,
    options: ProcessingOptions,
    current_user: User = Depends(get_current_user),
    photo_service: PhotoService = Depends()
):
    """Upload photo for processing."""
    try:
        result = await photo_service.process_upload(file, options, current_user.id)
        return {"success": True, "job_id": result.job_id}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

## Database Standards

### Models
```python
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    tier = Column(String, default="free")
    monthly_credits = Column(Integer, default=0)
    topup_credits = Column(Integer, default=0)

class Photo(Base):
    __tablename__ = "photos"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"))
    filename = Column(String, nullable=False)
    status = Column(String, default="pending")
```

## Testing Standards (MVP)

### Required Tests
- **Unit Tests:** 80% coverage minimum
- **Integration Tests:** All API endpoints
- **Error Handling:** All failure scenarios
- **No E2E Tests:** Focus on unit/integration for MVP speed

### Test Structure
```typescript
// Frontend tests
describe('PhotoUpload', () => {
  it('should upload photo successfully', async () => {
    const onComplete = jest.fn();
    render(<PhotoUpload onUploadComplete={onComplete} />);
    
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/upload/i);
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });
});
```

```python
# Backend tests
class TestPhotoService:
    async def test_process_upload_success(self):
        file_data = b"fake_image_data"
        options = ProcessingOptions(restoration=True, coloring=False)
        
        result = await self.photo_service.process_upload(file_data, options, "user-123")
        
        assert result.job_id is not None
        assert result.status == "pending"
```

## AI Service Integration

### RunPod Service
```python
class RunPodService:
    def __init__(self):
        self.models = {
            'restoration': 'qwen-3-image-edit',
            'colourization': 'qwen-3-image-edit'
        }
    
    async def process_photo(self, image_data: bytes, job_type: str, user_tier: str) -> bytes:
        max_resolution = '720p' if user_tier != 'free' else '480p'
        return await self._run_model(self.models[job_type], image_data, max_resolution)
```

## Development Environment

### Docker Setup
```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    volumes: ["./frontend:/app"]
    environment: ["CHOKIDAR_USEPOLLING=true"]
  
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes: ["./backend:/app"]
    environment: ["RELOAD=true"]
    depends_on: [postgres, redis]
  
  postgres:
    image: postgres:14
    environment: ["POSTGRES_DB=rekindle_dev"]
    ports: ["5432:5432"]
  
  redis:
    image: redis:7
    ports: ["6379:6379"]
```

### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
name: CI/CD
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Frontend Tests
        run: |
          cd frontend
          npm ci
          npm run test:coverage
      
      - name: Backend Tests
        run: |
          cd backend
          pip install -r requirements.txt
          pytest --cov=app
```

## Security Standards
- **Upload Security:** Presigned S3 URLs, file validation
- **Auth Security:** Auth0 handles authentication
- **Data Protection:** Encrypted at rest, signed URLs
- **Input Validation:** Pydantic models for all inputs

## Performance Standards
- **Bundle Size:** <500KB gzipped
- **API Response:** <200ms (excluding AI processing)
- **Database:** Use indexes, avoid N+1 queries
- **Caching:** Redis for sessions, CDN for assets

This condensed version focuses on essential standards while removing verbose examples and redundant sections, making it much more token-efficient for AI processing.