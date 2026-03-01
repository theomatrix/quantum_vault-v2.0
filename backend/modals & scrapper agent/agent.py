"""
Security Monitoring Agent (Middleware)
======================================
A pure ASGI middleware that intercepts requests to sensitive endpoints,
extracts metadata (IP, path, timing, user-agent, username), scores them
via both the **Global Anomaly Model** and the **Per-User Baseline Engine**,
and asynchronously logs a telemetry record.

Uses the raw ASGI interface instead of Starlette's BaseHTTPMiddleware
to avoid the known deadlock issues with synchronous route handlers.

Hybrid scoring
--------------
``hybrid_risk_score = GLOBAL_WEIGHT × global_score + USER_WEIGHT × user_score``

Response headers injected on monitored endpoints:
    * ``X-Risk-Score``        — global anomaly score
    * ``X-User-Risk-Score``   — per-user drift score
    * ``X-Hybrid-Risk-Score`` — weighted combination
    * ``X-Is-Anomaly``        — True if the hybrid score exceeds the threshold
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import sqlite3
import time
from datetime import datetime, timezone, timedelta
from typing import Optional, Set

import sys as _sys
from starlette.types import ASGIApp, Receive, Scope, Send, Message

# Use sys.modules instead of relative imports — this package is loaded
# dynamically via importlib (directory name contains spaces / &).
_models = _sys.modules["security_module.models"]
TelemetryRecord = _models.TelemetryRecord
insert_telemetry_record = _models.insert_telemetry_record

_gm = _sys.modules["security_module.global_model"]
GlobalSecurityAgent = _gm.GlobalSecurityAgent

_ub = _sys.modules["security_module.user_baseline"]
UserBehaviorAnalyzer = _ub.UserBehaviorAnalyzer
RequestMetadata = _ub.RequestMetadata

logger = logging.getLogger("quantumvault.security")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Endpoints to monitor — a request is monitored if its path starts with any.
MONITORED_PREFIXES: Set[str] = {
    "/api/login",
    "/api/register",
    "/api/vault",
}

# Endpoints where per-user drift scoring applies.
USER_SCORED_PREFIXES: Set[str] = {
    "/api/login",
    "/api/vault",
}

# Hybrid score weights (must sum to 1.0).
GLOBAL_WEIGHT: float = 0.50
USER_WEIGHT: float = 0.50

# Hybrid anomaly threshold.
ANOMALY_THRESHOLD: float = 0.60

# Regex to extract username from vault paths like /api/vault/{username}/...
_VAULT_USER_RE = re.compile(r"^/api/vault/([^/]+)")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _should_monitor(path: str) -> bool:
    return any(path.startswith(p) for p in MONITORED_PREFIXES)


def _should_user_score(path: str) -> bool:
    return any(path.startswith(p) for p in USER_SCORED_PREFIXES)


def _extract_client_ip(scope: Scope) -> str:
    headers = dict(scope.get("headers", []))
    forwarded = headers.get(b"x-forwarded-for", b"").decode("utf-8", errors="ignore")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = scope.get("client")
    return client[0] if client else "unknown"


def _extract_user_agent(scope: Scope) -> str:
    """Pull the User-Agent header from the ASGI scope."""
    for key, value in scope.get("headers", []):
        if key == b"user-agent":
            return value.decode("utf-8", errors="replace")
    return "unknown"


def _extract_username_from_path(path: str) -> Optional[str]:
    """Extract username from vault-style paths: /api/vault/{username}/..."""
    m = _VAULT_USER_RE.match(path)
    return m.group(1) if m else None


async def _read_body(receive: Receive) -> tuple[bytes, list[Message]]:
    """Read the entire request body from the ASGI receive channel.

    Returns the full body bytes and a list of receive messages so they
    can be replayed to the downstream app.
    """
    body = b""
    messages: list[Message] = []
    while True:
        message = await receive()
        messages.append(message)
        body += message.get("body", b"")
        if not message.get("more_body", False):
            break
    return body, messages


def _extract_username_from_body(body: bytes) -> Optional[str]:
    """Try to parse 'username' from a JSON request body."""
    try:
        data = json.loads(body)
        return data.get("username")
    except (json.JSONDecodeError, TypeError, AttributeError):
        return None


def _build_quick_features(
    db_name: str, ip_address: str, processing_time_ms: float
) -> list[float]:
    """Build a lightweight feature vector for the Global Anomaly Model."""
    cutoff_start = (
        datetime.now(timezone.utc) - timedelta(seconds=60)
    ).isoformat()
    try:
        with sqlite3.connect(db_name) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT COUNT(*) AS cnt, SUM(is_failed_attempt) AS fails,
                       AVG(processing_time_ms) AS avg_pt
                FROM security_telemetry
                WHERE ip_address = ? AND timestamp >= ?
                """,
                (ip_address, cutoff_start),
            )
            row = cursor.fetchone()
        total = row["cnt"] if row and row["cnt"] else 0
        fails = row["fails"] if row and row["fails"] else 0
        avg_pt = row["avg_pt"] if row and row["avg_pt"] else processing_time_ms
        rpm = float(total)
        fr = fails / total if total > 0 else 0.0
    except Exception:
        rpm, fr, avg_pt = 1.0, 0.0, processing_time_ms
    return [round(rpm, 4), round(fr, 4), round(float(avg_pt), 4)]


# ---------------------------------------------------------------------------
# Pure ASGI Middleware
# ---------------------------------------------------------------------------

