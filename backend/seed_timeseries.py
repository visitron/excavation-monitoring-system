#!/usr/bin/env python3
"""
Seed time-series excavation data for testing.
Generates synthetic but realistic excavation trends over time.
"""

import os
import sys
from datetime import datetime, timedelta
from uuid import UUID
import random

# Add app to path
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, AoI, MinerBoundary, ExcavationTimeSeries

# Database setup
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./test.db')
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)

def seed_timeseries_data():
    """Generate synthetic time-series data for all AOIs."""
    db = SessionLocal()
    
    try:
        # Get all AOIs
        aois = db.query(AoI).all()
        
        if not aois:
            print("❌ No AOIs found. Please create AOIs first.")
            return
        
        for aoi in aois:
            print(f"\n📊 Seeding time-series data for AOI: {aoi.name}")
            
            # Get boundaries for this AOI
            legal_boundary = db.query(MinerBoundary).filter(
                MinerBoundary.aoi_id == aoi.id,
                MinerBoundary.is_legal == True
            ).first()
            
            nogo_boundaries = db.query(MinerBoundary).filter(
                MinerBoundary.aoi_id == aoi.id,
                MinerBoundary.is_legal == False
            ).all()
            
            if not legal_boundary:
                print(f"  ⚠️  Skipping: No legal boundary found")
                continue
            
            if not nogo_boundaries:
                print(f"  ⚠️  Skipping: No no-go zones found")
                continue
            
            # Generate 30 days of data (one point per day)
            base_date = datetime.utcnow() - timedelta(days=30)
            
            # Legal boundary excavation: gradual increase
            legal_area = 0.5  # Start at 0.5 ha
            legal_rate = 0.15  # 0.15 ha/day increase
            
            # No-go zone excavation: sporadic violations with trend
            nogo_area = 0.3  # Start at 0.3 ha
            nogo_rate = 0.08  # 0.08 ha/day increase
            
            # Clear existing time-series data for this AOI
            db.query(ExcavationTimeSeries).filter(
                ExcavationTimeSeries.aoi_id == aoi.id
            ).delete()
            
            # Generate data points
            for day in range(31):  # 0 to 30 days
                current_date = base_date + timedelta(days=day)
                
                # Legal boundary data
                # Add some noise to make it realistic
                legal_noise = random.uniform(-0.05, 0.05)
                legal_value = max(0.5, legal_area + (day * legal_rate) + legal_noise)
                
                legal_ts = ExcavationTimeSeries(
                    aoi_id=aoi.id,
                    boundary_id=legal_boundary.id,
                    timestamp=current_date,
                    excavated_area_ha=legal_value,
                    smoothed_area_ha=legal_area + (day * legal_rate),
                    excavation_rate_ha_day=legal_rate,
                    anomaly_score=random.uniform(0.1, 0.3),
                    confidence=random.uniform(0.85, 0.98)
                )
                db.add(legal_ts)
                
                # No-go zone data (for first no-go boundary)
                # Add more volatility to represent violations
                nogo_noise = random.uniform(-0.1, 0.15)
                nogo_value = max(0.3, nogo_area + (day * nogo_rate) + nogo_noise)
                
                nogo_ts = ExcavationTimeSeries(
                    aoi_id=aoi.id,
                    boundary_id=nogo_boundaries[0].id,
                    timestamp=current_date,
                    excavated_area_ha=nogo_value,
                    smoothed_area_ha=nogo_area + (day * nogo_rate),
                    excavation_rate_ha_day=nogo_rate,
                    anomaly_score=random.uniform(0.5, 0.9) if day % 5 == 0 else random.uniform(0.1, 0.4),
                    confidence=random.uniform(0.75, 0.95)
                )
                db.add(nogo_ts)
            
            db.commit()
            print(f"  ✅ Created 62 time-series data points (31 legal + 31 no-go)")
        
        print("\n✅ Time-series seeding completed!")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == '__main__':
    seed_timeseries_data()
