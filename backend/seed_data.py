"""
Seed the database with sample excavation data for testing.
Run: python seed_data.py
"""

import sys
from datetime import datetime, timedelta
from uuid import uuid4
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add app to path
sys.path.insert(0, '/absolute/path/backend')

from app.database import SessionLocal
from app.models import (
    AoI, MinerBoundary, ExcavationTimeSeries, 
    ViolationEvent, AnalysisConfig, ExcavationMask
)

def seed_data():
    """Populate database with sample data"""
    db = SessionLocal()
    
    try:
        # 1. Create or get default AOI
        aoi = db.query(AoI).filter(AoI.name == "Default AOI").first()
        if not aoi:
            aoi = AoI(
                name="Default AOI",
                description="Sample mining area in Southeast Asia",
                geometry="SRID=4326;POLYGON((98.5 15.0, 98.8 15.0, 98.8 15.3, 98.5 15.3, 98.5 15.0))"
            )
            db.add(aoi)
            db.commit()
            logger.info(f"✓ Created AOI: {aoi.id}")
        else:
            logger.info(f"✓ AOI already exists: {aoi.id}")
        
        # 2. Create legal boundary
        legal_boundary = db.query(MinerBoundary).filter(
            MinerBoundary.aoi_id == aoi.id,
            MinerBoundary.is_legal == True
        ).first()
        
        if not legal_boundary:
            legal_boundary = MinerBoundary(
                aoi_id=aoi.id,
                name="Legal Mining Zone A",
                description="Licensed mining boundary",
                geometry="SRID=4326;POLYGON((98.55 15.05, 98.75 15.05, 98.75 15.25, 98.55 15.25, 98.55 15.05))",
                is_legal=True
            )
            db.add(legal_boundary)
            db.commit()
            logger.info(f"✓ Created legal boundary: {legal_boundary.id}")
        
        # 3. Create no-go zone
        nogo_zone = db.query(MinerBoundary).filter(
            MinerBoundary.aoi_id == aoi.id,
            MinerBoundary.is_legal == False
        ).first()
        
        if not nogo_zone:
            nogo_zone = MinerBoundary(
                aoi_id=aoi.id,
                name="Protected Forest Zone",
                description="No-mining zone - protected area",
                geometry="SRID=4326;POLYGON((98.6 15.1, 98.7 15.1, 98.7 15.15, 98.6 15.15, 98.6 15.1))",
                is_legal=False
            )
            db.add(nogo_zone)
            db.commit()
            logger.info(f"✓ Created no-go zone: {nogo_zone.id}")
        
        # 4. Seed time-series data for legal boundary
        existing_timeseries = db.query(ExcavationTimeSeries).filter(
            ExcavationTimeSeries.boundary_id == legal_boundary.id
        ).count()
        
        if existing_timeseries == 0:
            base_date = datetime.utcnow() - timedelta(days=30)
            for day in range(31):
                ts = ExcavationTimeSeries(
                    aoi_id=aoi.id,
                    boundary_id=legal_boundary.id,
                    timestamp=base_date + timedelta(days=day),
                    excavated_area_ha=10 + (day * 0.5) + (day % 3) * 0.2,  # Gradual increase
                    smoothed_area_ha=10 + (day * 0.5),
                    excavation_rate_ha_day=0.5 + (day % 5) * 0.1,
                    anomaly_score=0.1 + (day % 7) * 0.05,
                    confidence=0.85 + (day % 10) * 0.01
                )
                db.add(ts)
            db.commit()
            logger.info(f"✓ Created 31 days of time-series data for legal boundary")
        
        # 5. Seed time-series data for no-go zone (lower values)
        existing_nogo_ts = db.query(ExcavationTimeSeries).filter(
            ExcavationTimeSeries.boundary_id == nogo_zone.id
        ).count()
        
        if existing_nogo_ts == 0:
            base_date = datetime.utcnow() - timedelta(days=30)
            for day in range(31):
                # Lower activity in no-go zone
                ts = ExcavationTimeSeries(
                    aoi_id=aoi.id,
                    boundary_id=nogo_zone.id,
                    timestamp=base_date + timedelta(days=day),
                    excavated_area_ha=0.1 + (day % 7) * 0.05,  # Low values
                    smoothed_area_ha=0.1 + (day % 7) * 0.03,
                    excavation_rate_ha_day=0.01 + (day % 5) * 0.01,
                    anomaly_score=0.3 + (day % 10) * 0.05,  # Higher anomaly = concerning
                    confidence=0.80 + (day % 10) * 0.01
                )
                db.add(ts)
            db.commit()
            logger.info(f"✓ Created 31 days of time-series data for no-go zone")
        
        # 6. Create sample violation events
        existing_violations = db.query(ViolationEvent).filter(
            ViolationEvent.aoi_id == aoi.id
        ).count()
        
        if existing_violations == 0:
            violation1 = ViolationEvent(
                aoi_id=aoi.id,
                nogo_zone_id=nogo_zone.id,
                event_type="VIOLATION_START",
                detection_date=datetime.utcnow() - timedelta(days=5),
                excavated_area_ha=0.3,
                description="Excavation detected in protected zone",
                severity="HIGH",
                is_resolved=False,
                event_metadata={"source": "satellite_imagery", "confidence": 0.92}
            )
            
            violation2 = ViolationEvent(
                aoi_id=aoi.id,
                nogo_zone_id=nogo_zone.id,
                event_type="ESCALATION",
                detection_date=datetime.utcnow() - timedelta(days=3),
                excavated_area_ha=0.5,
                description="Excavation area expanded in no-go zone",
                severity="CRITICAL",
                is_resolved=False,
                event_metadata={"source": "satellite_imagery", "confidence": 0.95}
            )
            
            violation3 = ViolationEvent(
                aoi_id=aoi.id,
                nogo_zone_id=nogo_zone.id,
                event_type="VIOLATION_RESOLVED",
                detection_date=datetime.utcnow() - timedelta(days=10),
                excavated_area_ha=0.2,
                description="Illegal excavation has ceased",
                severity="MEDIUM",
                is_resolved=True,
                resolved_date=datetime.utcnow() - timedelta(days=8),
                event_metadata={"source": "satellite_imagery"}
            )
            
            db.add_all([violation1, violation2, violation3])
            db.commit()
            logger.info(f"✓ Created 3 sample violation events")
        
        # 7. Create analysis config
        existing_config = db.query(AnalysisConfig).filter(
            AnalysisConfig.aoi_id == aoi.id
        ).first()
        
        if not existing_config:
            config = AnalysisConfig(
                aoi_id=aoi.id,
                name="Default Analysis Config",
                start_date=datetime.utcnow() - timedelta(days=30),
                end_date=datetime.utcnow(),
                adaptive_threshold=0.25,
                threshold_method="isolation_forest",
                cloud_mask_method="scl",
                smoothing_window=5,
                min_violation_area_ha=0.05,
                config_params={
                    "use_ai": True,
                    "alert_on_anomaly": True,
                    "min_confidence": 0.85
                },
                is_active=True
            )
            db.add(config)
            db.commit()
            logger.info(f"✓ Created analysis config")
        
        logger.info("\n✓ Database seeding completed successfully!")
        logger.info(f"  - AOI: {aoi.name} ({aoi.id})")
        logger.info(f"  - Legal boundary: {legal_boundary.name}")
        logger.info(f"  - No-go zone: {nogo_zone.name}")
        logger.info(f"  - Time-series data: 31 days x 2 boundaries = 62 records")
        logger.info(f"  - Violation events: 3 samples")
        logger.info(f"  - Analysis config: Ready for AI pipeline")
        
    except Exception as e:
        logger.error(f"✗ Error seeding data: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
