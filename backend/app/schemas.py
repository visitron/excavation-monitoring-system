"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, Field, validator, field_serializer, model_serializer
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
import json
import logging
from shapely import wkb
from shapely.geometry import shape

logger = logging.getLogger(__name__)


def wkb_to_geojson(wkb_element) -> Optional[Dict[str, Any]]:
    """Convert WKBElement from PostGIS to GeoJSON"""
    logger.info(f"🔄 [GEOMETRY:CONVERT] ========== START ==========")
    
    if wkb_element is None:
        logger.warning(f"🔄 [GEOMETRY:CONVERT] ⚠️  Received None WKB element")
        return None
    
    try:
        logger.info(f"🔄 [GEOMETRY:CONVERT] Input type: {type(wkb_element).__name__}")
        
        # Handle WKBElement from geoalchemy2
        if hasattr(wkb_element, 'data'):
            logger.info(f"🔄 [GEOMETRY:CONVERT] Processing WKBElement with .data attribute")
            # WKBElement.data can be bytes, memoryview, or hex string
            wkb_data = wkb_element.data
            logger.info(f"🔄 [GEOMETRY:CONVERT]   Data type: {type(wkb_data).__name__}")
            
            # Convert memoryview to bytes if needed
            if isinstance(wkb_data, memoryview):
                logger.info(f"🔄 [GEOMETRY:CONVERT]   Converting memoryview → bytes")
                wkb_data = bytes(wkb_data)
            # If it's a string, convert from hex
            elif isinstance(wkb_data, str):
                logger.info(f"🔄 [GEOMETRY:CONVERT]   Converting hex string → bytes")
                wkb_data = bytes.fromhex(wkb_data)
            
            logger.info(f"🔄 [GEOMETRY:CONVERT]   Final data type: {type(wkb_data).__name__}, size: {len(wkb_data)} bytes")
            geom = wkb.loads(wkb_data)
        else:
            # If it's already a shapely geometry
            logger.info(f"🔄 [GEOMETRY:CONVERT] Processing as existing Shapely geometry")
            geom = wkb_element
        
        logger.info(f"🔄 [GEOMETRY:CONVERT] Geometry type: {geom.geom_type}")
        
        # For Polygon, return as nested list of coordinate pairs [lng, lat]
        if geom.geom_type == "Polygon":
            logger.info(f"🔄 [GEOMETRY:CONVERT] Processing Polygon geometry")
            # Convert exterior ring coordinates to GeoJSON format
            exterior_coords = [[x, y] for x, y in geom.exterior.coords]
            logger.info(f"🔄 [GEOMETRY:CONVERT]   Exterior coordinates: {len(exterior_coords)} points")
            
            coordinates = [exterior_coords]
            
            # Add interior rings (holes) if any
            if geom.interiors:
                logger.info(f"🔄 [GEOMETRY:CONVERT]   Interior rings (holes): {len(geom.interiors)}")
                for i, interior in enumerate(geom.interiors):
                    interior_coords = [[x, y] for x, y in interior.coords]
                    logger.info(f"🔄 [GEOMETRY:CONVERT]     Ring {i+1}: {len(interior_coords)} points")
                    coordinates.append(interior_coords)
            
            result = {
                "type": "Polygon",
                "coordinates": coordinates
            }
            logger.info(f"🔄 [GEOMETRY:CONVERT] ✓ GeoJSON created with {len(coordinates)} ring(s)")
            logger.info(f"🔄 [GEOMETRY:CONVERT] ========== SUCCESS ==========")
            return result
        
        # For Point
        elif geom.geom_type == "Point":
            logger.info(f"🔄 [GEOMETRY:CONVERT] Processing Point geometry")
            result = {
                "type": "Point",
                "coordinates": [geom.x, geom.y]
            }
            logger.info(f"🔄 [GEOMETRY:CONVERT] ✓ Point coordinates: [{geom.x}, {geom.y}]")
            logger.info(f"🔄 [GEOMETRY:CONVERT] ========== SUCCESS ==========")
            return result
        
        # For LineString
        elif geom.geom_type == "LineString":
            logger.info(f"🔄 [GEOMETRY:CONVERT] Processing LineString geometry")
            coords = [[x, y] for x, y in geom.coords]
            logger.info(f"🔄 [GEOMETRY:CONVERT]   Points: {len(coords)}")
            result = {
                "type": "LineString",
                "coordinates": coords
            }
            logger.info(f"🔄 [GEOMETRY:CONVERT] ✓ LineString created")
            logger.info(f"🔄 [GEOMETRY:CONVERT] ========== SUCCESS ==========")
            return result
        
        # For other types, convert using shapely's mapping
        else:
            logger.warning(f"🔄 [GEOMETRY:CONVERT] ⚠️  Geometry type '{geom.geom_type}' not specifically handled, using shapely mapping")
            from shapely.geometry import mapping
            result = mapping(geom)
            logger.info(f"🔄 [GEOMETRY:CONVERT] ========== SUCCESS ==========")
            return result
    
    except Exception as e:
        logger.error(f"🔄 [GEOMETRY:CONVERT] ❌ ERROR: {str(e)}")
        import traceback
        logger.error(f"🔄 [GEOMETRY:CONVERT] Traceback: {traceback.format_exc()}")
        logger.error(f"🔄 [GEOMETRY:CONVERT] ========== FAILED ==========")
        return {"type": "Polygon", "coordinates": []}



