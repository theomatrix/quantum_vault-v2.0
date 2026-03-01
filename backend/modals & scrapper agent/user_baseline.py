"""
Per-User Behavioral Baseline Engine
====================================
Detects Account Takeover (ATO) attacks by building a statistical profile
of each user's normal behaviour (login times, IPs, devices) and flagging
drift when an incoming request deviates from that baseline.

Key design choices
------------------
* **Cyclical time encoding** — Login hours are mapped onto a unit circle
  via ``sin(2π·h/24)`` / ``cos(2π·h/24)`` so that 23:00 → 01:00 is
  correctly measured as 2 hours apart, not 22.
* **Angular std-dev** — Computed as the circular standard deviation using
  ``√(-2·ln(R))``, where ``R`` is the resultant vector length.
* **Edge-case safety** — A std-dev of exactly 0 (user always logs in at
  the same minute) still works: any deviation triggers max time-score,
  same time → 0.
* **Lightweight** — All queries are simple SQLite aggregations; no heavy
  ML model load on the hot path.
"""

from __future__ import annotations

import json
import logging
import math
import sqlite3
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

logger = logging.getLogger("quantumvault.security")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# How many days of history to consider when rebuilding a baseline.
BASELINE_WINDOW_DAYS: int = 30

# Minimum number of data points before the baseline is considered "mature".
# Below this threshold the time-score weight is halved to avoid false positives.
MATURITY_THRESHOLD: int = 3

# Maximum number of trusted IPs / User-Agents to retain.
MAX_TRUSTED_ITEMS: int = 10

# Weight allocation for the final user_risk_score (must sum to 1.0).
WEIGHT_TIME: float = 0.40
WEIGHT_IP: float = 0.35
WEIGHT_UA: float = 0.25

# The Z-score value above which we consider the time "unusual".
# ~2.0 ≈ 95 % confidence interval.
Z_SCORE_THRESHOLD: float = 2.0

TWO_PI: float = 2.0 * math.pi


# ---------------------------------------------------------------------------
# Data transfer objects
# ---------------------------------------------------------------------------

@dataclass
class RequestMetadata:
    """Metadata scraped from the current request for drift comparison."""

    login_hour: float       # Fractional hour (0.0 – 23.99), e.g. 14.5 = 2:30 PM
    ip_address: str
    user_agent: str


@dataclass
class DriftResult:
    """Result returned by ``UserBehaviorAnalyzer.calculate_drift_score``."""

    user_risk_score: float                  # 0.0 (safe) → 1.0 (highly anomalous)
    drift_reasons: List[str] = field(default_factory=list)
    time_z_score: float = 0.0              # Raw circular Z-score
    ip_is_new: bool = False
    ua_is_new: bool = False


# ---------------------------------------------------------------------------
# UserBehaviorAnalyzer
# ---------------------------------------------------------------------------

