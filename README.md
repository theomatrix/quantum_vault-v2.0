<div align="center">

# 🔐 QuantumVault

### Post-Quantum Credential Vault with AI-Powered Security

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A credential vault that uses **ML-KEM (Kyber) post-quantum key encapsulation** for encryption and an **AI behavioral security layer** (Isolation Forest + per-user drift detection) to detect attacks in real time.

<br>

</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Security Module](#-security-module)
- [Training the AI Model](#-training-the-ai-model)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Contributing](#-contributing)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔑 **Post-Quantum Encryption** | ML-KEM (Kyber-768) key encapsulation + AES-256-GCM — resistant to quantum computer attacks |
| 🧠 **Global Anomaly Detection** | Isolation Forest ML model detects distributed brute-force, API probing, and credential stuffing |
| 👤 **Per-User Behavioral Baseline** | Cyclical Z-score drift detection flags Account Takeover (ATO) from unusual times, new IPs, unknown devices |
| 📊 **Security Command Center** | Real-time dashboard with risk gauge, 24h traffic chart, user trust scores, and event timeline |
| 🔄 **Hybrid Risk Scoring** | Combines global anomaly score + user drift score → single `X-Hybrid-Risk-Score` header on every response |
| 🛡️ **Zero Secret Storage** | Security telemetry never stores passwords, keys, or secrets — only request metadata |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend (Vite)                    │
│  Landing Page → Auth → Dashboard → Security Command Center  │
└────────────────────────┬────────────────────────────────────┘
                         │  /api/*
┌────────────────────────▼────────────────────────────────────┐
│                    FastAPI Backend                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         SecurityMonitorMiddleware (ASGI)              │    │
│  │  Extracts: IP, User-Agent, Username, Timing          │    │
│  │                                                       │    │
│  │  ┌──────────────────┐  ┌────────────────────────┐    │    │
│  │  │  Global Agent     │  │  User Baseline Engine  │    │    │
│  │  │  (Isolation Forest)│  │  (Circular Z-scores)   │    │    │
│  │  └────────┬─────────┘  └──────────┬─────────────┘    │    │
│  │           │    hybrid = 0.5g + 0.5u    │              │    │
│  │           └────────────┬───────────────┘              │    │
│  │                        ▼                              │    │
│  │            Response Headers Injected:                  │    │
│  │            X-Risk-Score, X-User-Risk-Score,           │    │
│  │            X-Hybrid-Risk-Score, X-Is-Anomaly          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  POST /api/login     POST /api/register                      │
│  GET  /api/vault/*   GET  /api/security/dashboard            │
└──────────────────────────┬───────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  SQLite DB   │
                    │  vault_v2.db │
                    └─────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Crypto** | ML-KEM (Kyber-768), AES-256-GCM, Shamir's Secret Sharing |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, SQLite |
| **ML/AI** | scikit-learn (Isolation Forest), NumPy, Joblib |
| **Frontend** | React 19, Vite 7, Recharts, Framer Motion, Lucide Icons |
| **Security** | Custom ASGI middleware, circular statistics, Z-score drift detection |

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+** — [Download](https://www.python.org/downloads/)
- **Node.js 18+** — [Download](https://nodejs.org/)
- **Git** — [Download](https://git-scm.com/)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/QuantumVault.git
cd QuantumVault
```

### 2. Set up the backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows
.\venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn[standard]
pip install scikit-learn joblib numpy
```

### 3. Set up the frontend

```bash
cd frontend

# Install dependencies
npm install
```

### 4. Start the development servers

Open **two terminals**:

**Terminal 1 — Backend (port 8000):**
```bash
cd backend
.\venv\Scripts\activate        # or: source venv/bin/activate
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend (port 5173):**
```bash
cd frontend
npm run dev
```

### 5. Open in browser

Navigate to **http://localhost:5173** → Register an account → Start using the vault.

---

## 🛡️ Security Module

The behavioral security layer lives in `backend/modals & scrapper agent/` and consists of:

| File | Purpose |
|---|---|
| `agent.py` | ASGI middleware — intercepts requests, runs both scoring engines, injects headers |
| `global_model.py` | Isolation Forest for system-wide anomaly detection |
| `user_baseline.py` | Per-user behavioral drift detection (cyclical Z-scores) |
| `models.py` | Database schemas (`security_telemetry`, `user_security_profiles`) |
| `train_model.py` | **Standalone script** to train the Isolation Forest |
| `flood_telemetry.py` | **Synthetic data generator** for populating training data |

### Response Headers (on every monitored request)

| Header | Range | Meaning |
|---|---|---|
| `X-Risk-Score` | 0.0 – 1.0 | Global anomaly score (Isolation Forest) |
| `X-User-Risk-Score` | 0.0 – 1.0 | Per-user behavioral drift score |
| `X-Hybrid-Risk-Score` | 0.0 – 1.0 | Weighted combo: `0.5 × global + 0.5 × user` |
| `X-Is-Anomaly` | True / False | Whether hybrid score exceeds threshold (0.60) |

---

## 🧠 Training the AI Model

> **Important:** The Isolation Forest starts in **cold start** (returns 0.0 for all requests) until you train it. Follow these steps to escape cold start.

### Step 1 — Generate Synthetic Training Data

The flood script inserts realistic telemetry records into the database with a **70% normal / 30% anomalous** distribution:

```bash
cd backend

# Activate your virtual environment first
.\venv\Scripts\activate

# Generate 300 synthetic records (default)
python "modals & scrapper agent/flood_telemetry.py"

# Or specify a custom count
python "modals & scrapper agent/flood_telemetry.py" --count 500
```

**What the synthetic data looks like:**

| Type | Behavior | Source |
|---|---|---|
| ✅ Normal (70%) | Business-hour logins (8am–10pm), trusted IPs, real browsers, 5% failure rate |
| 🔨 Brute-force | Rapid-fire failed logins from suspicious IPs, automated tools |
| 🔍 Scanning | Probing vault endpoints, high failure rate, command-line tools |
| 🕐 Unusual time | Logins at 1–5 AM from unknown IPs (possible credential compromise) |
| 🎯 Credential stuffing | Random nonexistent users, high failure, automated User-Agents |

### Step 2 — Train the Model

```bash
python "modals & scrapper agent/train_model.py"
```

You should see:
```
QuantumVault — Isolation Forest Training
============================================================
Database : .../vault_v2.db
Model out: .../security_model.pkl
------------------------------------------------------------
✅  Training complete!
    Status       : trained
    Samples used : 21
    Model saved  : .../security_model.pkl
============================================================
```

### Step 3 — Verify

1. **Restart the backend** (it will load the new model on next request):
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```

2. **Check the dashboard** at `http://localhost:5173/security`:
   - The **System Health Bar** should show `Global Agent: Online` (green)
   - The **Isolation Forest Threat Score** gauge should show a non-zero value
   - The **traffic chart** should show real data from the flooded records

### Retraining

Run the training script again anytime to update the model with fresh telemetry data:

```bash
python "modals & scrapper agent/train_model.py"
```

> 💡 **Tip:** The model needs at least **10 unique IP aggregates** in the last 24 hours of telemetry to train. If you get a "Need at least 10 samples" error, run the flood script first.

---

## 📁 Project Structure

```
QuantumVault/
├── .gitignore
├── README.md
├── SECURITY_MODULE_DOCS.md          # Detailed security module documentation
│
├── backend/
│   ├── main.py                      # FastAPI app, routes, security init
│   ├── vault_Core.py                # ML-KEM crypto, AES, Shamir's SS
│   ├── requirements.txt             # Python dependencies
│   │
│   └── modals & scrapper agent/     # Behavioral Security Module
│       ├── __init__.py              # Package exports
│       ├── agent.py                 # ASGI monitoring middleware
│       ├── global_model.py          # Isolation Forest model
│       ├── user_baseline.py         # Per-user drift detection
│       ├── models.py                # DB schemas & Pydantic models
│       ├── train_model.py           # ← Training script (run manually)
│       └── flood_telemetry.py       # ← Synthetic data generator
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx                  # Router setup
        ├── main.jsx                 # Entry point
        ├── index.css                # Global styles
        ├── pages/
        │   ├── LandingPage.jsx
        │   ├── AuthPage.jsx
        │   ├── DashboardPage.jsx
        │   └── SecurityInsightsPage.jsx  # Security Command Center
        ├── components/              # Navbar, Toast, etc.
        ├── context/                 # React context (auth state)
        └── lib/                     # Crypto utilities
```

### What NOT to commit

| Path | Reason |
|---|---|
| `backend/venv/` | Virtual environment — recreate with `pip install` |
| `frontend/node_modules/` | NPM packages — recreate with `npm install` |
| `*.db` | SQLite databases contain user data |
| `*.pkl` | Trained ML models — regenerate with `train_model.py` |
| `frontend/dist/` | Build output — regenerate with `npm run build` |
| `__pycache__/` | Python bytecode cache |

---

## 📡 API Reference

### Core Vault API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/register` | Register a new user (username, salt, enc_sk, pk) |
| `POST` | `/api/login` | Login and retrieve encrypted key material |
| `GET` | `/api/vault/{username}` | Retrieve all vault credentials |
| `POST` | `/api/vault/{username}/add` | Store a new encrypted credential |
| `DELETE` | `/api/vault/{username}/delete/{id}` | Delete a credential |

### Security Dashboard API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/security/dashboard` | Global overview: 24h traffic, stats, events |
| `GET` | `/api/security/users` | List all user security profiles |
| `GET` | `/api/security/user/{id}` | Single user profile + recent events |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run the backend and frontend to verify
5. Commit: `git commit -m "feat: add my feature"`
6. Push: `git push origin feature/my-feature`
7. Open a Pull Request

### First-time setup for contributors

```bash
# 1. Clone and setup
git clone https://github.com/YOUR_USERNAME/QuantumVault.git
cd QuantumVault

# 2. Backend
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install fastapi uvicorn[standard] scikit-learn joblib numpy

# 3. Frontend
cd ../frontend
npm install

# 4. Escape cold start (train the AI model)
cd ../backend
python "modals & scrapper agent/flood_telemetry.py" --count 300
python "modals & scrapper agent/train_model.py"

# 5. Start dev servers (two terminals)
python -m uvicorn main:app --reload --port 8000   # Terminal 1
cd ../frontend && npm run dev                       # Terminal 2
```

---

<div align="center">
<sub>Built with 🔐 post-quantum cryptography and 🧠 machine learning</sub>
</div>
