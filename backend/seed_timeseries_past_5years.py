"""
Seed time-series data for the past 5 years to simulate historical analysis runs.
This generates realistic excavation growth patterns over time.
"""

import sys
from datetime import datetime, timedelta
from uuid import UUID
from sqlalchemy.orm import Session

# Add app to path
sys.path.insert(0, '/app')

from app.database import engine, SessionLocal
from app import models
from app.main import Base

def get_aoi_by_name(db: Session, name: str = "Test AOI"):
    """Get AOI by name or return first available"""
    aoi = db.query(models.AoI).filter(models.AoI.name.ilike(f"%{name}%")).first()
    if not aoi:
        # Return first available AOI
        aoi = db.query(models.AoI).first()
    return aoi

def seed_timeseries_5years():
    """Generate 5 years of time-series data with realistic excavation growth"""
    
    db = SessionLocal()
    
    try:
        # Get an AOI (preferably user-created)
        aoi = get_aoi_by_name(db)
        if not aoi:
            print("❌ No AOI found. Please create an AOI first.")
            return
        
        print(f"🎯 Selected AOI: {aoi.name} ({aoi.id})")
        
        # Get boundaries for this AOI
        boundaries = db.query(models.MinerBoundary).filter(
            models.MinerBoundary.aoi_id == aoi.id
        ).all()
        
        if not boundaries:
            print(f"❌ No boundaries found for AOI {aoi.name}")
            return
        
        print(f"📍 Found {len(boundaries)} boundaries:")
        for b in boundaries:
            boundary_type = "Legal" if b.is_legal else "No-Go"
            print(f"   - {boundary_type}: {b.name}")
        
        # Generate data for past 5 years (bi-weekly snapshots = ~130 data points per boundary)
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=5*365)  # 5 years ago
        
        print(f"\n📅 Generating data from {start_date.date()} to {end_date.date()}")
        print(f"📊 Time span: {(end_date - start_date).days} days")
        
        # Create bi-weekly snapshots
        current_date = start_date
        snapshot_interval = timedelta(days=14)  # Every 2 weeks
        
        data_points_created = 0
        
        while current_date <= end_date:
            # Calculate days elapsed since start
            days_elapsed = (current_date - start_date).days
            progress_ratio = days_elapsed / (end_date - start_date).days
            
            # Simulate excavation growth over time (non-linear, accelerating)
            # Using sigmoid-like curve for realistic mining expansion
            base_growth = progress_ratio ** 1.3  # Accelerating excavation over time
            
            for boundary in boundaries:
                # Different growth rates for legal vs no-go zones
                if boundary.is_legal:
                    # Legal zone: steadier, slower growth
                    # 0.5 ha starting, grows to ~8 ha over 5 years
                    base_area = 0.5 + (base_growth * 7.5)
                    # Add some seasonal variation
                    seasonal_variation = 0.3 * (1 + 0.5 * (days_elapsed % 365) / 365)
                    excavated_area = base_area + seasonal_variation
                    area_ha = max(0, excavated_area)
                    
                else:
                    # No-go zone: violation growth (starts small, grows if violations occur)
                    # 0 ha starting, jumps to ~2-3 ha in later years (violation signal)
                    if progress_ratio < 0.6:
                        # Early period: minimal violations
                        area_ha = 0.1 + (progress_ratio * 0.3)
                    else:
                        # Later period: more violations detected
                        late_ratio = (progress_ratio - 0.6) / 0.4
                        area_ha = 0.4 + (late_ratio * 2.5)
                    
                    # Add some random variation
                    import random
                    area_ha += random.uniform(-0.2, 0.3)
                    area_ha = max(0, area_ha)
                
                # Create time-series record
                ts_record = models.ExcavationTimeSeries(
                    aoi_id=aoi.id,
                    boundary_id=boundary.id,
                    timestamp=current_date,
                    excavated_area_ha=round(area_ha, 4),
                    smoothed_area_ha=round(area_ha, 4),
                    excavation_rate_ha_day=round(base_growth * 0.005, 6),  # Slow rate
                    anomaly_score=round(progress_ratio * 0.5, 4),  # Increases over time
                    confidence=round(0.8 + (progress_ratio * 0.15), 3),  # Confidence improves
                    created_at=current_date,
                    updated_at=current_date
                )
                
                db.add(ts_record)
                data_points_created += 1
            
            # Move to next snapshot
            current_date += snapshot_interval
            
            # Progress indicator
            if data_points_created % (len(boundaries) * 5) == 0:
                print(f"  ✓ Generated {data_points_created} data points...")
        
        # Commit all records
        db.commit()
        
        print(f"\n✅ Time-series seeding complete!")
        print(f"📊 Created {data_points_created} total data points")
        print(f"   - Per boundary: {data_points_created // len(boundaries)}")
        print(f"   - Date range: {start_date.date()} to {end_date.date()}")
        
        # Show sample data
        print(f"\n📈 Sample data (latest records):")
        for boundary in boundaries:
            latest = db.query(models.ExcavationTimeSeries).filter(
                models.ExcavationTimeSeries.boundary_id == boundary.id
            ).order_by(models.ExcavationTimeSeries.timestamp.desc()).first()
            
            if latest:
                boundary_type = "Legal" if boundary.is_legal else "No-Go"
                print(f"   {boundary_type} ({boundary.name}):")
                print(f"      - Latest date: {latest.timestamp.date()}")
                print(f"      - Excavated area: {latest.excavated_area_ha:.4f} ha")
                print(f"      - Confidence: {latest.confidence*100:.1f}%")
        
        print(f"\n🎉 Dashboard will now show historical data with {data_points_created // len(boundaries)} data points per boundary!")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_timeseries_5years()
