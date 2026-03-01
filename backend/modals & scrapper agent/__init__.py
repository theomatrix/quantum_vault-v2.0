"""
Modals & Scrapper Agent — Behavioural Security Module
=====================================================
Exports the public API for integrating the security monitoring
layer into the QuantumVault FastAPI application.
"""

import sys as _sys

# Use absolute imports via sys.modules (reliable for dynamically loaded packages
# where the directory name isn't a valid Python identifier).
_models = _sys.modules["security_module.models"]
_global_model = _sys.modules["security_module.global_model"]
_user_baseline = _sys.modules["security_module.user_baseline"]
_agent = _sys.modules["security_module.agent"]

# ── Models ────────────────────────────────────────────────────────────────
TelemetryRecord = _models.TelemetryRecord
init_telemetry_db = _models.init_telemetry_db
init_user_profiles_db = _models.init_user_profiles_db
insert_telemetry_record = _models.insert_telemetry_record

# ── Global Anomaly Model ─────────────────────────────────────────────────
GlobalSecurityAgent = _global_model.GlobalSecurityAgent
AnomalyResult = _global_model.AnomalyResult

# ── Per-User Baseline Engine ─────────────────────────────────────────────
UserBehaviorAnalyzer = _user_baseline.UserBehaviorAnalyzer
DriftResult = _user_baseline.DriftResult
RequestMetadata = _user_baseline.RequestMetadata

# ── Monitoring Middleware ─────────────────────────────────────────────────
SecurityMonitorMiddleware = _agent.SecurityMonitorMiddleware

__all__ = [
    "TelemetryRecord",
    "init_telemetry_db",
    "init_user_profiles_db",
    "insert_telemetry_record",
    "GlobalSecurityAgent",
    "AnomalyResult",
    "UserBehaviorAnalyzer",
    "DriftResult",
    "RequestMetadata",
    "SecurityMonitorMiddleware",
]
