# Lunar Lander Game (LLG)

A 2D Atari vector wireframe Lunar Lander game built with **FastAPI + Gymnasium (server-side continuous physics)** and **React.js + HTML5 Canvas (frontend)**, featuring an **Imitation & Reinforcement Learning (DAgger) policy** trained on successful telemetry data.

📖 **Flight Guide**: Check out **[guide.md](file:///home/obi025/Documents/LLG/guide.md)** for a complete step-by-step pilot manual on how to land gently and master both Easy and Hard modes.

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

---

## Calibrated Parameters

| Parameter from LLG.md    | Substituted Constant                | Unit    | Description |
| :----------------------- | :---------------------------------- | :------ | :---------- |
| **1. Fuel Consumption**  | `2.5%` Hard / `1.0%` Easy (Main)    | % / sec | Rate of propellant consumption during thrusting |
| **2. Starting Altitude** | `500.0`                             | meters  | Initial release altitude |
| **3. Starting Range**    | `300.0` (pos_x: `-300.0`)           | meters  | Horizontal offset on the left side of landing pad |
| **4. Max Thrust Accel**  | `3.50` (projected by $\cos \theta$) | m/s²    | Vertical throttle thrust accounting for tilt |

---

## Modes

Both modes share the exact same Moon Gravity force ($g = 1.62\text{ m/s}^2$):

1. **Easy Mode**:
   - **Gravity**: $1.62\text{ m/s}^2$ (Moon gravity)
   - **Fuel**: **Generous Fuel** ($1.0\%/\text{s}$ main thrust, $0.2\%/\text{s}$ pitch — 2.5× more flight endurance)
   - **Constraints**: **Relaxed** (Sink rate $< 3.0\text{ m/s}$, Tilt $< 25^\circ$)
2. **Hard Mode**:
   - **Gravity**: $1.62\text{ m/s}^2$ (Moon gravity)
   - **Fuel**: **Default Fuel** ($2.5\%/\text{s}$ main thrust, $0.5\%/\text{s}$ pitch)
   - **Constraints**: **Strict** (Sink rate $< 1.0\text{ m/s}$, Tilt $< 10^\circ$)

---

## Constraints

1. **Sink Rate**: Hard Mode ($< 1.0\text{ m/s}$), Easy Mode ($< 3.0\text{ m/s}$)
2. **Tilt Angle**: Hard Mode ($< 10^\circ$), Easy Mode ($< 25^\circ$)
3. **Pad Alignment**: Touchdown within landing pad flags ($|pos\_x| \le 50\text{m}$)
4. **Fuel Depletion**: Controls lock when fuel consumed reaches 100%

---

## Reinforcement Learning & Imitation Learning (Gymnasium)

The lander policy is trained with **DAgger (Dataset Aggregation)** on successful landing telemetry:
1. **Analytical Expert Guidance**: Uses a calibrated guidance controller (`PIDLanderAutopilot` in `policy.py`) to generate flawless demonstration trajectories.
2. **Continuous Physics Rollouts**: Interacts directly with `LunarLanderEnv` (headless Gymnasium environment at 60 Hz).
3. **DAgger Mitigation of Covariate Shift**: The neural policy explores flight corridors under expert supervision across perturbed starting conditions, learning robust recovery behaviors.
4. **Performance Benchmark**:
   - **Touchdown Success Rate**: 100% (5/5 evaluation flights in Hard mode)
   - **Average Sink Rate**: $0.56\text{ m/s}$ ($< 1.0\text{ m/s}$ constraint)
   - **Average Tilt Angle**: $3.0^\circ$ ($< 10.0^\circ$ constraint)
   - **Average Fuel Left**: $9.7\%$

### Train or Evaluate Policy
```bash
# Train DAgger policy and benchmark in Gymnasium
.venv/bin/python3 train_rl.py --episodes 5 --mode Hard
```

---

## Controls

- **Thrust**: `▲` / `W` / `Arrow Up`
- **Tilt Left**: `◀` / `A` / `Arrow Left`
- **Tilt Right**: `▶` / `D` / `Arrow Right`
- **AI Autopilot**: `P` (toggles trained RL neural policy)
- **Pause / Resume**: `Spacebar`
- **Restart**: `R`
- **Toggle Mode**: `M` (Easy / Hard)

---

## Quickstart

### 1. Install Dependencies
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cd frontend && npm install && npm run build && cd ..
```

### 2. Launch Mission Control Server
```bash
.venv/bin/python3 server.py
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser!

### 3. Run Automated Tests
```bash
.venv/bin/python3 test_suite.py
```
