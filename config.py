"""Configuration and physical constants for Lunar Lander Game (LLG)."""

from enum import Enum


class GameMode(Enum):
    EASY = "Easy"
    HARD = "Hard"


class Config:
    # Display settings
    SCREEN_WIDTH = 1000
    SCREEN_HEIGHT = 700
    FPS = 60
    DT = 1.0 / FPS  # Simulation step delta time (seconds)

    # World & Coordinate mapping
    # World units are in meters:
    # Altitude: 0m is ground/pad level, up is positive.
    # Range to pad: Distance in meters from lander to center of pad (always non-negative).
    PAD_WIDTH = 100.0  # meters (+/- 50m from pad center for comfortable landing target)
    WORLD_ALTITUDE_SPAN = 600.0  # Max altitude in meters displayed on screen
    WORLD_RANGE_SPAN = 700.0  # Range span in meters displayed on screen

    # Initial Flight Parameters
    START_ALTITUDE = 500.0  # meters
    START_RANGE = 300.0  # meters distance to pad center (as seen in mission reference)
    START_POS_X = -300.0  # lander starting X coordinate (firmly on the LEFT side of pad at x=0)
    START_VERTICAL_VELOCITY = 0.0  # m/s
    START_HORIZONTAL_VELOCITY = 0.0  # m/s
    START_TILT_ANGLE = 0.0  # degrees (0 = vertical)
    START_FUEL_CONSUMED = 0  # percentage (0% to 100%)

    # Physics Constants
    GRAVITY_HARD = 1.62  # Moon gravity: 1.62 m/s^2
    GRAVITY_EASY = 0.00  # Zero-g mode: 0 m/s^2

    MAIN_THRUST_ACCEL = 3.50  # m/s^2 acceleration along lander normal
    PITCH_SPEED = 30.0  # degrees per second tilt rate

    # Fuel Consumption (Mass flow per second)
    MAIN_THRUST_FUEL_RATE = 2.5  # % fuel consumed per second of thrust
    PITCH_FUEL_RATE = 0.5  # % fuel consumed per second of pitch

    # Constraints for Successful Landing
    # Hard Mode Constraints (strict from LLG.md)
    HARD_MAX_SINK_RATE = 1.0  # Sink rate < 1.0 m/s
    HARD_MAX_TILT_ANGLE = 10.0  # Tilt angle < 10 degrees

    # Easy Mode Constraints (relaxed)
    EASY_MAX_SINK_RATE = 3.0  # Sink rate < 3.0 m/s
    EASY_MAX_TILT_ANGLE = 25.0  # Tilt angle < 25 degrees

    # Logging settings
    LOGGING_INTERVAL = 1.0  # 1 Hz logging frequency (1 log per second)
    TELEMETRY_CSV_FILE = "telemetry.csv"
