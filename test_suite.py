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

    # 2. Gravity check (Both Hard and Easy have 1.62 m/s^2 Moon gravity)
    for _ in range(60):
        obs, _, _, _, _ = env.step(0)  # Coast 1 second under g=1.62
    assert math_close(obs[2], -1.62, tolerance=0.08)

    env_easy = LunarLanderEnv(mode=GameMode.EASY, telemetry_file=test_csv)
    env_easy.reset()
    for _ in range(60):
        obs_easy, _, _, _, _ = env_easy.step(0)  # Coast under g=1.62
    assert math_close(obs_easy[2], -1.62, tolerance=0.08)

    # 3. Thrust & Generous vs Default Fuel burn
    # Easy mode: Generous fuel (1.0% / s)
    env_easy.reset()
    for _ in range(60):
        obs_thrust_easy, _, _, _, _ = env_easy.step(1)
    # Net vertical velocity = (Thrust 3.50 - Gravity 1.62) * 1s = 1.88 m/s
    assert math_close(obs_thrust_easy[2], Config.MAIN_THRUST_ACCEL - Config.MOON_GRAVITY, tolerance=0.1)
    assert math_close(obs_thrust_easy[5], Config.EASY_MAIN_THRUST_FUEL_RATE, tolerance=0.1)

    # Hard mode: Default fuel (2.5% / s)
    env_hard = LunarLanderEnv(mode=GameMode.HARD, telemetry_file=test_csv)
    env_hard.reset()
    for _ in range(60):
        obs_thrust_hard, _, _, _, _ = env_hard.step(1)
    assert math_close(obs_thrust_hard[5], Config.HARD_MAIN_THRUST_FUEL_RATE, tolerance=0.1)

    # 4. Landing constraints (Soft touchdown)
    env.reset(options={"altitude": 0.0, "range": 5.0})
    env.vertical_velocity = -0.5
    env.tilt_angle = 2.0
    _, _, term, _, info = env.step(0)
    assert term is True
    assert info["landing_success"] is True

    # 5. Crash constraint in Hard mode (Sink rate > 1.0 m/s)
    env.reset(options={"altitude": 0.0, "range": 5.0})
    env.vertical_velocity = -1.8
    env.tilt_angle = 0.0
    _, _, term, _, info = env.step(0)
    assert term is True
    assert info["landing_success"] is False
    assert "Hard Impact" in info["status_message"]

    # 6. Relaxed constraint in Easy mode (Sink rate = 1.8 m/s is permitted since limit is < 3.0 m/s)
    env_easy.reset(options={"altitude": 0.0, "range": 5.0})
    env_easy.vertical_velocity = -1.8
    env_easy.tilt_angle = 0.0
    _, _, term, _, info = env_easy.step(0)
    assert term is True
    assert info["landing_success"] is True

    # Cleanup
    if os.path.exists(test_csv):
        os.remove(test_csv)
    print("✓ Environment physics & constraints passed")


def test_telemetry_logging():
    test_csv = "test_telemetry.csv"
    if os.path.exists(test_csv):
        os.remove(test_csv)

    env = LunarLanderEnv(mode=GameMode.HARD, telemetry_file=test_csv)
    env.reset(options={"altitude": 10.0, "range": 5.0})

    # Step for 120 frames (2 seconds of simulation)
    for _ in range(120):
        env.step(0)

    # Force touchdown on pad within constraints
    env.altitude = 0.0
    env.pos_x = 0.0
    env.range_to_pad = 0.0
    env.vertical_velocity = -0.4
    env.tilt_angle = 1.0
    env.step(0)

    # Verify CSV contents
    assert os.path.exists(test_csv), "telemetry.csv was not created!"
    with open(test_csv, mode="r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))
        assert len(reader) >= 2, f"Expected at least 2 rows at 1 Hz, got {len(reader)}"
        first_row = reader[0]
        assert "Time stamp" in first_row
        assert "Fuel Consumed" in first_row
        assert "Vertical Velocity" in first_row
        assert "Horizontal Vel" in first_row
        assert "Altitude" in first_row
        assert "Tilt Angle" in first_row
        assert "Range to Pad" in first_row
        assert "Mode" in first_row
        assert "Result" in first_row
        assert first_row["Result"] == "True"

    if os.path.exists(test_csv):
        os.remove(test_csv)
    print("✓ 1 Hz Telemetry CSV logging passed")


def test_server_and_websocket():
    client = TestClient(app)

    # REST endpoints
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    res = client.get("/api/telemetry/stats")
    assert res.status_code == 200
    assert "total_logged_seconds" in res.json()

    # WebSocket connection
    with client.websocket_connect("/ws") as ws:
        # Receive first state frame
        data = ws.receive_json()
        assert "altitude" in data
        assert "pos_x" in data
        assert "fuel_consumed" in data
        assert "vertical_velocity" in data
        assert "horizontal_velocity" in data
        assert "tilt_angle" in data
        assert data["mode"] == "Easy"
        assert math_close(data["gravity"], 1.62, tolerance=0.01)

        # Send action
        ws.send_json({"type": "action", "action": 1})
        next_data = ws.receive_json()
        assert "is_terminal" in next_data

    print("✓ FastAPI server & WebSocket passed")


if __name__ == "__main__":
    print("Running consolidated test suite...")
    test_env_physics_and_constraints()
    test_telemetry_logging()
    test_server_and_websocket()
    print("ALL TESTS PASSED SUCCESSFULLY!")
