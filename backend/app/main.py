"""
Rekindle - Photo Restoration Service
Main FastAPI application entry point
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
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

# Configure rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter


def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """
    Custom rate limit exception handler with logging.
    
    Logs rate limit hits for security monitoring without excessive verbosity.
    """
    # Extract endpoint and IP for logging
    endpoint = request.url.path
    ip_address = get_remote_address(request)
    
    # Log rate limit hit (WARNING level - security event)
    logger.warning(
        "Rate limit exceeded",
        extra={
            "event_type": "rate_limit_exceeded",
            "endpoint": endpoint,
            "ip_address": ip_address,
            "method": request.method,
            "limit": str(exc.retry_after) if hasattr(exc, 'retry_after') else "unknown",
        }
    )
    
    # Use default handler for response
    return _rate_limit_exceeded_handler(request, exc)


app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add trusted host middleware
# NOTE: TrustedHostMiddleware temporarily disabled for local development with ngrok webhooks
# Starlette's TrustedHostMiddleware doesn't support wildcard patterns (*.ngrok-free.app)
# and ngrok free tier generates random subdomains on each restart.
#
# TODO: Re-enable in production with proper domain configuration:
# app.add_middleware(
#     TrustedHostMiddleware,
#     allowed_hosts=settings.ALLOWED_HOSTS,
# )

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
