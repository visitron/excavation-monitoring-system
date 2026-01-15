"""
Quick diagnostics script to verify setup
Run: python test_setup.py
"""

import sys
import requests
import json

print("\n" + "="*60)
print("EXCAVATION MONITORING - SETUP DIAGNOSTICS")
print("="*60)

# 1. Check backend connectivity
print("\n1️⃣  Checking Backend Connection...")
try:
    response = requests.get('http://localhost:8000/docs', timeout=2)
    print("✓ Backend is running on http://localhost:8000")
except Exception as e:
    print(f"✗ Backend not running: {e}")
    print("  → Run: python run.py")
    sys.exit(1)

# 2. Check health endpoint
print("\n2️⃣  Checking Health Endpoint...")
try:
    response = requests.get('http://localhost:8000/api/v1/health')
    health = response.json()
    print(f"✓ Health: {health['status']}")
    print(f"  - AOIs: {health.get('database', {}).get('aoi_count', 'unknown')}")
    print(f"  - Boundaries: {health.get('database', {}).get('boundary_count', 'unknown')}")
except Exception as e:
    print(f"✗ Health check failed: {e}")

# 3. Check AOI endpoint
print("\n3️⃣  Checking AOI Endpoint...")
try:
    response = requests.get('http://localhost:8000/api/v1/aoi')
    aois = response.json()
    print(f"✓ Found {len(aois)} AOIs")
    for aoi in aois:
        print(f"  - {aoi.get('name', 'Unknown')} (ID: {aoi.get('id', 'Unknown')})")
except Exception as e:
    print(f"✗ AOI fetch failed: {e}")
    print("\n  → Try running: python seed_data.py")

# 4. Check time-series endpoint
print("\n4️⃣  Checking Time-Series Endpoint...")
try:
    response = requests.get('http://localhost:8000/api/v1/timeseries/default-aoi')
    data = response.json()
    legal_count = len(data.get('legal_boundary', []))
    nogo_count = len(data.get('nogo_zones', []))
    print(f"✓ Time-series data found")
    print(f"  - Legal boundary: {legal_count} points")
    print(f"  - No-go zones: {nogo_count} points")
except Exception as e:
    print(f"✗ Time-series fetch failed: {e}")

# 5. Check violations endpoint
print("\n5️⃣  Checking Violations Endpoint...")
try:
    response = requests.get('http://localhost:8000/api/v1/violations/default-aoi')
    violations = response.json()
    print(f"✓ Found {len(violations)} violation events")
    for v in violations[:3]:
        print(f"  - {v.get('event_type', 'Unknown')}: {v.get('severity', 'Unknown')}")
except Exception as e:
    print(f"✗ Violations fetch failed: {e}")

print("\n" + "="*60)
print("✓ SETUP COMPLETE - Ready to access frontend!")
print("  → Open http://localhost:3000 in your browser")
print("="*60 + "\n")