class UserBehaviorAnalyzer:
    """Builds and queries per-user behavioural baselines for ATO detection.

    Typical lifecycle
    -----------------
    1. On every successful login the middleware fires a background call to
       ``update_user_baseline(user_id)`` which (re)computes the profile.
    2. On every incoming request to a monitored endpoint the middleware
       calls ``calculate_drift_score(user_id, metadata)`` which compares
       the request against the stored profile and returns a risk score.

    Args:
        db_name: Path to the SQLite database (same one used by the app).
    """

    def __init__(self, db_name: str = "vault_v2.db") -> None:
        self.db_name = db_name

    # ------------------------------------------------------------------ #
    # Baseline update (background, non-blocking)
    # ------------------------------------------------------------------ #

    def update_user_baseline(self, user_id: str) -> None:
        """Rebuild the behavioural baseline for *user_id* from the last
        ``BASELINE_WINDOW_DAYS`` of successful telemetry.

        Stores the result in the ``user_security_profiles`` table via
        INSERT-or-REPLACE (upsert).
        """
        cutoff = (
            datetime.now(timezone.utc) - timedelta(days=BASELINE_WINDOW_DAYS)
        ).isoformat()

        with sqlite3.connect(self.db_name) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Fetch successful (non-failed) events for this user
            cursor.execute(
                """
                SELECT timestamp, ip_address, user_agent
                FROM security_telemetry
                WHERE user_id = ?
                  AND is_failed_attempt = 0
                  AND timestamp >= ?
                ORDER BY timestamp DESC
                """,
                (user_id, cutoff),
            )
            rows = cursor.fetchall()

        if not rows:
            logger.debug("No telemetry for user=%s — skipping baseline update.", user_id)
            return

        # ── Extract login hours (fractional) ─────────────────────────
        hours: List[float] = []
        ip_counter: Counter = Counter()
        ua_counter: Counter = Counter()

        for row in rows:
            try:
                ts = datetime.fromisoformat(row["timestamp"])
                fractional_hour = ts.hour + ts.minute / 60.0
                hours.append(fractional_hour)
            except (TypeError, ValueError):
                pass

            ip_counter[row["ip_address"]] += 1
            ua_val = row["user_agent"] or "unknown"
            ua_counter[ua_val] += 1

        # ── Cyclical mean & std-dev ──────────────────────────────────
        avg_sin, avg_cos, std_dev = _circular_stats(hours)

        # ── Trusted IPs & User-Agents (top-N by frequency) ──────────
        trusted_ips = [ip for ip, _ in ip_counter.most_common(MAX_TRUSTED_ITEMS)]
        trusted_uas = [ua for ua, _ in ua_counter.most_common(MAX_TRUSTED_ITEMS)]

        # ── Upsert into user_security_profiles ───────────────────────
        now_iso = datetime.now(timezone.utc).isoformat()

        with sqlite3.connect(self.db_name) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO user_security_profiles
                    (user_id, avg_login_hour_sin, avg_login_hour_cos,
                     login_hour_std_dev, trusted_ips, trusted_user_agents,
                     sample_count, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    avg_login_hour_sin  = excluded.avg_login_hour_sin,
                    avg_login_hour_cos  = excluded.avg_login_hour_cos,
                    login_hour_std_dev  = excluded.login_hour_std_dev,
                    trusted_ips         = excluded.trusted_ips,
                    trusted_user_agents = excluded.trusted_user_agents,
                    sample_count        = excluded.sample_count,
                    last_updated        = excluded.last_updated
                """,
                (
                    user_id,
                    avg_sin,
                    avg_cos,
                    std_dev,
                    json.dumps(trusted_ips),
                    json.dumps(trusted_uas),
                    len(rows),
                    now_iso,
                ),
            )
            conn.commit()

        logger.info(
            "Baseline updated for user=%s  samples=%d  std_dev=%.3f  ips=%d  uas=%d",
            user_id, len(rows), std_dev, len(trusted_ips), len(trusted_uas),
        )

    # ------------------------------------------------------------------ #
    # Drift scoring (real-time, lightweight)
    # ------------------------------------------------------------------ #

    def calculate_drift_score(
        self, user_id: str, meta: RequestMetadata
    ) -> DriftResult:
        """Compare the incoming request against the user's stored profile.

        If no profile exists yet (first-time user) a neutral score of 0.0
        is returned so new users are not penalised.

        Args:
            user_id: The username / user identifier.
            meta:    Scraped metadata from the current request.

        Returns:
            A ``DriftResult`` containing the composite ``user_risk_score``
            and a human-readable list of ``drift_reasons``.
        """
        profile = self._load_profile(user_id)

        # No profile yet → neutral (don't penalise brand-new users)
        if profile is None:
            return DriftResult(user_risk_score=0.0)

        reasons: List[str] = []

        # ── 1. Time drift (circular Z-score) ─────────────────────────
        z_score = _circular_z_score(
            current_hour=meta.login_hour,
            avg_sin=profile["avg_login_hour_sin"],
            avg_cos=profile["avg_login_hour_cos"],
            std_dev=profile["login_hour_std_dev"],
        )

        # Normalise Z-score to 0-1 via sigmoid-like clamping
        time_score = min(abs(z_score) / (Z_SCORE_THRESHOLD * 2), 1.0)

        if abs(z_score) > Z_SCORE_THRESHOLD:
            reasons.append(f"Unusual login time (Z={z_score:+.2f})")

        # ── 2. IP novelty ────────────────────────────────────────────
        trusted_ips: List[str] = json.loads(profile["trusted_ips"])
        ip_new = meta.ip_address not in trusted_ips
        ip_score = 1.0 if ip_new else 0.0
        if ip_new:
            reasons.append(f"New IP address: {meta.ip_address}")

        # ── 3. User-Agent novelty ────────────────────────────────────
        trusted_uas: List[str] = json.loads(profile["trusted_user_agents"])
        ua_new = meta.user_agent not in trusted_uas
        ua_score = 1.0 if ua_new else 0.0
        if ua_new:
            reasons.append("New device / browser (User-Agent)")

        # ── 4. Weighted composite score ──────────────────────────────
        # If the profile is immature (< MATURITY_THRESHOLD samples),
        # halve the time weight to reduce false positives.
        sample_count = profile["sample_count"]
        effective_time_weight = (
            WEIGHT_TIME * 0.5 if sample_count < MATURITY_THRESHOLD else WEIGHT_TIME
        )

        # Re-normalise weights so they sum to 1.0
        total_weight = effective_time_weight + WEIGHT_IP + WEIGHT_UA
        user_risk = (
            (effective_time_weight * time_score)
            + (WEIGHT_IP * ip_score)
            + (WEIGHT_UA * ua_score)
        ) / total_weight

        user_risk = round(min(max(user_risk, 0.0), 1.0), 4)

        return DriftResult(
            user_risk_score=user_risk,
            drift_reasons=reasons,
            time_z_score=round(z_score, 4),
            ip_is_new=ip_new,
            ua_is_new=ua_new,
        )

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    def _load_profile(self, user_id: str) -> Optional[Dict]:
        """Load the stored baseline profile for *user_id*."""
        with sqlite3.connect(self.db_name) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM user_security_profiles WHERE user_id = ?",
                (user_id,),
            )
            row = cursor.fetchone()
            return dict(row) if row else None


# ---------------------------------------------------------------------------
# Circular statistics helpers
# ---------------------------------------------------------------------------

def _circular_stats(hours: List[float]) -> tuple[float, float, float]:
    """Compute circular mean (sin/cos) and circular std-dev for a list
    of fractional hours (0–24).

    Returns:
        (avg_sin, avg_cos, std_dev_hours)
    """
    if not hours:
        return 0.0, 1.0, 0.0

    # Map each hour to an angle in radians (0 h → 0, 24 h → 2π)
    angles = [TWO_PI * h / 24.0 for h in hours]

    # Resultant vector components
    sum_sin = sum(math.sin(a) for a in angles)
    sum_cos = sum(math.cos(a) for a in angles)
    n = len(angles)

    avg_sin = sum_sin / n
    avg_cos = sum_cos / n

    # Resultant length R ∈ [0, 1]
    R = math.sqrt(avg_sin ** 2 + avg_cos ** 2)

    # Circular standard deviation:  σ = √(-2·ln(R))  (in radians),
    # then convert back to hours.
    if R > 0.9999:
        # Essentially no spread — all logins at the exact same time.
        std_dev_hours = 0.0
    elif R < 1e-9:
        # Uniformly spread across the clock — max dispersion.
        std_dev_hours = 12.0  # half the cycle
    else:
        std_dev_rad = math.sqrt(-2.0 * math.log(R))
        std_dev_hours = std_dev_rad * 24.0 / TWO_PI

    return round(avg_sin, 6), round(avg_cos, 6), round(std_dev_hours, 4)


def _circular_z_score(
    current_hour: float,
    avg_sin: float,
    avg_cos: float,
    std_dev: float,
) -> float:
    """Compute a Z-score for *current_hour* relative to a circular baseline.

    Edge cases:
        * ``std_dev == 0``: If the current hour matches the mean → 0.0,
          otherwise → a large fixed value (±4.0) to flag the anomaly
          without dividing by zero.
    """
    # Convert the stored circular mean back to an angle
    mean_angle = math.atan2(avg_sin, avg_cos)

    # Convert current hour to an angle
    current_angle = TWO_PI * current_hour / 24.0

    # Signed angular difference in (-π, π]
    diff = math.atan2(
        math.sin(current_angle - mean_angle),
        math.cos(current_angle - mean_angle),
    )

    # Convert angular difference back to hours
    diff_hours = diff * 24.0 / TWO_PI   # range ~ (-12, 12]

    if std_dev < 1e-6:
        # All historical logins at the exact same time.
        # If the current login matches perfectly → 0; otherwise → hard flag.
        return 0.0 if abs(diff_hours) < 0.05 else 4.0 * (1.0 if diff_hours > 0 else -1.0)

    return diff_hours / std_dev
