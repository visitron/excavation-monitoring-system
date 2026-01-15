"""
WebSocket endpoints for real-time alerts.
"""

import logging
from uuid import UUID
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.websocket import manager
from app import models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ws", tags=["websocket"])


@router.websocket("/violations/{aoi_id}")
async def websocket_violations(
    websocket: WebSocket,
    aoi_id: str,
    client_id: str = Query("anonymous"),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for real-time violation alerts.
    
    Usage:
        ws://localhost:8000/api/v1/ws/violations/{aoi_id}?client_id={client_id}
    
    The server will send JSON messages with structure:
    {
        "type": "violation_alert",
        "data": {
            "event_id": "...",
            "event_type": "VIOLATION_START|ESCALATION|VIOLATION_RESOLVED",
            "detection_date": "...",
            "excavated_area_ha": 0.5,
            "nogo_zone_id": "...",
            "severity": "HIGH",
            "description": "..."
        },
        "timestamp": "..."
    }
    """
    await manager.connect(websocket, aoi_id, client_id)

    try:
        while True:
            # Keep connection alive and wait for any incoming messages
            data = await websocket.receive_text()
            # Echo or process incoming messages if needed
            logger.debug(f"Received message from {client_id}: {data}")

    except WebSocketDisconnect:
        manager.disconnect(websocket, aoi_id, client_id)
        logger.info(f"Client {client_id} disconnected")

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, aoi_id, client_id)


@router.websocket("/status/{aoi_id}")
async def websocket_status(
    websocket: WebSocket,
    aoi_id: str,
    client_id: str = Query("anonymous")
):
    """
    WebSocket endpoint for analysis status updates.
    
    Sends job progress and status information.
    """
    await manager.connect(websocket, aoi_id, client_id)

    try:
        while True:
            data = await websocket.receive_text()
            logger.debug(f"Received status message from {client_id}: {data}")

    except WebSocketDisconnect:
        manager.disconnect(websocket, aoi_id, client_id)
        logger.info(f"Status client {client_id} disconnected")

    except Exception as e:
        logger.error(f"Status WebSocket error: {e}")
        manager.disconnect(websocket, aoi_id, client_id)
