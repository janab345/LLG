"""Gymnasium environment for 2D Apollo Lunar Lander Game (LLG).

Operates as a pure, headless Gymnasium environment with continuous physics.
Adheres strictly to the LLG specification in LLG.md:
- 1 Hz Telemetry logging to CSV
- Dynamic parameters: Time, Fuel Consumed, Vertical Vel, Horizontal Vel, Alt, Tilt, Range
- Static parameters: Mode (Easy/Hard), Result (True/False)
- Moon gravity (1.62 m/s²) acts in both Easy and Hard modes
- Easy mode: Generous fuel (2.5x more flight endurance) and relaxed constraints (< 3.0 m/s sink rate, < 25° tilt)
- Hard mode: Default fuel and strict constraints (< 1.0 m/s sink rate, < 10° tilt)
"""

import math
from typing import Optional, Tuple, Dict, Any
import numpy as np
import gymnasium as gym
from gymnasium import spaces

from config import Config, GameMode
from telemetry import TelemetryLogger


class LunarLanderEnv(gym.Env):
    """Headless 2D Lunar Lander Gymnasium Environment."""

    metadata = {"render_modes": ["human", "rgb_array"], "render_fps": Config.FPS}

    def __init__(
        self,
        mode: GameMode = GameMode.EASY,
        telemetry_file: str = Config.TELEMETRY_CSV_FILE,
        render_mode: Optional[str] = None,
    ):
        super().__init__()
        self.mode = mode
        self.render_mode = render_mode

        # Discrete Action Space:
        # 0: Coast (no thrust)
        # 1: Main Engine Thrust
        # 2: Pitch Left (counter-clockwise tilt)
        # 3: Pitch Right (clockwise tilt)
        self.action_space = spaces.Discrete(4)

        # Observation Space:
        # [Altitude (m), pos_x (m), Vertical Vel (m/s), Horizontal Vel (m/s), Tilt Angle (deg), Fuel Consumed (%)]
        # pos_x is signed (-left, +right relative to pad center 0.0) so RL policies know where to steer.
        low = np.array([0.0, -1000.0, -100.0, -100.0, -180.0, 0.0], dtype=np.float32)
        high = np.array([2000.0, 1000.0, 100.0, 100.0, 180.0, 100.0], dtype=np.float32)
        self.observation_space = spaces.Box(low=low, high=high, dtype=np.float32)

        # Initialize telemetry CSV logger
        self.telemetry_logger = TelemetryLogger(csv_filepath=telemetry_file)

        # State variables
        self.altitude: float = Config.START_ALTITUDE
        self.pos_x: float = Config.START_POS_X
        self.range_to_pad: float = abs(Config.START_POS_X)
        self.vertical_velocity: float = Config.START_VERTICAL_VELOCITY
        self.horizontal_velocity: float = Config.START_HORIZONTAL_VELOCITY
        self.tilt_angle: float = Config.START_TILT_ANGLE
        self.fuel_consumed: float = float(Config.START_FUEL_CONSUMED)
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
                self.pos_x,
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
            "gravity": float(Config.MOON_GRAVITY),
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

        # Fuel burn rate based on mode (generous fuel in Easy mode, default in Hard mode)
        if self.mode == GameMode.EASY:
            main_fuel_rate = Config.EASY_MAIN_THRUST_FUEL_RATE
            pitch_fuel_rate = Config.EASY_PITCH_FUEL_RATE
        else:
            main_fuel_rate = Config.HARD_MAIN_THRUST_FUEL_RATE
            pitch_fuel_rate = Config.HARD_PITCH_FUEL_RATE

        # 1. Apply Actions & Propellant Consumption
        thrust_ax = 0.0
        thrust_ay = 0.0

        # Action 1: Main Thruster
        if action == 1 and has_fuel:
            self.fuel_consumed = min(100.0, self.fuel_consumed + main_fuel_rate * dt)
            rad = math.radians(self.tilt_angle)
            thrust_ax = -Config.MAIN_THRUST_ACCEL * math.sin(rad)
            thrust_ay = Config.MAIN_THRUST_ACCEL * math.cos(rad)

        # Action 2: Pitch Left (Counter-Clockwise)
        elif action == 2 and has_fuel:
            self.fuel_consumed = min(100.0, self.fuel_consumed + pitch_fuel_rate * dt)
            self.tilt_angle -= Config.PITCH_SPEED * dt

        # Action 3: Pitch Right (Clockwise)
        elif action == 3 and has_fuel:
            self.fuel_consumed = min(100.0, self.fuel_consumed + pitch_fuel_rate * dt)
            self.tilt_angle += Config.PITCH_SPEED * dt

        # Wrap tilt angle within [-180, 180]
        if self.tilt_angle > 180.0:
            self.tilt_angle -= 360.0
        elif self.tilt_angle < -180.0:
            self.tilt_angle += 360.0

        # 2. Gravity (1.62 m/s^2 Moon gravity acts in BOTH Easy and Hard modes)
        gravity = Config.MOON_GRAVITY

        # 3. Acceleration & Velocity update
        accel_x = thrust_ax
        accel_y = thrust_ay - gravity

        self.horizontal_velocity += accel_x * dt
        self.vertical_velocity += accel_y * dt

        # 4. Position & Range update
        self.pos_x += self.horizontal_velocity * dt
        self.range_to_pad = abs(self.pos_x)
        self.altitude += self.vertical_velocity * dt

        # 5. Constraints and Landing Check
        terminated = False
        reward = (
            - 0.02 * (self.range_to_pad / 100.0)
            - 0.05 * ((self.tilt_angle / 15.0) ** 2)
            - 0.02 * max(0.0, -self.vertical_velocity - 2.0)
            - 0.01 * (1.0 if action == 1 else 0.0)
        )

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
                reward += 150.0 + (100.0 - self.fuel_consumed)
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
                reward += -100.0

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
        )

        # On touchdown or terminal, finalize telemetry episode
        if self.is_terminal:
            self.telemetry_logger.finish_episode(result=self.landing_success)

        truncated = False
        obs = self._get_obs()
        info = self._get_info()

        return obs, reward, terminated, truncated, info

    def close(self):
        """Cleanup resources on close."""
        if hasattr(self, "telemetry_logger") and getattr(self.telemetry_logger, "episode_active", False):
            if self.telemetry_logger.episode_buffer:
                self.telemetry_logger.finish_episode(result=self.landing_success)
