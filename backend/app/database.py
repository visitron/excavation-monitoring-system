"""
Database configuration and session management.
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Database connection string
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/excavation_monitoring"
)

# Create engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Verify connections before use
)

# Session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables and seed default data"""
    import logging
    from app.models import Base, AoI
    
    logger = logging.getLogger(__name__)
    
    try:
        # Enable PostGIS extension
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            conn.commit()
        logger.info("✓ PostGIS extension enabled")
    except Exception as e:
        logger.warning(f"⚠ PostGIS extension already exists or couldn't be created: {e}")
    
    Base.metadata.create_all(bind=engine)
    logger.info("✓ Database tables created")
    
    # Seed default AOI if none exists
    db = SessionLocal()
    try:
        existing_aoi = db.query(AoI).first()
        if not existing_aoi:
            default_aoi = AoI(
                name="Default AOI",
                description="Default Area of Interest for testing",
                geometry="SRID=4326;POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))"
            )
            db.add(default_aoi)
            db.commit()
            logger.info(f"✓ Created default AOI: {default_aoi.id}")
        else:
            logger.info(f"✓ AOI already exists: {existing_aoi.id}")
    except Exception as e:
        logger.error(f"✗ Failed to seed default AOI: {e}")
        db.rollback()
    finally:
        db.close()