class SecurityMonitorMiddleware:
    """Pure ASGI middleware for behavioural security monitoring.

    For every request whose path matches ``MONITORED_PREFIXES``:

    1. Records the start time and extracts IP / User-Agent / username.
    2. Forwards the request and captures the response status code.
    3. Scores the request with both the **Global Agent** and the
       **Per-User Baseline Engine**.
    4. Computes a ``hybrid_risk_score`` and injects response headers.
    5. Fires background tasks to insert telemetry and (on login) update
       the user baseline — never blocking the response.
    """

    def __init__(self, app: ASGIApp, db_name: str = "vault_v2.db") -> None:
        self.app = app
        self.db_name = db_name
        self._global_agent = GlobalSecurityAgent()
        self._user_analyzer = UserBehaviorAnalyzer(db_name)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not _should_monitor(scope.get("path", "")):
            await self.app(scope, receive, send)
            return

        path: str = scope.get("path", "")
        method: str = scope.get("method", "GET")
        ip: str = _extract_client_ip(scope)
        user_agent: str = _extract_user_agent(scope)
        start = time.perf_counter()

        # ── Extract username ─────────────────────────────────────────
        # For login: parse from the JSON body.
        # For vault endpoints: parse from the URL path.
        username: Optional[str] = _extract_username_from_path(path)
        body_messages: list[Message] = []

        if path.startswith("/api/login") and method == "POST":
            body_bytes, body_messages = await _read_body(receive)
            username = _extract_username_from_body(body_bytes)

            # Build a new receive that replays the buffered body
            replay_idx = 0

            async def replay_receive() -> Message:
                nonlocal replay_idx
                if replay_idx < len(body_messages):
                    msg = body_messages[replay_idx]
                    replay_idx += 1
                    return msg
                return await receive()

            inner_receive = replay_receive
        else:
            inner_receive = receive

        # ── send_wrapper: inject headers after the response is ready ─
        response_status: int = 200

        async def send_wrapper(message: Message) -> None:
            nonlocal response_status

            if message["type"] == "http.response.start":
                response_status = message.get("status", 200)
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                is_failed = response_status >= 400

                # ── Global anomaly score ─────────────────────────────
                features = _build_quick_features(self.db_name, ip, elapsed_ms)
                global_result = self._global_agent.evaluate_request(features)
                global_score = global_result.risk_score

                # ── Per-user drift score ─────────────────────────────
                user_score = 0.0
                drift_reasons: list[str] = []

                if username and _should_user_score(path):
                    now_utc = datetime.now(timezone.utc)
                    frac_hour = now_utc.hour + now_utc.minute / 60.0
                    meta = RequestMetadata(
                        login_hour=frac_hour,
                        ip_address=ip,
                        user_agent=user_agent,
                    )
                    drift = self._user_analyzer.calculate_drift_score(username, meta)
                    user_score = drift.user_risk_score
                    drift_reasons = drift.drift_reasons

                # ── Hybrid score ─────────────────────────────────────
                hybrid = round(
                    GLOBAL_WEIGHT * global_score + USER_WEIGHT * user_score, 4
                )
                is_anomaly = hybrid >= ANOMALY_THRESHOLD

                # ── Inject headers ───────────────────────────────────
                headers = list(message.get("headers", []))
                headers.append((b"x-risk-score", str(global_score).encode()))
                headers.append((b"x-user-risk-score", str(user_score).encode()))
                headers.append((b"x-hybrid-risk-score", str(hybrid).encode()))
                headers.append((b"x-is-anomaly", str(is_anomaly).encode()))
                headers.append((
                    b"access-control-expose-headers",
                    b"X-Risk-Score, X-User-Risk-Score, X-Hybrid-Risk-Score, X-Is-Anomaly",
                ))
                message["headers"] = headers

                # ── Background: telemetry insert ─────────────────────
                record = TelemetryRecord(
                    ip_address=ip,
                    endpoint_path=path,
                    method=method,
                    processing_time_ms=elapsed_ms,
                    is_failed_attempt=is_failed,
                    global_risk_score=global_score,
                    user_id=username,
                    user_agent=user_agent,
                )
                asyncio.get_event_loop().call_soon(
                    lambda: _sync_insert(self.db_name, record)
                )

                # ── Background: update baseline on successful login ──
                if (
                    username
                    and path.startswith("/api/login")
                    and not is_failed
                ):
                    asyncio.get_event_loop().call_soon(
                        lambda uid=username: _sync_update_baseline(
                            self._user_analyzer, uid
                        )
                    )

                # ── Log anomalies ────────────────────────────────────
                if is_anomaly:
                    logger.warning(
                        "⚠ ANOMALY — IP=%s user=%s path=%s hybrid=%.4f reasons=%s",
                        ip, username or "?", path, hybrid, drift_reasons,
                    )

            await send(message)

        await self.app(scope, inner_receive, send_wrapper)


# ---------------------------------------------------------------------------
# Background helpers (fire-and-forget, non-blocking)
# ---------------------------------------------------------------------------

def _sync_insert(db_name: str, record: TelemetryRecord) -> None:
    try:
        insert_telemetry_record(db_name, record)
    except Exception as exc:
        logger.error("Failed to insert telemetry: %s", exc)


def _sync_update_baseline(analyzer: UserBehaviorAnalyzer, user_id: str) -> None:
    try:
        analyzer.update_user_baseline(user_id)
    except Exception as exc:
        logger.error("Failed to update baseline for user=%s: %s", user_id, exc)
