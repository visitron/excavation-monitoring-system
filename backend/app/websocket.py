"""
WebSocket manager for real-time alerts.
Handles connections and broadcasts violation events to subscribed clients.
"""

import json
import logging
from typing import Set, Dict, List
from datetime import datetime
from uuid import UUID
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and broadcasts"""

    def __init__(self):
        # Store active connections by AOI
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.aoi_subscriptions: Dict[str, List[str]] = {}  # AOI -> user emails

    async def connect(self, websocket: WebSocket, aoi_id: str, client_id: str):
        """Accept a new WebSocket connection"""
        await websocket.accept()

        if aoi_id not in self.active_connections:
            self.active_connections[aoi_id] = set()
        if aoi_id not in self.aoi_subscriptions:
            self.aoi_subscriptions[aoi_id] = []

        self.active_connections[aoi_id].add(websocket)

        logger.info(f"Client {client_id} connected to AOI {aoi_id}")
        logger.info(
            f"Active connections for {aoi_id}: {len(self.active_connections[aoi_id])}"
        )

    def disconnect(self, websocket: WebSocket, aoi_id: str, client_id: str):
        """Remove a disconnected WebSocket"""
        if aoi_id in self.active_connections:
            self.active_connections[aoi_id].discard(websocket)

            if not self.active_connections[aoi_id]:
                del self.active_connections[aoi_id]

        logger.info(f"Client {client_id} disconnected from AOI {aoi_id}")

    async def broadcast_violation(self, aoi_id: str, violation_alert: dict):
        """Broadcast violation alert to all connected clients for an AOI"""
        if aoi_id not in self.active_connections:
            logger.debug(f"No active connections for AOI {aoi_id}")
            return

        message = json.dumps({
            "type": "violation_alert",
            "data": violation_alert,
            "timestamp": datetime.utcnow().isoformat()
        })

        disconnected_clients = []

        for websocket in self.active_connections[aoi_id]:
            try:
                await websocket.send_text(message)
                logger.debug(f"Alert sent to client on AOI {aoi_id}")
            except Exception as e:
                logger.error(f"Error sending alert: {e}")
                disconnected_clients.append(websocket)

        # Clean up disconnected clients
        for websocket in disconnected_clients:
            self.active_connections[aoi_id].discard(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send a message to a specific client"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")

    async def broadcast_status(self, aoi_id: str, status: dict):
        """Broadcast status update to all connected clients for an AOI"""
        if aoi_id not in self.active_connections:
            return

        message = json.dumps({
            "type": "status_update",
            "data": status,
            "timestamp": datetime.utcnow().isoformat()
        })

        for websocket in self.active_connections[aoi_id]:
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting status: {e}")


# Global connection manager instance
manager = ConnectionManager()
