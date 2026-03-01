"""
Security Telemetry Models
=========================
Defines the ``security_telemetry`` table schema, the
``user_security_profiles`` table for per-user baselines, and Pydantic
models for runtime telemetry records.

IMPORTANT: These tables intentionally store NO passwords, keys, or secrets.
Only request metadata needed for anomaly detection.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Database Schema — raw SQL (matches the project's existing sqlite3 pattern)
# ---------------------------------------------------------------------------

# ── security_telemetry ────────────────────────────────────────────────────

_CREATE_TELEMETRY_TABLE = """
CREATE TABLE IF NOT EXISTS security_telemetry (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp           TEXT    NOT NULL,
    ip_address          TEXT    NOT NULL,
    endpoint_path       TEXT    NOT NULL,
    method              TEXT    NOT NULL,
    processing_time_ms  REAL    NOT NULL DEFAULT 0.0,
    is_failed_attempt   INTEGER NOT NULL DEFAULT 0,
    global_risk_score   REAL    NOT NULL DEFAULT 0.0
);
"""

_CREATE_TIMESTAMP_INDEX = """
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp
ON security_telemetry (timestamp);
"""

_CREATE_IP_INDEX = """
CREATE INDEX IF NOT EXISTS idx_telemetry_ip
ON security_telemetry (ip_address);
"""

# Migration: add user_id and user_agent columns (safe to run repeatedly)
_ALTER_ADD_USER_ID = """
ALTER TABLE security_telemetry ADD COLUMN user_id TEXT DEFAULT NULL;
"""

_ALTER_ADD_USER_AGENT = """
ALTER TABLE security_telemetry ADD COLUMN user_agent TEXT DEFAULT NULL;
"""

_CREATE_USERID_INDEX = """
CREATE INDEX IF NOT EXISTS idx_telemetry_user_id
ON security_telemetry (user_id);
"""

# ── user_security_profiles ────────────────────────────────────────────────

_CREATE_USER_PROFILES_TABLE = """
CREATE TABLE IF NOT EXISTS user_security_profiles (
    user_id              TEXT    PRIMARY KEY,
    avg_login_hour_sin   REAL    NOT NULL DEFAULT 0.0,
    avg_login_hour_cos   REAL    NOT NULL DEFAULT 1.0,
    login_hour_std_dev   REAL    NOT NULL DEFAULT 0.0,
    trusted_ips          TEXT    NOT NULL DEFAULT '[]',
    trusted_user_agents  TEXT    NOT NULL DEFAULT '[]',
    sample_count         INTEGER NOT NULL DEFAULT 0,
    last_updated         TEXT    NOT NULL
);
"""


# ---------------------------------------------------------------------------
# Initialisation helpers
# ---------------------------------------------------------------------------

def init_telemetry_db(db_name: str) -> None:
    """Create / migrate the security_telemetry table.

    Safe to call on every startup — uses ``IF NOT EXISTS`` and silently
    ignores "duplicate column" errors from the ALTER TABLE migrations.

    Args:
        db_name: Path to the SQLite database file (e.g. ``vault_v2.db``).
    """
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()

        # Core table + indices
        cursor.execute(_CREATE_TELEMETRY_TABLE)
        cursor.execute(_CREATE_TIMESTAMP_INDEX)
        cursor.execute(_CREATE_IP_INDEX)

        # Migrations — add columns if they don't exist yet
        for alter_sql in (_ALTER_ADD_USER_ID, _ALTER_ADD_USER_AGENT):
            try:
                cursor.execute(alter_sql)
            except sqlite3.OperationalError:
                # Column already exists — that's fine.
                pass

        cursor.execute(_CREATE_USERID_INDEX)
        conn.commit()


def init_user_profiles_db(db_name: str) -> None:
    """Create the ``user_security_profiles`` table if it doesn't exist.

    Args:
        db_name: Path to the SQLite database file.
    """
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
        cursor.execute(_CREATE_USER_PROFILES_TABLE)
        conn.commit()


# ---------------------------------------------------------------------------
# Telemetry insert
# ---------------------------------------------------------------------------

def insert_telemetry_record(db_name: str, record: "TelemetryRecord") -> None:
    """Insert a single telemetry record (designed to be called from a
    background task so it never blocks the API response).

    Args:
        db_name: Path to the SQLite database file.
        record:  A populated ``TelemetryRecord`` instance.
    """
    with sqlite3.connect(db_name) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO security_telemetry
                (timestamp, ip_address, endpoint_path, method,
                 processing_time_ms, is_failed_attempt, global_risk_score,
                 user_id, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.timestamp,
                record.ip_address,
                record.endpoint_path,
                record.method,
                record.processing_time_ms,
                int(record.is_failed_attempt),
                record.global_risk_score,
                record.user_id,
                record.user_agent,
            ),
        )
        conn.commit()


# ---------------------------------------------------------------------------
# Pydantic model for runtime use
# ---------------------------------------------------------------------------

class TelemetryRecord(BaseModel):
    """Runtime representation of a single telemetry event.

    Fields mirror the ``security_telemetry`` database columns.
    """

    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO-8601 UTC timestamp of the event.",
    )
    ip_address: str = Field(
        ..., description="Client IP address."
    )
    endpoint_path: str = Field(
        ..., description="Request path, e.g. /api/login."
    )
    method: str = Field(
        ..., description="HTTP method (GET, POST, …)."
    )
    processing_time_ms: float = Field(
        default=0.0, description="Round-trip processing time in milliseconds."
    )
    is_failed_attempt: bool = Field(
        default=False, description="True when the response status indicates failure (4xx/5xx)."
    )
    global_risk_score: float = Field(
        default=0.0, description="Anomaly risk score assigned by the Global Model."
    )
    user_id: Optional[str] = Field(
        default=None, description="Username associated with this request (if identifiable)."
    )
    user_agent: Optional[str] = Field(
        default=None, description="User-Agent header string."
    )
