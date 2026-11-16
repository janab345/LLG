"""Comprehensive test suite for Lunar Lander Game (LLG).

Tests Gymnasium physics, constraints, 1 Hz CSV telemetry, and FastAPI WebSocket server.
"""

import os
import csv
import json
import numpy as np
from fastapi.testclient import TestClient

from config import Config, GameMode
from lunar_lander_env import LunarLanderEnv
from server import app


def math_close(a: float, b: float, tolerance: float = 0.05) -> bool:
    return abs(a - b) <= tolerance


def test_env_physics_and_constraints():
    test_csv = "test_telemetry.csv"
    if os.path.exists(test_csv):
        os.remove(test_csv)

    # 1. Reset check
    env = LunarLanderEnv(mode=GameMode.HARD, telemetry_file=test_csv)
    obs, info = env.reset()
    assert obs.shape == (6,)
    assert obs[0] == Config.START_ALTITUDE
    assert info["mode"] == "Hard"

    # 2. Gravity check (Hard vs Easy)
    for _ in range(60):
        obs, _, _, _, _ = env.step(0)  # Coast 1 second under g=1.62
    assert math_close(obs[2], -1.62, tolerance=0.08)

    env_easy = LunarLanderEnv(mode=GameMode.EASY, telemetry_file=test_csv)
    env_easy.reset()
    for _ in range(60):
        obs_easy, _, _, _, _ = env_easy.step(0)  # Coast in zero-g
    assert math_close(obs_easy[2], 0.0, tolerance=0.01)

    # 3. Thrust & Fuel burn
    env_easy.reset()
    for _ in range(60):
        obs_thrust, _, _, _, _ = env_easy.step(1)
    assert math_close(obs_thrust[2], Config.MAIN_THRUST_ACCEL, tolerance=0.1)
    assert math_close(obs_thrust[5], Config.MAIN_THRUST_FUEL_RATE, tolerance=0.1)

    # 4. Landing constraints (Soft touchdown)
    env.reset(options={"altitude": 0.0, "range": 5.0})
    env.vertical_velocity = -0.5
    env.tilt_angle = 2.0
    _, _, term, _, info = env.step(0)
    assert term is True
    assert info["landing_success"] is True

    # 5. Crash constraint (Excessive sink rate)
    env.reset(options={"altitude": 0.0, "range": 5.0})
    env.vertical_velocity = -2.5
    env.tilt_angle = 2.0
    _, _, term, _, info = env.step(0)
    assert term is True
    assert info["landing_success"] is False

    if os.path.exists(test_csv):
        os.remove(test_csv)


def test_telemetry_1hz_csv():
    test_csv = "test_telemetry_1hz.csv"
    if os.path.exists(test_csv):
        os.remove(test_csv)

    env = LunarLanderEnv(mode=GameMode.HARD, telemetry_file=test_csv)
    env.reset(options={"altitude": 30.0, "range": 0.0})

    for _ in range(120):  # 2 seconds
        env.step(0)

    env.altitude = 0.0
    env.step(0)  # Force touchdown

    assert os.path.exists(test_csv)
    with open(test_csv, mode="r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))

    assert len(reader) >= 3
    final_res = reader[0]["Result"]
    for row in reader:
        assert row["Mode"] == "Hard"
        assert row["Result"] == final_res

    if os.path.exists(test_csv):
        os.remove(test_csv)


def test_server_and_websocket():
    client = TestClient(app)

    # Health check
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    # CSV download
    res = client.get("/api/telemetry.csv")
    assert res.status_code == 200

    # WebSocket
    with client.websocket_connect("/ws") as ws:
        frame = json.loads(ws.receive_text())
        assert "altitude" in frame
        assert "fuel_consumed" in frame

        # Send thrust
        ws.send_text(json.dumps({"type": "action", "action": 1}))
        frame2 = json.loads(ws.receive_text())
        assert frame2["last_action"] == 1


if __name__ == "__main__":
    print("Running consolidated test suite...")
    test_env_physics_and_constraints()
    print("✓ Environment physics & constraints passed")
    test_telemetry_1hz_csv()
    print("✓ 1 Hz Telemetry CSV logging passed")
    test_server_and_websocket()
    print("✓ FastAPI server & WebSocket passed")
    print("ALL TESTS PASSED SUCCESSFULLY!")