# ============================================================================
# AOI Schemas
# ============================================================================

class AoIBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    geometry: Optional[Any] = None  # GeoJSON geometry or WKBElement


class AoICreate(AoIBase):
    pass


class AoI(AoIBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
    
    @model_serializer
    def serialize_model(self):
        """Serialize model with geometry conversion"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'geometry': wkb_to_geojson(self.geometry),
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }


# ============================================================================
# Boundary Schemas
# ============================================================================

class BoundaryBase(BaseModel):
    aoi_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    geometry: Optional[Any] = None  # GeoJSON geometry or WKBElement
    is_legal: bool = True


class BoundaryCreate(BoundaryBase):
    pass


class Boundary(BoundaryBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
    
    @model_serializer
    def serialize_model(self):
        """Serialize model with geometry conversion"""
        return {
            'id': self.id,
            'aoi_id': self.aoi_id,
            'name': self.name,
            'description': self.description,
            'geometry': wkb_to_geojson(self.geometry),
            'is_legal': self.is_legal,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }


# ============================================================================
# Time-Series Schemas
# ============================================================================

class TimeSeriesDataPoint(BaseModel):
    timestamp: datetime
    excavated_area_ha: float
    smoothed_area_ha: Optional[float] = None
    excavation_rate_ha_day: Optional[float] = None
    anomaly_score: Optional[float] = None
    confidence: Optional[float] = None


class TimeSeriesData(BaseModel):
    aoi_id: UUID
    boundary_id: UUID
    data_points: List[TimeSeriesDataPoint]


class TimeSeriesResponse(BaseModel):
    legal_boundary: List[TimeSeriesDataPoint]
    nogo_zones: List[TimeSeriesDataPoint]
    summary_stats: Dict[str, Any]


# ============================================================================
# Violation Schemas
# ============================================================================

class ViolationEventCreate(BaseModel):
    aoi_id: UUID
    nogo_zone_id: UUID
    event_type: str  # VIOLATION_START, ESCALATION, VIOLATION_RESOLVED
    detection_date: datetime
    excavated_area_ha: float
    description: Optional[str] = None
    severity: Optional[str] = None
    event_metadata: Optional[Dict[str, Any]] = None


class ViolationEvent(ViolationEventCreate):
    id: UUID
    is_resolved: bool
    resolved_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ViolationAlert(BaseModel):
    """Real-time violation alert for WebSocket"""
    event_id: UUID
    event_type: str
    detection_date: datetime
    excavated_area_ha: float
    nogo_zone_id: UUID
    severity: str
    description: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Analysis Config Schemas
# ============================================================================

class AnalysisConfigCreate(BaseModel):
    aoi_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    start_date: datetime
    end_date: datetime
    threshold_method: str = "hybrid"
    cloud_mask_method: str = "scl"
    smoothing_window: int = 5
    min_violation_area_ha: float = 0.01
    config_params: Optional[Dict[str, Any]] = None


class AnalysisConfig(AnalysisConfigCreate):
    id: UUID
    adaptive_threshold: Optional[float] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnalysisConfigUpdate(BaseModel):
    name: Optional[str] = None
    threshold_method: Optional[str] = None
    smoothing_window: Optional[int] = None
    min_violation_area_ha: Optional[float] = None
    is_active: Optional[bool] = None
    config_params: Optional[Dict[str, Any]] = None


# ============================================================================
# Job Status Schemas
# ============================================================================

class AnalysisJobStatus(BaseModel):
    id: UUID
    config_id: UUID
    job_type: str
    status: str
    progress_percent: float
    result_metadata: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


class JobStartRequest(BaseModel):
    config_id: UUID
    job_type: str


# ============================================================================
# Alert Subscription Schemas
# ============================================================================

class AlertSubscriptionCreate(BaseModel):
    aoi_id: UUID
    user_email: str
    webhook_url: Optional[str] = None
    alert_types: List[str] = [
        "VIOLATION_START",
        "ESCALATION",
        "VIOLATION_RESOLVED"
    ]


class AlertSubscription(AlertSubscriptionCreate):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Analytics Response Schemas
# ============================================================================

class SummaryStats(BaseModel):
    """Summary statistics for excavation analysis"""
    analysis_period_days: int
    total_observations: int
    adaptive_threshold: float
    legal_boundary_stats: Dict[str, float]
    nogo_zone_stats: Dict[str, float]
    total_violations: int
    violation_timeline: List[Dict[str, Any]]


class ExcavationSummary(BaseModel):
    """Complete excavation monitoring summary"""
    aoi_id: UUID
    analysis_config_id: UUID
    timeseries_data: TimeSeriesResponse
    violations: List[ViolationEvent]
    summary_stats: SummaryStats
    generated_at: datetime
