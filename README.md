# Lunar Lander Game (LLG)

A 2D Atari-style vector Lunar Lander simulation featuring a **server-side Gymnasium physics engine** powered by **FastAPI**, an interactive **React.js + HTML5 Canvas** mission control cockpit, and 1 Hz CSV flight telemetry logging for imitation learning / reinforcement learning.

---

## 🏛️ Architecture Overview

```
                      +---------------------------------------+
                      |       React.js Frontend (Browser)     |
                      |  - Atari 2D Vector Canvas (60 FPS)   |
                      |  - Top Pill Badges & Capsule Gauges   |
                      |  - Keyboard & Compact Touch Controls  |
                      +-------------------+-------------------+
                                          |
                                   WebSocket (/ws)
                           60 FPS Actions & State Stream
                                          |
                                          v
                      +---------------------------------------+
                      |         FastAPI Backend Server        |
                      |  - Headless Gymnasium Physics Loop    |
                      |  - LunarLanderEnv (Moon / Zero-G)     |
                      |  - 1 Hz Telemetry Logger             |
                      +-------------------+-------------------+
                                          |
                                    Logs to Disk
                                          v
                                    telemetry.csv
                      (Ready for Imitation Learning / Offline RL)
```

---

## 🚀 Quickstart

### 1. Install Dependencies
```bash
# Python backend dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# React frontend dependencies
cd frontend && npm install && npm run build && cd ..
```

### 2. Start the Mission Control Web App
```bash
.venv/bin/python3 server.py
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser!

---

## 📁 Clean Project Structure

```
├── config.py            # Physics parameters, gravity modes & constraints
├── lunar_lander_env.py  # Pure headless Gymnasium environment (no Pygame bloat)
├── server.py            # FastAPI WebSocket & HTTP REST server
├── telemetry.py         # 1 Hz flight telemetry CSV logger
├── test_suite.py        # Consolidated test suite (physics, constraints, server)
├── requirements.txt     # Python backend dependencies
├── telemetry.csv        # 1 Hz flight logs
└── frontend/            # React.js + HTML5 Canvas web client
```

---

## 🎮 Flight Controls

| Action | Primary Key | Secondary Key | On-Screen Button |
| :--- | :--- | :--- | :--- |
| **Thrust ($\triangle$)** | `Up Arrow` | `W` | `▲ Thrust` |
| **Pitch Left ($\triangleleft$)** | `Left Arrow` | `A` | `◀` |
| **Pitch Right ($\triangleright$)** | `Right Arrow` | `D` | `▶` |
| **Pause / Resume** | `Spacebar` | - | `⏸ / ▶` |
| **Toggle Mode** | `M` | - | `Mode: Easy / Hard` pill |
| **Restart Attempt** | `R` | - | `↺ [R]` pill |
| **Export Telemetry** | - | - | `CSV` pill |

---

## 🧪 Testing

Run the test suite:
```bash
.venv/bin/python3 test_suite.py
```
Verifies physics equations, gravity modes, thruster fuel burn, landing constraints, 1 Hz CSV telemetry, and FastAPI WebSocket communication.
