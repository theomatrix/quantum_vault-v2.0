"""
Global Anomaly Model
====================
Uses scikit-learn's Isolation Forest to detect system-wide anomalies
(e.g. distributed brute-force, API probing) from security telemetry data.

The model is trained on aggregated per-IP feature vectors and persisted
as a ``.pkl`` file via ``joblib``.
"""

from __future__ import annotations

import os
import sqlite3
import logging
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass
from typing import Dict, List, Optional

import numpy as np

logger = logging.getLogger("quantumvault.security")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Default path for the serialised model — relative to CWD (backend/)
DEFAULT_MODEL_PATH: str = os.path.join(
    os.path.dirname(__file__), "security_model.pkl"
)

# Minimum number of telemetry rows required before training makes sense.
MIN_TRAINING_SAMPLES: int = 10

# How far back (in hours) to look when building training data.
TRAINING_WINDOW_HOURS: int = 24


# ---------------------------------------------------------------------------
# Data transfer object for evaluation results
# ---------------------------------------------------------------------------

@dataclass
class AnomalyResult:
    """Result returned by ``GlobalSecurityAgent.evaluate_request``."""

    risk_score: float   # 0.0 (safe) → 1.0 (highly anomalous)
    is_anomaly: bool    # True when the model flags the request


# ---------------------------------------------------------------------------
# GlobalSecurityAgent
# ---------------------------------------------------------------------------

class GlobalSecurityAgent:
    """Wraps an ``IsolationForest`` for real-time anomaly scoring.

    Typical lifecycle
    -----------------
    1. Accumulate ≥ ``MIN_TRAINING_SAMPLES`` rows in ``security_telemetry``.
    2. Call ``train_model(db_name)`` (one-off or periodic cron/script).
    3. On every incoming request the middleware calls ``evaluate_request(fv)``
       which loads the pickled model and returns a risk score + anomaly flag.

    Attributes:
        model_path: Filesystem path where the trained ``.pkl`` is stored.
    """

    def __init__(self, model_path: str = DEFAULT_MODEL_PATH) -> None:
        self.model_path = model_path
        self._model = None  # lazy-loaded

    # --------------------------------------------------------------------- #
    # Training
    # --------------------------------------------------------------------- #

    def train_model(self, db_name: str) -> Dict[str, object]:
        """Fetch recent telemetry, engineer features, and fit an IsolationForest.

        The trained model is serialised to ``self.model_path`` via *joblib*.

        Args:
            db_name: Path to the SQLite database containing
                     ``security_telemetry``.

        Returns:
            A summary dict with ``status``, ``samples_used``, and
            ``model_path``.

        Raises:
            ValueError: If fewer than ``MIN_TRAINING_SAMPLES`` rows exist.
        """
        from sklearn.ensemble import IsolationForest
        import joblib

        features = self._extract_training_features(db_name)

        if len(features) < MIN_TRAINING_SAMPLES:
            raise ValueError(
                f"Need at least {MIN_TRAINING_SAMPLES} aggregated samples "
                f"to train; only {len(features)} available."
            )

        X = np.array(features)

        model = IsolationForest(
            n_estimators=100,
            contamination=0.1,        # expect ~10 % anomalous traffic
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X)

        joblib.dump(model, self.model_path)
        self._model = model

        logger.info(
            "Isolation Forest trained on %d samples → saved to %s",
            len(features),
            self.model_path,
        )

        return {
            "status": "trained",
            "samples_used": len(features),
            "model_path": self.model_path,
        }

    # --------------------------------------------------------------------- #
    # Evaluation (real-time)
    # --------------------------------------------------------------------- #

    def evaluate_request(self, feature_vector: List[float]) -> AnomalyResult:
        """Score a single request against the trained model.

        If no model file exists yet (pre-training phase) a safe default is
        returned so the application can operate normally.

        Args:
            feature_vector: Numeric features for one request — must match the
                dimensionality used during training.  Expected order:
                ``[requests_per_minute, failure_rate, mean_processing_time_ms]``

        Returns:
            An ``AnomalyResult`` with ``risk_score`` and ``is_anomaly``.
        """
        if not os.path.isfile(self.model_path):
            # No model trained yet — return safe defaults.
            logger.debug("No trained model found at %s; returning safe default.", self.model_path)
            return AnomalyResult(risk_score=0.0, is_anomaly=False)

        model = self._load_model()
        X = np.array([feature_vector])

        # decision_function: the lower (more negative), the more anomalous.
        raw_score: float = float(model.decision_function(X)[0])

        # Normalise to 0-1 where 1 = most anomalous.
        # Typical raw scores range roughly from -0.5 (anomaly) to +0.5 (normal).
        risk_score = round(max(0.0, min(1.0, 0.5 - raw_score)), 4)

        is_anomaly: bool = bool(model.predict(X)[0] == -1)

        return AnomalyResult(risk_score=risk_score, is_anomaly=is_anomaly)

    # --------------------------------------------------------------------- #
    # Internal helpers
    # --------------------------------------------------------------------- #

    def _load_model(self):
        """Lazy-load the model from disk (cached after first call)."""
        if self._model is None:
            import joblib
            self._model = joblib.load(self.model_path)
            logger.info("Loaded Isolation Forest model from %s", self.model_path)
        return self._model

    def _extract_training_features(self, db_name: str) -> List[List[float]]:
        """Build per-IP aggregate feature vectors from raw telemetry.

        Features (per IP, within the training window):
            0. requests_per_minute   — total requests / window minutes
            1. failure_rate          — fraction of failed attempts
            2. mean_processing_ms    — average processing time

        Returns:
            A list of feature vectors, one per unique IP.
        """
        cutoff = (
            datetime.now(timezone.utc) - timedelta(hours=TRAINING_WINDOW_HOURS)
        ).isoformat()

        with sqlite3.connect(db_name) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT
                    ip_address,
                    COUNT(*)                       AS total_requests,
                    SUM(is_failed_attempt)         AS total_failures,
                    AVG(processing_time_ms)        AS avg_proc_time,
                    MIN(timestamp)                 AS first_ts,
                    MAX(timestamp)                 AS last_ts
                FROM security_telemetry
                WHERE timestamp >= ?
                GROUP BY ip_address
                """,
                (cutoff,),
            )
            rows = cursor.fetchall()

        features: List[List[float]] = []

        for row in rows:
            total = row["total_requests"]
            failures = row["total_failures"] or 0
            avg_proc = row["avg_proc_time"] or 0.0

            # Estimate window span in minutes (min 1 to avoid division by 0)
            try:
                t_first = datetime.fromisoformat(row["first_ts"])
                t_last = datetime.fromisoformat(row["last_ts"])
                span_minutes = max(
                    (t_last - t_first).total_seconds() / 60.0, 1.0
                )
            except (TypeError, ValueError):
                span_minutes = 1.0

            requests_per_minute = total / span_minutes
            failure_rate = failures / total if total else 0.0

            features.append([
                round(requests_per_minute, 4),
                round(failure_rate, 4),
                round(avg_proc, 4),
            ])

        return features
