"""
Train the Isolation Forest Model
=================================
Standalone script to train the Global Anomaly Model from security
telemetry data stored in the SQLite database.

Usage (from backend/):
    python -m "modals & scrapper agent.train_model"

Or directly:
    python "modals & scrapper agent/train_model.py"

The script will:
1. Connect to vault_v2.db (or the DB you specify)
2. Aggregate per-IP features from the last 24h of telemetry
3. Fit an IsolationForest and save it as security_model.pkl
"""

from __future__ import annotations

import os
import sys
import argparse
import logging

# ── Setup import path so we can import from the security module ──
_this_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(_this_dir)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# We import directly from the file to avoid the complex dynamic-loading
from importlib.util import spec_from_file_location, module_from_spec

def _load_module(name, filepath):
    spec = spec_from_file_location(name, filepath)
    mod = module_from_spec(spec)
    sys.modules[name] = mod  # register so @dataclass can find __module__
    spec.loader.exec_module(mod)
    return mod

_global_model = _load_module("global_model", os.path.join(_this_dir, "global_model.py"))
GlobalSecurityAgent = _global_model.GlobalSecurityAgent

# ── Logger ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("train_model")


def main():
    parser = argparse.ArgumentParser(
        description="Train the QuantumVault Isolation Forest anomaly model."
    )
    parser.add_argument(
        "--db",
        default=os.path.join(_backend_dir, "vault_v2.db"),
        help="Path to the SQLite database (default: backend/vault_v2.db)",
    )
    parser.add_argument(
        "--model-path",
        default=None,
        help="Where to save the .pkl model (default: auto inside module dir)",
    )
    args = parser.parse_args()

    db_path = os.path.abspath(args.db)
    if not os.path.isfile(db_path):
        logger.error("Database not found: %s", db_path)
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("QuantumVault — Isolation Forest Training")
    logger.info("=" * 60)
    logger.info("Database : %s", db_path)

    agent = GlobalSecurityAgent(model_path=args.model_path) if args.model_path else GlobalSecurityAgent()

    logger.info("Model out: %s", agent.model_path)
    logger.info("-" * 60)

    try:
        result = agent.train_model(db_path)
        logger.info("✅  Training complete!")
        logger.info("    Status       : %s", result["status"])
        logger.info("    Samples used : %d", result["samples_used"])
        logger.info("    Model saved  : %s", result["model_path"])
    except ValueError as e:
        logger.warning("⚠️  Cannot train: %s", e)
        logger.info("    Run flood_telemetry.py first to generate training data.")
        sys.exit(1)
    except Exception as e:
        logger.error("❌  Training failed: %s", e, exc_info=True)
        sys.exit(2)

    logger.info("=" * 60)
    logger.info("Done. The model is ready for real-time scoring.")


if __name__ == "__main__":
    main()
