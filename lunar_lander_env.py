"""Gymnasium Environment for Lunar Lander Game (LLG).

Compatible with standard Gymnasium RL APIs.
Simulates lunar lander physics, constraints checking, and 1 Hz telemetry logging.
Runs headless on server side, serving physics frames to frontend.
"""

import math
from typing import Optional, Tuple, Dict, Any
import numpy as np
import gymnasium as gym
from gymnasium import spaces

from config import Config, GameMode
from telemetry import TelemetryLogger


class LunarLanderEnv(gym.Env):
    """Custom Gymnasium environment for Lunar Lander Game."""

    metadata = {"render_modes": [None], "render_fps": Config.FPS}

    def __init__(
        self,
        mode: GameMode = GameMode.HARD,
        render_mode: Optional[str] = None,
        telemetry_file: str = Config.TELEMETRY_CSV_FILE,
    ):
        super().__init__()

        self.mode = mode
        self.render_mode = render_mode
        self.telemetry_logger = TelemetryLogger(csv_filepath=telemetry_file)

        # Action Space:
        # 0: Coast / Idle (no thrust)
        # 1: Main Thrust
        # 2: Tilt Left (counter-clockwise)
        # 3: Tilt Right (clockwise)
        self.action_space = spaces.Discrete(4)

        # Observation Space:
        # [Altitude (m), Range to Pad (m), Vertical Velocity (m/s), Horizontal Velocity (m/s), Tilt Angle (deg), Fuel Consumed (%)]
        low = np.array([0.0, 0.0, -100.0, -100.0, -180.0, 0.0], dtype=np.float32)
        high = np.array([2000.0, 2000.0, 100.0, 100.0, 180.0, 100.0], dtype=np.float32)
        self.observation_space = spaces.Box(low=low, high=high, dtype=np.float32)

        # State Variables
        self.altitude: float = Config.START_ALTITUDE
        self.pos_x: float = Config.START_POS_X  # -300m (300m to the left of pad)
        self.range_to_pad: float = abs(self.pos_x)  # Distance in meters (positive: 300m)
        self.vertical_velocity: float = Config.START_VERTICAL_VELOCITY
        self.horizontal_velocity: float = Config.START_HORIZONTAL_VELOCITY
        self.tilt_angle: float = Config.START_TILT_ANGLE  # Degrees
        self.fuel_consumed: float = float(Config.START_FUEL_CONSUMED)  # Percentage (0-100)
        self.elapsed_time: float = 0.0
        self.steps: int = 0

        # Status and termination
        self.is_terminal: bool = False
        self.landing_success: bool = False
        self.status_message: str = "In Flight"
        self.last_action: int = 0

    def set_mode(self, mode: GameMode) -> None:
        """Switch game mode between Easy and Hard."""
        self.mode = mode

    def reset(
        self,
        *,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Reset the environment state for a new landing attempt."""
        super().reset(seed=seed)

        if options and "altitude" in options:
            self.altitude = float(options["altitude"])
        else:
            self.altitude = Config.START_ALTITUDE

        if options and "pos_x" in options:
            self.pos_x = float(options["pos_x"])
        elif options and "range" in options:
            # If range specified, default to offset on the left
            self.pos_x = -abs(float(options["range"]))
        else:
            self.pos_x = Config.START_POS_X

        self.range_to_pad = abs(self.pos_x)
        self.vertical_velocity = Config.START_VERTICAL_VELOCITY
        self.horizontal_velocity = Config.START_HORIZONTAL_VELOCITY
        self.tilt_angle = Config.START_TILT_ANGLE
        self.fuel_consumed = float(Config.START_FUEL_CONSUMED)
        self.elapsed_time = 0.0
        self.steps = 0
        self.is_terminal = False
        self.landing_success = False
        self.status_message = "In Flight"
        self.last_action = 0

        # Initialize telemetry logger for this episode
        self.telemetry_logger.start_episode(self.mode)
        # Log initial tick at t = 0s (Range is positive distance to pad)
        self.telemetry_logger.log_tick(
            elapsed_time=self.elapsed_time,
            fuel_consumed=self.fuel_consumed,
            vertical_velocity=self.vertical_velocity,
            horizontal_velocity=self.horizontal_velocity,
            altitude=self.altitude,
            tilt_angle=self.tilt_angle,
            range_to_pad=self.range_to_pad,
            force=True,
        )

        obs = self._get_obs()
        info = self._get_info()
        return obs, info

    def _get_obs(self) -> np.ndarray:
        return np.array(
            [
                self.altitude,
                self.range_to_pad,
                self.vertical_velocity,
                self.horizontal_velocity,
                self.tilt_angle,
                self.fuel_consumed,
            ],
            dtype=np.float32,
        )

    def _get_info(self) -> Dict[str, Any]:
        return {
            "elapsed_time": self.elapsed_time,
            "fuel_consumed": self.fuel_consumed,
            "mode": self.mode.value,
            "landing_success": self.landing_success,
            "status_message": self.status_message,
            "sink_rate": -self.vertical_velocity if self.vertical_velocity < 0 else 0.0,
            "range_to_pad": self.range_to_pad,
        }

    def get_full_state(self) -> Dict[str, Any]:
        max_sink = Config.HARD_MAX_SINK_RATE if self.mode == GameMode.HARD else Config.EASY_MAX_SINK_RATE
        max_tilt = Config.HARD_MAX_TILT_ANGLE if self.mode == GameMode.HARD else Config.EASY_MAX_TILT_ANGLE
        return {
            "altitude": float(self.altitude),
            "pos_x": float(self.pos_x),
            "range_to_pad": float(self.range_to_pad),
            "vertical_velocity": float(self.vertical_velocity),
            "horizontal_velocity": float(self.horizontal_velocity),
            "tilt_angle": float(self.tilt_angle),
            "fuel_consumed": float(self.fuel_consumed),
            "elapsed_time": float(self.elapsed_time),
            "is_terminal": bool(self.is_terminal),
            "landing_success": bool(self.landing_success),
            "status_message": self.status_message,
            "mode": self.mode.value,
            "last_action": int(self.last_action),
            "sink_rate": float(-self.vertical_velocity if self.vertical_velocity < 0 else 0.0),
            "max_sink_rate": float(max_sink),
            "max_tilt_angle": float(max_tilt),
            "pad_width": float(Config.PAD_WIDTH),
        }

    def step(self, action: int) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        """Advance the physics simulation by 1 step (Config.DT)."""
        if self.is_terminal:
            return self._get_obs(), 0.0, True, False, self._get_info()

        dt = Config.DT
        self.steps += 1
        self.elapsed_time += dt
        self.last_action = action

        has_fuel = self.fuel_consumed < 100.0

        thrust_vx = 0.0
        thrust_vy = 0.0

        # 1. Action dynamics
        if action == 1 and has_fuel:
            # Main Thrust
            self.fuel_consumed = min(100.0, self.fuel_consumed + Config.MAIN_THRUST_FUEL_RATE * dt)
            angle_rad = math.radians(self.tilt_angle)
            thrust_accel = Config.MAIN_THRUST_ACCEL
            thrust_vx = thrust_accel * math.sin(angle_rad)
            thrust_vy = thrust_accel * math.cos(angle_rad)

        elif action == 2 and has_fuel:
            # Pitch Left (tilt counter-clockwise, negative angle)
            self.fuel_consumed = min(100.0, self.fuel_consumed + Config.PITCH_FUEL_RATE * dt)
            self.tilt_angle -= Config.PITCH_SPEED * dt

        elif action == 3 and has_fuel:
            # Pitch Right (tilt clockwise, positive angle)
            self.fuel_consumed = min(100.0, self.fuel_consumed + Config.PITCH_FUEL_RATE * dt)
            self.tilt_angle += Config.PITCH_SPEED * dt

        # Wrap tilt angle within [-180, 180]
        if self.tilt_angle > 180.0:
            self.tilt_angle -= 360.0
        elif self.tilt_angle < -180.0:
            self.tilt_angle += 360.0

        # 2. Gravity
        gravity = Config.GRAVITY_HARD if self.mode == GameMode.HARD else Config.GRAVITY_EASY

        # 3. Acceleration & Velocity update
        accel_x = thrust_vx
        accel_y = thrust_vy - gravity

        self.horizontal_velocity += accel_x * dt
        self.vertical_velocity += accel_y * dt

        # 4. Position & Range update
        self.pos_x += self.horizontal_velocity * dt
        self.range_to_pad = abs(self.pos_x)  # Calibrated non-negative range to pad
        self.altitude += self.vertical_velocity * dt

        # 5. Constraints and Landing Check
        terminated = False
        reward = 0.0

        if self.mode == GameMode.HARD:
            max_sink = Config.HARD_MAX_SINK_RATE
            max_tilt = Config.HARD_MAX_TILT_ANGLE
        else:
            max_sink = Config.EASY_MAX_SINK_RATE
            max_tilt = Config.EASY_MAX_TILT_ANGLE

        sink_rate = -self.vertical_velocity

        # Surface Contact Check (Altitude <= 0)
        if self.altitude <= 0.0:
            self.altitude = 0.0
            self.is_terminal = True
            terminated = True

            on_pad = self.range_to_pad <= (Config.PAD_WIDTH / 2.0)
            acceptable_sink = sink_rate <= max_sink
            acceptable_tilt = abs(self.tilt_angle) <= max_tilt

            if on_pad and acceptable_sink and acceptable_tilt:
                self.landing_success = True
                self.status_message = "SUCCESSFUL LANDING!"
                reward = 100.0 + (100.0 - self.fuel_consumed)
            else:
                self.landing_success = False
                failure_reasons = []
                if not acceptable_sink:
                    failure_reasons.append(f"Hard Impact (Sink Rate: {sink_rate:.1f} m/s > {max_sink} m/s)")
                if not acceptable_tilt:
                    failure_reasons.append(f"Excessive Tilt ({abs(self.tilt_angle):.1f}° > {max_tilt}°)")
                if not on_pad:
                    failure_reasons.append(f"Missed Pad (Range: {self.range_to_pad:.1f} m)")
                self.status_message = "CRASH: " + ", ".join(failure_reasons)
                reward = -100.0

        # Out-of-bounds check
        elif self.altitude > 1500.0 or self.range_to_pad > 700.0:
            self.is_terminal = True
            terminated = True
            self.landing_success = False
            self.status_message = "LOST IN SPACE: Out of operating bounds"
            reward = -100.0

        # 6. Telemetry logging at 1 Hz
        self.telemetry_logger.log_tick(
            elapsed_time=self.elapsed_time,
            fuel_consumed=self.fuel_consumed,
            vertical_velocity=self.vertical_velocity,
            horizontal_velocity=self.horizontal_velocity,
            altitude=self.altitude,
            tilt_angle=self.tilt_angle,
            range_to_pad=self.range_to_pad,
            force=terminated,
        )

        if terminated:
            self.telemetry_logger.finish_episode(self.landing_success)

        obs = self._get_obs()
        info = self._get_info()

        return obs, reward, terminated, False, info

    def close(self) -> None:
        """Close environment."""
        pass
