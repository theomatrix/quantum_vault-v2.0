import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import sys
import importlib
import importlib.util

# ---------------------------------------------------------------------------
# Dynamic import of the security module
# (directory name "modals & scrapper agent" is not a valid Python identifier)
# ---------------------------------------------------------------------------
_sec_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "modals & scrapper agent")

# 1. Create — but do NOT yet execute — the parent package
_spec = importlib.util.spec_from_file_location(
    "security_module",
    os.path.join(_sec_dir, "__init__.py"),
    submodule_search_locations=[_sec_dir],
)
security_module = importlib.util.module_from_spec(_spec)
sys.modules["security_module"] = security_module

# 2. Create AND execute each sub-module FIRST so that the relative
#    imports inside __init__.py can resolve them.
for _sub in ("models", "global_model", "user_baseline", "agent"):
    _sub_path = os.path.join(_sec_dir, f"{_sub}.py")
    _sub_spec = importlib.util.spec_from_file_location(
        f"security_module.{_sub}", _sub_path,
        submodule_search_locations=[_sec_dir],
    )
    _sub_mod = importlib.util.module_from_spec(_sub_spec)
    sys.modules[f"security_module.{_sub}"] = _sub_mod
    _sub_spec.loader.exec_module(_sub_mod)                 # ← execute NOW
    setattr(security_module, _sub, _sub_mod)               # ← attach to parent

# 3. Finally execute the parent package (__init__.py)
_spec.loader.exec_module(security_module)

from security_module import SecurityMonitorMiddleware, init_telemetry_db, init_user_profiles_db, GlobalSecurityAgent

app = FastAPI()

# CORS — allow Vite dev server during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Behavioural Security Monitoring Middleware
app.add_middleware(SecurityMonitorMiddleware, db_name="vault_v2.db")

# Serve the built React app (for production use)
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

DB_NAME = "vault_v2.db"

def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        # Create Users Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                salt TEXT NOT NULL,
                enc_sk TEXT NOT NULL,
                pk TEXT NOT NULL
            )
        """)
        # Create Vault Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vault (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                site TEXT NOT NULL,
                ciphertext TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT DEFAULT 'Personal',
                FOREIGN KEY (username) REFERENCES users (username)
            )
        """)
        conn.commit()

# Initialize DB on startup
@app.on_event("startup")
def on_startup():
    init_db()
    init_telemetry_db(DB_NAME)           # Create / migrate security_telemetry table
    init_user_profiles_db(DB_NAME)       # Create user_security_profiles table

@app.get("/")
def home():
    dist_index = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.isfile(dist_index):
        return FileResponse(dist_index)
    return {"message": "QuantumVault API — run the React dev server on port 5173"}


# -------------------------------
# Models
# -------------------------------

class RegisterRequest(BaseModel):
    username: str
    salt: str
    enc_sk: str  # Encrypted Kyber Secret Key
    pk: str      # Kyber Public Key

class LoginRequest(BaseModel):
    username: str

class CredentialPayload(BaseModel):
    id: str
    site: str
    category: str = "Personal"
    ciphertext: str
    content: str

# -------------------------------
# API Endpoints
# -------------------------------

@app.post("/api/register")
def register(data: RegisterRequest):
    try:
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (username, salt, enc_sk, pk) VALUES (?, ?, ?, ?)",
                (data.username, data.salt, data.enc_sk, data.pk)
            )
            conn.commit()
            return {"status": "success", "message": "User created"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="User already exists")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/login")
def login(data: LoginRequest):
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (data.username,))
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "status": "success",
            "salt": user["salt"],
            "enc_sk": user["enc_sk"],
            "pk": user["pk"]
        }

