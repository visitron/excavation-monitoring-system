#!/usr/bin/env python3
"""Test script to check geometry API responses"""

import sys
import json
from app.database import SessionLocal
from app.models import AoI, MinerBoundary
from app.schemas import AoI as AoISchema, Boundary as BoundarySchema

db = SessionLocal()

try:
    # Get an AOI
    aoi = db.query(AoI).first()
    
    if aoi:
        print("=" * 80)
        print("AOI from database:")
        print(f"  ID: {aoi.id}")
        print(f"  Name: {aoi.name}")
        print(f"  Description: {aoi.description}")
        print(f"  Geometry type: {type(aoi.geometry)}")
        print(f"  Geometry value: {aoi.geometry}")
        print()
        
        # Serialize using schema
        print("After Pydantic serialization:")
        aoi_schema = AoISchema.model_validate(aoi)
        aoi_dict = aoi_schema.model_dump()
        print(json.dumps(aoi_dict, indent=2, default=str))
        print()
        
        # Get boundaries for this AOI
        boundaries = db.query(MinerBoundary).filter(MinerBoundary.aoi_id == aoi.id).all()
        print(f"Found {len(boundaries)} boundaries for this AOI")
        print()
        
        for i, boundary in enumerate(boundaries[:2]):  # Show first 2
            print(f"Boundary {i+1}:")
            print(f"  ID: {boundary.id}")
            print(f"  Name: {boundary.name}")
            print(f"  Is Legal: {boundary.is_legal}")
            print(f"  Geometry type: {type(boundary.geometry)}")
            print(f"  Geometry value: {boundary.geometry}")
            print()
            
            # Serialize using schema
            boundary_schema = BoundarySchema.model_validate(boundary)
            boundary_dict = boundary_schema.model_dump()
            print("After Pydantic serialization:")
            print(json.dumps(boundary_dict, indent=2, default=str))
            print()
    else:
        print("No AOIs found in database")
        
finally:
    db.close()
