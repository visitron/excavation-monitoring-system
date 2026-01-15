"""
REST API endpoints for excavation monitoring system.
"""

import logging
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app import models, schemas, database
from app.websocket import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["excavation-monitoring"])


# Helper function to resolve AOI ID
def resolve_aoi_id(aoi_id: str, db: Session) -> UUID:
    """Convert aoi_id string to UUID, handling special 'default-aoi' case"""
    if aoi_id == "default-aoi":
        first_aoi = db.query(models.AoI).first()
        if not first_aoi:
            raise HTTPException(status_code=404, detail="No AOI found in database")
        return first_aoi.id
    try:
        return UUID(aoi_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid AOI ID format")


# ============================================================================
# AOI Endpoints
# ============================================================================

@router.post("/aoi", response_model=schemas.AoI, status_code=201)
def create_aoi(
    aoi: schemas.AoICreate,
    db: Session = Depends(database.get_db)
):
    """Create a new Area of Interest"""
    logger.info(f"📍 [AOI:CREATE] ========== START ==========")
    logger.info(f"📍 [AOI:CREATE] Received request to create AOI")
    logger.info(f"📍 [AOI:CREATE]   Name: {aoi.name}")
    logger.info(f"📍 [AOI:CREATE]   Description: {aoi.description}")
    logger.info(f"📍 [AOI:CREATE]   Geometry Type: {aoi.geometry.get('type') if aoi.geometry else 'None'}")
    
    if aoi.geometry:
        coords = aoi.geometry.get('coordinates', [[]])
        logger.info(f"📍 [AOI:CREATE]   Coordinate Points: {len(coords[0]) if coords else 0}")
        logger.info(f"📍 [AOI:CREATE]   First Point: {coords[0][0] if coords and coords[0] else 'N/A'}")
    
    # Check if AOI with this name already exists
    logger.info(f"📍 [AOI:CREATE] Checking for duplicate AOI name...")
    existing = db.query(models.AoI).filter(models.AoI.name == aoi.name).first()
    if existing:
        logger.warning(f"📍 [AOI:CREATE] ❌ AOI with name '{aoi.name}' already exists (ID: {existing.id})")
        raise HTTPException(
            status_code=400,
            detail=f"AOI with name '{aoi.name}' already exists"
        )
    logger.info(f"📍 [AOI:CREATE] ✓ No duplicate found")

    # Convert GeoJSON coordinates to WKT format
    logger.info(f"📍 [AOI:CREATE] Converting GeoJSON to WKT format...")
    coords = aoi.geometry['coordinates'][0]
    wkt_coords = ", ".join([f"{lon} {lat}" for lon, lat in coords])
    wkt_string = f"SRID=4326;POLYGON(({wkt_coords}))"
    logger.info(f"📍 [AOI:CREATE] ✓ WKT Generated: {wkt_string[:80]}...")
    
    # Create database object
    logger.info(f"📍 [AOI:CREATE] Creating database record...")
    db_aoi = models.AoI(
        name=aoi.name,
        description=aoi.description,
        geometry=wkt_string
    )
    db.add(db_aoi)
    db.commit()
    db.refresh(db_aoi)
    
    logger.info(f"📍 [AOI:CREATE] ✓ Database record created")
    logger.info(f"📍 [AOI:CREATE]   New AOI ID: {db_aoi.id}")
    logger.info(f"📍 [AOI:CREATE]   Created At: {db_aoi.created_at}")
    logger.info(f"📍 [AOI:CREATE] ========== SUCCESS ==========")
    return db_aoi


@router.get("/aoi", response_model=List[schemas.AoI])
def list_aois(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(database.get_db)
):
    """List all Areas of Interest"""
    logger.info(f"📋 [AOI:LIST] ========== START ==========")
    logger.info(f"📋 [AOI:LIST] Fetching AOIs (skip={skip}, limit={limit})")
    
    aois = db.query(models.AoI).offset(skip).limit(limit).all()
    logger.info(f"📋 [AOI:LIST] ✓ Retrieved {len(aois)} AOIs")
    logger.info(f"📋 [AOI:LIST] ========== SUCCESS ==========")
    
    # Convert to response format, excluding complex geometry
    return [
        {
            "id": aoi.id,
            "name": aoi.name,
            "description": aoi.description,
            "geometry": None,  # Geometry excluded for simplicity
            "created_at": aoi.created_at,
            "updated_at": aoi.updated_at
        }
        for aoi in aois
    ]


@router.get("/aoi/{aoi_id}", response_model=schemas.AoI)
def get_aoi(
    aoi_id: UUID,
    db: Session = Depends(database.get_db)
):
    """Get a specific AOI by ID"""
    logger.info(f"📍 [AOI:GET] ========== START ==========")
    logger.info(f"📍 [AOI:GET] Fetching AOI with ID: {aoi_id}")
    
    db_aoi = db.query(models.AoI).filter(models.AoI.id == aoi_id).first()
    if not db_aoi:
        logger.warning(f"📍 [AOI:GET] ❌ AOI not found (ID: {aoi_id})")
        raise HTTPException(status_code=404, detail="AOI not found")
    
    logger.info(f"📍 [AOI:GET] ✓ Found AOI")
    logger.info(f"📍 [AOI:GET]   Name: {db_aoi.name}")
    logger.info(f"📍 [AOI:GET]   Description: {db_aoi.description}")
    logger.info(f"📍 [AOI:GET] ========== SUCCESS ==========")
    return db_aoi


# ============================================================================
# Boundary Endpoints
# ============================================================================

@router.post("/boundaries", response_model=schemas.Boundary, status_code=201)
def create_boundary(
    boundary: schemas.BoundaryCreate,
    db: Session = Depends(database.get_db)
):
    """Create a new boundary (legal or no-go zone)"""
    logger.info(f"🧱 [BOUNDARY:CREATE] ========== START ==========")
    logger.info(f"🧱 [BOUNDARY:CREATE] Received request to create boundary")
    logger.info(f"🧱 [BOUNDARY:CREATE]   Name: {boundary.name}")
    logger.info(f"🧱 [BOUNDARY:CREATE]   Type: {'Legal Boundary' if boundary.is_legal else 'No-Go Zone'}")
    logger.info(f"🧱 [BOUNDARY:CREATE]   AOI ID: {boundary.aoi_id}")
    
    # Verify AOI exists
    logger.info(f"🧱 [BOUNDARY:CREATE] Verifying AOI exists...")
    aoi = db.query(models.AoI).filter(models.AoI.id == boundary.aoi_id).first()
    if not aoi:
        logger.warning(f"🧱 [BOUNDARY:CREATE] ❌ AOI not found (ID: {boundary.aoi_id})")
        raise HTTPException(status_code=404, detail="AOI not found")
    logger.info(f"🧱 [BOUNDARY:CREATE] ✓ AOI verified: {aoi.name}")

    # Convert GeoJSON coordinates to WKT format
    logger.info(f"🧱 [BOUNDARY:CREATE] Converting GeoJSON to WKT format...")
    coords = boundary.geometry['coordinates'][0]
    logger.info(f"🧱 [BOUNDARY:CREATE]   Coordinate points: {len(coords)}")
    wkt_coords = ", ".join([f"{lon} {lat}" for lon, lat in coords])
    wkt_string = f"SRID=4326;POLYGON(({wkt_coords}))"
    logger.info(f"🧱 [BOUNDARY:CREATE] ✓ WKT Generated: {wkt_string[:80]}...")

    # Create database record
    logger.info(f"🧱 [BOUNDARY:CREATE] Creating database record...")
    db_boundary = models.MinerBoundary(
        aoi_id=boundary.aoi_id,
        name=boundary.name,
        description=boundary.description,
        geometry=wkt_string,
        is_legal=boundary.is_legal
    )
    db.add(db_boundary)
    db.commit()
    db.refresh(db_boundary)

    logger.info(f"🧱 [BOUNDARY:CREATE] ✓ Database record created")
    logger.info(f"🧱 [BOUNDARY:CREATE]   New Boundary ID: {db_boundary.id}")
    logger.info(f"🧱 [BOUNDARY:CREATE]   Created At: {db_boundary.created_at}")
    logger.info(f"🧱 [BOUNDARY:CREATE] ========== SUCCESS ==========")
    return db_boundary


@router.get("/boundaries/{aoi_id}", response_model=List[schemas.Boundary])
def list_boundaries(
    aoi_id: str,
    db: Session = Depends(database.get_db)
):
    """List all boundaries for an AOI"""
    logger.info(f"🧱 [BOUNDARY:LIST] ========== START ==========")
    logger.info(f"🧱 [BOUNDARY:LIST] Fetching boundaries for AOI: {aoi_id}")
    
    # Resolve AOI ID (handles 'default-aoi' special case)
    logger.info(f"🧱 [BOUNDARY:LIST] Resolving AOI ID...")
    aoi_id_uuid = resolve_aoi_id(aoi_id, db)
    logger.info(f"🧱 [BOUNDARY:LIST] ✓ Resolved UUID: {aoi_id_uuid}")
    
    boundaries = (
        db.query(models.MinerBoundary)
        .filter(models.MinerBoundary.aoi_id == aoi_id_uuid)
        .all()
    )
    
    logger.info(f"🧱 [BOUNDARY:LIST] ✓ Retrieved {len(boundaries)} boundaries")
    legal_count = sum(1 for b in boundaries if b.is_legal)
    nogo_count = len(boundaries) - legal_count
    logger.info(f"🧱 [BOUNDARY:LIST]   Legal boundaries: {legal_count}")
    logger.info(f"🧱 [BOUNDARY:LIST]   No-Go zones: {nogo_count}")
    logger.info(f"🧱 [BOUNDARY:LIST] ========== SUCCESS ==========")
    return boundaries


# ============================================================================
# Time-Series Data Endpoints
# ============================================================================

@router.get("/timeseries/{aoi_id}", response_model=schemas.TimeSeriesResponse)
def get_timeseries(
    aoi_id: str,
    boundary_id: Optional[UUID] = None,
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(database.get_db)
):
    """Get time-series excavation data for an AOI"""
    # Resolve AOI ID (handles 'default-aoi' special case)
    aoi_id_uuid = resolve_aoi_id(aoi_id, db)
    
    # Get legal boundary data (join with boundaries to filter by is_legal)
    legal_query = (
        db.query(models.ExcavationTimeSeries)
        .join(models.MinerBoundary, models.ExcavationTimeSeries.boundary_id == models.MinerBoundary.id)
        .filter(
            models.ExcavationTimeSeries.aoi_id == aoi_id_uuid,
            models.MinerBoundary.is_legal == True
        )
    )

    # Get no-go zone data (join with boundaries to filter by is_legal)
    nogo_query = (
        db.query(models.ExcavationTimeSeries)
        .join(models.MinerBoundary, models.ExcavationTimeSeries.boundary_id == models.MinerBoundary.id)
        .filter(
            models.ExcavationTimeSeries.aoi_id == aoi_id_uuid,
            models.MinerBoundary.is_legal == False
        )
    )

    if start_date:
        legal_query = legal_query.filter(models.ExcavationTimeSeries.timestamp >= start_date)
        nogo_query = nogo_query.filter(models.ExcavationTimeSeries.timestamp >= start_date)

    if end_date:
        legal_query = legal_query.filter(models.ExcavationTimeSeries.timestamp <= end_date)
        nogo_query = nogo_query.filter(models.ExcavationTimeSeries.timestamp <= end_date)

    legal_data = legal_query.order_by(models.ExcavationTimeSeries.timestamp).all()
    nogo_data = nogo_query.order_by(models.ExcavationTimeSeries.timestamp).all()

    # Convert to response format
    legal_points = [
        schemas.TimeSeriesDataPoint(
            timestamp=d.timestamp,
            excavated_area_ha=d.excavated_area_ha,
            smoothed_area_ha=d.smoothed_area_ha,
            excavation_rate_ha_day=d.excavation_rate_ha_day,
            anomaly_score=d.anomaly_score,
            confidence=d.confidence
        )
        for d in legal_data
    ]

    nogo_points = [
        schemas.TimeSeriesDataPoint(
            timestamp=d.timestamp,
            excavated_area_ha=d.excavated_area_ha,
            smoothed_area_ha=d.smoothed_area_ha,
            excavation_rate_ha_day=d.excavation_rate_ha_day,
            anomaly_score=d.anomaly_score,
            confidence=d.confidence
        )
        for d in nogo_data
    ]

    # Compute summary stats
    summary_stats = {
        "legal_max_ha": max([p.excavated_area_ha for p in legal_points], default=0),
        "legal_mean_ha": sum([p.excavated_area_ha for p in legal_points], 0) / len(legal_points) if legal_points else 0,
        "nogo_max_ha": max([p.excavated_area_ha for p in nogo_points], default=0),
        "nogo_mean_ha": sum([p.excavated_area_ha for p in nogo_points], 0) / len(nogo_points) if nogo_points else 0,
    }

    return schemas.TimeSeriesResponse(
        legal_boundary=legal_points,
        nogo_zones=nogo_points,
        summary_stats=summary_stats
    )


# ============================================================================
# Violation Endpoints
# ============================================================================

@router.get("/violations/{aoi_id}", response_model=List[schemas.ViolationEvent])
def get_violations(
    aoi_id: str,
    severity: Optional[str] = Query(None),
    unresolved_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(database.get_db)
):
    """Get violation events for an AOI"""
    # Resolve AOI ID (handles 'default-aoi' special case)
    aoi_id_uuid = resolve_aoi_id(aoi_id, db)
    
    query = db.query(models.ViolationEvent).filter(models.ViolationEvent.aoi_id == aoi_id_uuid)

    if severity:
        query = query.filter(models.ViolationEvent.severity == severity)

    if unresolved_only:
        query = query.filter(models.ViolationEvent.is_resolved == False)

    violations = (
        query
        .order_by(desc(models.ViolationEvent.detection_date))
        .offset(skip)
        .limit(limit)
        .all()
    )

    return violations


@router.post("/violations", response_model=schemas.ViolationEvent, status_code=201)
async def create_violation(
    violation: schemas.ViolationEventCreate,
    db: Session = Depends(database.get_db)
):
    """Create a new violation event and broadcast alert"""
    db_violation = models.ViolationEvent(
        aoi_id=violation.aoi_id,
        nogo_zone_id=violation.nogo_zone_id,
        event_type=violation.event_type,
        detection_date=violation.detection_date,
        excavated_area_ha=violation.excavated_area_ha,
        description=violation.description,
        severity=violation.severity or "MEDIUM",
        event_metadata=violation.event_metadata
    )
    db.add(db_violation)
    db.commit()
    db.refresh(db_violation)

    # Broadcast alert via WebSocket
    alert = schemas.ViolationAlert(
        event_id=db_violation.id,
        event_type=db_violation.event_type,
        detection_date=db_violation.detection_date,
        excavated_area_ha=db_violation.excavated_area_ha,
        nogo_zone_id=db_violation.nogo_zone_id,
        severity=db_violation.severity,
        description=db_violation.description or ""
    )

    await manager.broadcast_violation(
        str(violation.aoi_id),
        alert.dict()
    )

    logger.info(f"Created and broadcasted violation: {db_violation.id}")
    return db_violation


@router.patch("/violations/{violation_id}/resolve", response_model=schemas.ViolationEvent)
def resolve_violation(
    violation_id: UUID,
    db: Session = Depends(database.get_db)
):
    """Mark a violation as resolved"""
    violation = (
        db.query(models.ViolationEvent)
        .filter(models.ViolationEvent.id == violation_id)
        .first()
    )
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")

    violation.is_resolved = True
    violation.resolved_date = datetime.utcnow()
    db.commit()
    db.refresh(violation)

    logger.info(f"Marked violation {violation_id} as resolved")
    return violation


# ============================================================================
# Analysis Configuration Endpoints
# ============================================================================

@router.post("/analysis-configs", response_model=schemas.AnalysisConfig, status_code=201)
def create_analysis_config(
    config: schemas.AnalysisConfigCreate,
    db: Session = Depends(database.get_db)
):
    """Create a new analysis configuration"""
    db_config = models.AnalysisConfig(
        aoi_id=config.aoi_id,
        name=config.name,
        start_date=config.start_date,
        end_date=config.end_date,
        threshold_method=config.threshold_method,
        cloud_mask_method=config.cloud_mask_method,
        smoothing_window=config.smoothing_window,
        min_violation_area_ha=config.min_violation_area_ha,
        config_params=config.config_params or {}
    )
    db.add(db_config)
    db.commit()
    db.refresh(db_config)

    logger.info(f"Created analysis config: {db_config.id}")
    return db_config


@router.get("/analysis-configs/{aoi_id}", response_model=List[schemas.AnalysisConfig])
def list_analysis_configs(
    aoi_id: str,
    db: Session = Depends(database.get_db)
):
    """List all analysis configs for an AOI"""
    # Resolve AOI ID (handles 'default-aoi' special case)
    aoi_id_uuid = resolve_aoi_id(aoi_id, db)
    
    configs = (
        db.query(models.AnalysisConfig)
        .filter(models.AnalysisConfig.aoi_id == aoi_id_uuid)
        .order_by(desc(models.AnalysisConfig.created_at))
        .all()
    )
    return configs


@router.get("/analysis-configs/{config_id}", response_model=schemas.AnalysisConfig)
def get_analysis_config(
    config_id: UUID,
    db: Session = Depends(database.get_db)
):
    """Get a specific analysis config"""
    config = (
        db.query(models.AnalysisConfig)
        .filter(models.AnalysisConfig.id == config_id)
        .first()
    )
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config


@router.patch("/analysis-configs/{config_id}", response_model=schemas.AnalysisConfig)
def update_analysis_config(
    config_id: UUID,
    config_update: schemas.AnalysisConfigUpdate,
    db: Session = Depends(database.get_db)
):
    """Update an analysis configuration"""
    db_config = (
        db.query(models.AnalysisConfig)
        .filter(models.AnalysisConfig.id == config_id)
        .first()
    )
    if not db_config:
        raise HTTPException(status_code=404, detail="Config not found")

    update_data = config_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_config, field, value)

    db.commit()
    db.refresh(db_config)

    logger.info(f"Updated analysis config: {db_config.id}")
    return db_config


