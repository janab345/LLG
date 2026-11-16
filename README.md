# Lunar Lander Game (LLG)

A simple Lunar Lander game using React.js + HTML5 Canvas and Gymnasium (RL) with minimal set of parameters such as 

| Parameters        | Unit | Data type | State   |
| ----------------- | ---- | --------- | ------- |
| Time stamp        | time | time      | Dynamic |
| Fuel Consumed     | %    | int       | Dynamic |
| Vertical Velocity | m/s  | int       | Dynamic |
| Horizontal Vel    | m/s  | int       | Dynamic |
| Altitude          | m    | int       | Dynamic |
| Tilt Angle        | deg  | int       | Dynamic |
| Range to Pad      | m    | int       | Dynamic |
| Mode              | -    | Enum      | Static  |
| Result            | -    | Boolean   | Static  |

## Constant Parameters

1. Fuel Consumption - Mass flow (amount of fuel burnt per second)
2. Alt - (Starting point)
3. Range - starting point for lander to pad
4. Throttle impact on vertical velocity per percentage - tilt has to be accounted 

| Parameter from LLG.md    | Substituted Constant                | Unit    |
| :----------------------- | :---------------------------------- | :------ |
| **1. Fuel Consumption**  | `2.5%` (Main) / `0.5%` (Pitch)      | % / sec |
| **2. Starting Altitude** | `500.0`                             | meters  |
| **3. Starting Range**    | `300.0` (pos_x: `-300.0`)           | meters  |
| **4. Max Thrust Accel**  | `3.50` (projected by $\cos \theta$) | m/s²    |

These telemetry values will be stored in .csv file, so that we can train the Lander with Gymnasium RL to create a optimized policy only using the telemetry data of successful landings. (Imitation training instead of PPO)

## Constraints 

1. Sink Rate (< 1.0 m/s), Horizontal Velocity (<0.5 m/s)
2. Tilt Angle (<10 deg)
3. Fuel consumption (can't thrust or pitch after < 0%)

## Modes 

1. Easy - Gravity wouldn't act and constraints are relaxed. 
2. Hard - Includes Gravity Force (1.62 m/s which consumes more fuel and decreases the vertical velocity), strict constraints 

## Controls & Movements 

1. Thrust (△) - Ascending meters 
2. Pitch (◁ | ▷) - Tilt angle 
3. Pause (Spacebar)

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

## Project Structure

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

## 🧪 Testing

Run the test suite:
```bash
.venv/bin/python3 test_suite.py
```
Verifies physics equations, gravity modes, thruster fuel burn, landing constraints, 1 Hz CSV telemetry, and FastAPI WebSocket communication.