@app.get("/api/vault/{username}")
def get_vault(username: str):
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        # Verify user exists first
        cursor.execute("SELECT 1 FROM users WHERE username = ?", (username,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="User not found")

        cursor.execute("SELECT id, site, ciphertext, content, category FROM vault WHERE username = ?", (username,))
        rows = cursor.fetchall()
        
        vault_items = [dict(row) for row in rows]
        return {"vault": vault_items}

@app.post("/api/vault/{username}/add")
async def add_credential(username: str, payload: CredentialPayload):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        "INSERT INTO vault (id, username, site, ciphertext, content, category) VALUES (?, ?, ?, ?, ?, ?)",
        (payload.id, username, payload.site, payload.ciphertext, payload.content, payload.category)
    )
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.delete("/api/vault/{username}/delete/{cred_id}")
async def delete_credential(username: str, cred_id: str):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM vault WHERE id = ? AND username = ?", (cred_id, username))
    
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Credential not found")
        
    conn.commit()
    conn.close()
    return {"status": "success"}


# ───────────────────────────────────────────
# Security Dashboard API
# ───────────────────────────────────────────

@app.get("/api/security/dashboard")
def security_dashboard():
    """Global system overview — last 24 h of telemetry, hourly aggregation."""
    from datetime import datetime, timezone, timedelta
    import json

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        # ── Hourly traffic aggregation ─────────────────────────────
        c.execute("""
            SELECT
                strftime('%H', timestamp) AS hour,
                COUNT(*)                 AS requests,
                SUM(is_failed_attempt)   AS anomalies
            FROM security_telemetry
            WHERE timestamp >= ?
            GROUP BY hour
            ORDER BY hour
        """, (cutoff,))
        hourly_raw = {row["hour"]: dict(row) for row in c.fetchall()}

        traffic = []
        for h in range(24):
            hh = f"{h:02d}"
            row = hourly_raw.get(hh, {})
            traffic.append({
                "time": f"{hh}:00",
                "requests": row.get("requests", 0),
                "anomalies": row.get("anomalies", 0),
                "flagged": (row.get("anomalies", 0) or 0) > 2,
            })

        # ── Summary stats ──────────────────────────────────────────
        c.execute("""
            SELECT
                COUNT(*)                 AS total_requests,
                SUM(is_failed_attempt)   AS total_anomalies,
                COUNT(DISTINCT ip_address) AS unique_ips
            FROM security_telemetry
            WHERE timestamp >= ?
        """, (cutoff,))
        stats = dict(c.fetchone() or {})

        # ── Recent events (last 20) ────────────────────────────────
        c.execute("""
            SELECT id, timestamp, ip_address, endpoint_path, method,
                   processing_time_ms, is_failed_attempt, global_risk_score,
                   user_id, user_agent
            FROM security_telemetry
            ORDER BY id DESC LIMIT 20
        """)
        events = [dict(r) for r in c.fetchall()]

    return {
        "traffic": traffic,
        "total_requests": stats.get("total_requests", 0),
        "total_anomalies": stats.get("total_anomalies", 0),
        "unique_ips": stats.get("unique_ips", 0),
        "events": events,
    }


@app.get("/api/security/users")
def security_users():
    """List all user security profiles."""
    import json

    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        c.execute("SELECT * FROM user_security_profiles ORDER BY user_id")
        profiles = []
        for row in c.fetchall():
            r = dict(row)
            r["trusted_ips"] = json.loads(r.get("trusted_ips", "[]"))
            r["trusted_user_agents"] = json.loads(r.get("trusted_user_agents", "[]"))
            profiles.append(r)

    return {"users": profiles}


@app.get("/api/security/user/{user_id}")
def security_user_detail(user_id: str):
    """Single user profile + recent events."""
    import json

    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        # Profile
        c.execute("SELECT * FROM user_security_profiles WHERE user_id = ?", (user_id,))
        row = c.fetchone()
        profile = None
        if row:
            profile = dict(row)
            profile["trusted_ips"] = json.loads(profile.get("trusted_ips", "[]"))
            profile["trusted_user_agents"] = json.loads(profile.get("trusted_user_agents", "[]"))

        # Recent events for this user
        c.execute("""
            SELECT id, timestamp, ip_address, endpoint_path, method,
                   processing_time_ms, is_failed_attempt, global_risk_score,
                   user_id, user_agent
            FROM security_telemetry
            WHERE user_id = ?
            ORDER BY id DESC LIMIT 20
        """, (user_id,))
        events = [dict(r) for r in c.fetchall()]

    if not profile:
        return {"profile": None, "events": events}

    return {"profile": profile, "events": events}

