"""FastAPI WebSocket server for Lunar Lander Game (LLG).

Hosts the Gymnasium physics engine server-side, runs real-time 60 FPS physics loops,
streams state updates to the React client via WebSockets, and handles 1 Hz CSV telemetry logging.
"""

import asyncio
import json
import os
from typing import Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from config import Config, GameMode
from lunar_lander_env import LunarLanderEnv
from telemetry import TelemetryLogger
from policy import PIDLanderAutopilot, LanderPolicy

app = FastAPI(title="Lunar Lander Gymnasium API")

# Enable CORS for local Vite development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load trained PyTorch RL neural policy if weights exist
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "lander_policy.pt")
neural_policy = None
if os.path.exists(MODEL_PATH):
    try:
        neural_policy = LanderPolicy(state_dim=6, action_dim=4, hidden_dim=128)
        neural_policy.load(MODEL_PATH)
        neural_policy.eval()
        print(f"✓ Trained Gymnasium RL Policy loaded from '{MODEL_PATH}'")
    except Exception as e:
        print(f"Notice: Could not load neural policy ({e}), using PID autopilot fallback.")


@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "physics_engine": "Gymnasium",
        "rl_policy_loaded": neural_policy is not None,
    }


@app.get("/api/telemetry.csv")
async def download_telemetry_csv():
    """Download the telemetry.csv file generated from flights."""
    csv_path = Config.TELEMETRY_CSV_FILE
    if not os.path.exists(csv_path):
        logger = TelemetryLogger(csv_filepath=csv_path)
    return FileResponse(
        path=csv_path,
        media_type="text/csv",
        filename="telemetry.csv",
    )


@app.get("/api/telemetry/stats")
async def get_telemetry_stats():
    """Retrieve counts of total and successful flights logged in CSV."""
    logger = TelemetryLogger(csv_filepath=Config.TELEMETRY_CSV_FILE)
    successful = logger.get_successful_records()
    total_rows = 0
    if os.path.exists(Config.TELEMETRY_CSV_FILE):
        with open(Config.TELEMETRY_CSV_FILE, "r", encoding="utf-8") as f:
            total_rows = max(0, sum(1 for _ in f) - 1)
    return {
        "total_logged_seconds": total_rows,
        "successful_records": len(successful),
    }


@app.websocket("/ws")
async def websocket_game_endpoint(websocket: WebSocket):
    """Real-time bidirectional WebSocket loop for Gymnasium physics simulation."""
    await websocket.accept()

    # Per LLG.md, default mode is Easy (Gravity wouldn't act, relaxed constraints)
    current_mode = GameMode.EASY
    env = LunarLanderEnv(mode=current_mode, render_mode=None)
    env.reset()

    current_action = 0  # 0: Coast
    is_paused = False
    is_running = True
    is_autopilot = False
    autopilot = PIDLanderAutopilot(mode=current_mode)

    # Incoming message listener task
    async def receive_actions():
        nonlocal current_action, current_mode, is_paused, is_running, is_autopilot
        try:
            while is_running:
                data = await websocket.receive_text()
                msg = json.loads(data)
                msg_type = msg.get("type", "action")

                if msg_type == "action":
                    act = int(msg.get("action", 0))
                    current_action = act
                    if act != 0:
                        is_autopilot = False
                elif msg_type == "toggle_autopilot":
                    is_autopilot = not is_autopilot
                elif msg_type == "reset":
                    env.reset()
                    current_action = 0
                elif msg_type == "set_mode":
                    mode_str = msg.get("mode", "Easy")
                    current_mode = GameMode.HARD if mode_str == "Hard" else GameMode.EASY
                    env.set_mode(current_mode)
                    autopilot.mode = current_mode
                    env.reset()
                    current_action = 0
                elif msg_type == "toggle_pause":
                    is_paused = not is_paused
        except (WebSocketDisconnect, asyncio.CancelledError):
            pass
        except Exception as e:
            print(f"Error in receive_actions: {e}")

    receiver_task = asyncio.create_task(receive_actions())

    dt = Config.DT  # 1/60s (approx 16.6ms)

    try:
        while True:
            step_start = asyncio.get_event_loop().time()

            if not is_paused and not env.is_terminal:
                if is_autopilot:
                    if neural_policy is not None:
                        obs = env._get_obs()
                        current_action = neural_policy.get_action(obs, deterministic=True)
                    else:
                        current_action = autopilot.get_action(
                            altitude=env.altitude,
                            pos_x=env.pos_x,
                            vertical_vel=env.vertical_velocity,
                            horizontal_vel=env.horizontal_velocity,
                            tilt_angle=env.tilt_angle,
                            fuel_consumed=env.fuel_consumed,
                        )
                # Step the server-side Gymnasium physics
                env.step(current_action)

            # Extract full state
            state = env.get_full_state()
            state["is_paused"] = is_paused
            state["is_autopilot"] = is_autopilot

            # Push state frame to React client
            await websocket.send_text(json.dumps(state))

            # Maintain 60 FPS cadence
            step_duration = asyncio.get_event_loop().time() - step_start
            sleep_time = max(0.001, dt - step_duration)
            await asyncio.sleep(sleep_time)

    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    except Exception as e:
        print(f"WebSocket session terminated: {e}")
    finally:
        is_running = False
        receiver_task.cancel()
        env.close()


# Mount frontend dist directory if it exists
frontend_dist = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
