"""Telemetry logging module for Lunar Lander Game (LLG).

Logs flight telemetry at 1 Hz (once per second).
Buffer records during flight and appends them to CSV upon episode completion,
ensuring static parameters (Mode, Result) are accurately recorded across all rows.
"""

import csv
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from config import Config, GameMode


class TelemetryLogger:
    CSV_COLUMNS = [
        "Time stamp",
        "Fuel Consumed",
        "Vertical Velocity",
        "Horizontal Vel",
        "Altitude",
        "Tilt Angle",
        "Range to Pad",
        "Mode",
        "Result",
    ]

    def __init__(self, csv_filepath: str = Config.TELEMETRY_CSV_FILE):
        self.csv_filepath = csv_filepath
        self.episode_buffer: List[Dict[str, Any]] = []
        self.last_log_time: float = -1.0
        self.episode_active: bool = False
        self.current_mode: GameMode = GameMode.HARD
        self._ensure_csv_header()

    def _ensure_csv_header(self) -> None:
        """Create CSV file with headers if it does not already exist."""
        if not os.path.exists(self.csv_filepath) or os.path.getsize(self.csv_filepath) == 0:
            with open(self.csv_filepath, mode="w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(self.CSV_COLUMNS)

    def start_episode(self, mode: GameMode) -> None:
        """Reset the logger buffer for a new flight episode."""
        self.episode_buffer = []
        self.current_mode = mode
        self.last_log_time = -1.0
        self.episode_active = True

    def log_tick(
        self,
        elapsed_time: float,
        fuel_consumed: float,
        vertical_velocity: float,
        horizontal_velocity: float,
        altitude: float,
        tilt_angle: float,
        range_to_pad: float,
        force: bool = False,
    ) -> bool:
        """Log telemetry at 1 Hz frequency (every 1.0 second of simulation time).

        Returns True if a tick was recorded, False otherwise.
        """
        if not self.episode_active:
            return False

        # Check if 1 second has elapsed since last log or if forced (e.g. final state)
        if force or self.last_log_time < 0 or (elapsed_time - self.last_log_time) >= Config.LOGGING_INTERVAL:
            # Format timestamp as HH:MM:SS or integer seconds string
            timestamp_str = f"{int(elapsed_time // 60):02d}:{int(elapsed_time % 60):02d}"

            record = {
                "Time stamp": timestamp_str,
                "Fuel Consumed": int(round(fuel_consumed)),
                "Vertical Velocity": int(round(vertical_velocity)),
                "Horizontal Vel": int(round(horizontal_velocity)),
                "Altitude": int(round(altitude)),
                "Tilt Angle": int(round(tilt_angle)),
                "Range to Pad": int(round(range_to_pad)),
                "Mode": self.current_mode.value,
                "Result": None,  # Populated at end of episode
            }
            self.episode_buffer.append(record)
            self.last_log_time = elapsed_time
            return True
        return False

    def finish_episode(self, result: bool) -> int:
        """Complete the episode, stamp Result on all rows, and write to CSV.

        Returns the number of rows written to CSV.
        """
        if not self.episode_active or not self.episode_buffer:
            self.episode_active = False
            return 0

        # Apply static Result parameter to all episode records
        for record in self.episode_buffer:
            record["Result"] = result

        # Append to CSV
        with open(self.csv_filepath, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=self.CSV_COLUMNS)
            for record in self.episode_buffer:
                writer.writerow(record)

        written_count = len(self.episode_buffer)
        self.episode_buffer = []
        self.episode_active = False
        return written_count

    def get_successful_records(self) -> List[Dict[str, Any]]:
        """Utility to retrieve all successful landing trajectories for RL imitation learning."""
        if not os.path.exists(self.csv_filepath):
            return []
        successful_records = []
        with open(self.csv_filepath, mode="r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("Result", "").strip().lower() in ("true", "1"):
                    successful_records.append(row)
        return successful_records
