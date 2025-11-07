"""
Rekindle - Photo Restoration Service
Main FastAPI application entry point
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from loguru import logger

from app.core.config import settings
from app.api.routes import api_router

# Create FastAPI app
app = FastAPI(
    title="Rekindle API",
    description="Photo restoration and colourization service",
    version="0.1.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS,
)

# Debug middleware to log all webhook requests
@app.middleware("http")
async def log_webhook_requests(request: Request, call_next):
    if "/webhooks/runpod-completion" in request.url.path:
        body = await request.body()
        logger.info(f"🔍 MIDDLEWARE: Webhook request to {request.url.path}")
        logger.info(f"🔍 MIDDLEWARE: Body: {body.decode('utf-8')}")
        
        # Important: need to recreate request with body since we consumed it
        from starlette.datastructures import Headers
        async def receive():
            return {"type": "http.request", "body": body}
        
        request = Request(request.scope, receive)
        
    response = await call_next(request)
    
    if "/webhooks/runpod-completion" in request.url.path:
        logger.info(f"🔍 MIDDLEWARE: Response status: {response.status_code}")
    
    return response

# Include API routes
app.include_router(api_router, prefix="/api")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Rekindle API is running", "version": "0.1.0"}


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "version": "0.1.0",
    }
