"""
Main FastAPI application factory.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app import database
from app.routes import router as api_router
from app.ws_routes import router as ws_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for application startup/shutdown.
    """
    # Startup
    logger.info("🚀 Starting Excavation Monitoring System")
    database.init_db()
    logger.info("✓ Database initialized")

    yield

    # Shutdown
    logger.info("🛑 Shutting down Excavation Monitoring System")


def create_app() -> FastAPI:
    """Create and configure FastAPI application"""

    app = FastAPI(
        title="Excavation Monitoring System API",
        description="AI-powered mining excavation monitoring with real-time alerts",
        version="1.0.0",
        lifespan=lifespan
    )

    # ========================================================================
    # Middleware Configuration
    # ========================================================================

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ========================================================================
    # Include Routes
    # ========================================================================

    app.include_router(api_router)
    app.include_router(ws_router)

    # ========================================================================
    # Root Endpoint
    # ========================================================================

    @app.get("/", tags=["root"])
    async def read_root():
        """API root endpoint"""
        return {
            "title": "Excavation Monitoring System API",
            "version": "1.0.0",
            "docs_url": "/docs",
            "redoc_url": "/redoc"
        }

    return app


# Create the application instance
app = create_app()