# ============================================================================
# Job Status Endpoints
# ============================================================================

@router.post("/jobs", response_model=schemas.AnalysisJobStatus, status_code=201)
def start_job(
    request: schemas.JobStartRequest,
    db: Session = Depends(database.get_db)
):
    """Start a new analysis job"""
    config = (
        db.query(models.AnalysisConfig)
        .filter(models.AnalysisConfig.id == request.config_id)
        .first()
    )
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    db_job = models.AnalysisJob(
        config_id=request.config_id,
        job_type=request.job_type,
        status="PENDING"
    )
    db.add(db_job)
    db.commit()
    db.refresh(db_job)

    logger.info(f"Started job: {db_job.id} (type: {request.job_type})")

    # TODO: Trigger async job processing
    # celery_app.send_task('tasks.run_analysis_job', args=[str(db_job.id)])

    return db_job


@router.get("/jobs/{job_id}", response_model=schemas.AnalysisJobStatus)
def get_job_status(
    job_id: UUID,
    db: Session = Depends(database.get_db)
):
    """Get job status"""
    job = (
        db.query(models.AnalysisJob)
        .filter(models.AnalysisJob.id == job_id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ============================================================================
# Alert Subscription Endpoints
# ============================================================================

@router.post("/subscriptions", response_model=schemas.AlertSubscription, status_code=201)
def create_subscription(
    subscription: schemas.AlertSubscriptionCreate,
    db: Session = Depends(database.get_db)
):
    """Create a new alert subscription"""
    db_sub = models.AlertSubscription(
        aoi_id=subscription.aoi_id,
        user_email=subscription.user_email,
        webhook_url=subscription.webhook_url,
        alert_types=subscription.alert_types
    )
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)

    logger.info(f"Created subscription: {db_sub.id}")
    return db_sub


@router.get("/subscriptions/{aoi_id}", response_model=List[schemas.AlertSubscription])
def list_subscriptions(
    aoi_id: str,
    db: Session = Depends(database.get_db)
):
    """List subscriptions for an AOI"""
    # Resolve AOI ID (handles 'default-aoi' special case)
    aoi_id_uuid = resolve_aoi_id(aoi_id, db)
    
    subs = (
        db.query(models.AlertSubscription)
        .filter(models.AlertSubscription.aoi_id == aoi_id_uuid)
        .all()
    )
    return subs


# ============================================================================
# Health Check
# ============================================================================

# ============================================================================
# Analysis Pipeline Endpoints
# ============================================================================

@router.post("/analysis/run", status_code=200)
async def run_analysis_pipeline(
    request: Request,
    db: Session = Depends(database.get_db)
):
    """
    Run the complete AI analysis pipeline for an AOI.
    
    This endpoint:
    - Fetches latest Sentinel-2 satellite imagery
    - Applies preprocessing and cloud masking
    - Detects excavation patterns
    - Runs anomaly detection
    - Identifies violations in no-go zones
    - Creates alerts and updates the dashboard
    """
    try:
        from app.analysis import AnalysisPipeline
        
        body = await request.json()
        aoi_id = body.get('aoi_id', 'default-aoi')
        analysis_type = body.get('analysis_type', 'full_pipeline')
        
        logger.info(f"Analysis request received for AOI: {aoi_id}")
        
        # Resolve AOI ID
        aoi_id_uuid = resolve_aoi_id(aoi_id, db)
        
        logger.info(f"Starting analysis pipeline for AOI: {aoi_id_uuid}")
        
        # Run pipeline
        pipeline = AnalysisPipeline(db)
        result = pipeline.run_full_pipeline(aoi_id_uuid, regenerate_data=True)
        
        return {
            "status": "success",
            "data": result
        }
        
    except Exception as e:
        logger.error(f"Analysis pipeline error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Analysis pipeline failed: {str(e)}"
        )


@router.get("/health", status_code=200)
def health_check(db: Session = Depends(database.get_db)):
    """Health check endpoint with database status"""
    try:
        # Check if database is accessible
        aoi_count = db.query(models.AoI).count()
        boundary_count = db.query(models.MinerBoundary).count()
        violation_count = db.query(models.ViolationEvent).count()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "database": {
                "connected": True,
                "aoi_count": aoi_count,
                "boundary_count": boundary_count,
                "violation_count": violation_count
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
