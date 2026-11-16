"""Neural network policy and expert guidance controller for Lunar Lander Game (LLG).

Provides:
1. LanderPolicy: Deep PyTorch MLP for Reinforcement Learning (DQN/PPO) & Imitation Learning.
2. PIDLanderAutopilot: Analytical guidance controller that generates optimal trajectories
   for database seeding and behavioral cloning.
"""

import math
from typing import Union, Tuple, List
import numpy as np
import torch
import torch.nn as nn

from config import Config, GameMode


class LanderPolicy(nn.Module):
    """PyTorch Deep Q-Network / Behavioral Cloning Policy for Lunar Lander."""

    def __init__(self, state_dim: int = 6, action_dim: int = 4, hidden_dim: int = 128):
        super().__init__()
        self.state_dim = state_dim
        self.action_dim = action_dim

        # State normalization constants: [Alt, Range, Vy, Vx, Tilt, Fuel]
        self.register_buffer(
            "state_scale",
            torch.tensor([500.0, 300.0, 15.0, 15.0, 30.0, 100.0], dtype=torch.float32),
        )

        self.network = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 64),
            nn.ReLU(),
            nn.Linear(64, action_dim),
        )

    def forward(self, state: torch.Tensor) -> torch.Tensor:
        """Forward pass taking raw observation tensor and outputting action logits / Q-values."""
        normalized_state = state / self.state_scale
        return self.network(normalized_state)

    def get_action(self, obs: Union[np.ndarray, List[float]], deterministic: bool = True) -> int:
        """Evaluate single observation and return discrete action (0, 1, 2, 3)."""
        self.eval()
        with torch.no_grad():
            if isinstance(obs, list):
                obs = np.array(obs, dtype=np.float32)
            tensor_obs = torch.from_numpy(obs).float().unsqueeze(0)
            logits = self.forward(tensor_obs)
            if deterministic:
                action = int(torch.argmax(logits, dim=1).item())
            else:
                probs = torch.softmax(logits, dim=1)
                dist = torch.distributions.Categorical(probs)
                action = int(dist.sample().item())
            return action

    def save(self, filepath: str) -> None:
        """Save model weights to file."""
        torch.save(self.state_dict(), filepath)

    def load(self, filepath: str) -> None:
        """Load model weights from file."""
        self.load_state_dict(torch.load(filepath, map_location=torch.device("cpu")))
        self.eval()


class PIDLanderAutopilot:
    """Optimal analytical guidance controller for Apollo Lunar Lander.

    Solves horizontal descent corridor and terminal vertical flare to achieve
    guaranteed successful touchdowns for demonstration logging.
    """

    def __init__(self, mode: GameMode = GameMode.HARD):
        self.mode = mode

    def get_action(
        self,
        altitude: float,
        pos_x: float,
        vertical_vel: float,
        horizontal_vel: float,
        tilt_angle: float,
        fuel_consumed: float,
    ) -> int:
        """Calculate optimal action to fly smoothly toward pad and land gently."""
        if fuel_consumed >= 100.0:
            return 0  # No fuel

        # 1. Proportional-Derivative Horizontal Guidance toward pad center (pos_x = 0)
        desired_vx = -np.clip(pos_x * 0.08, -12.0, 12.0)
        vx_err = desired_vx - horizontal_vel
        target_tilt = np.clip(vx_err * 4.5, -28.0, 28.0)

        # Force lander upright when approaching the surface
        if altitude < 35.0:
            target_tilt = 0.0

        tilt_err = target_tilt - tilt_angle

        # 2. Dynamic Sink Rate Profile
        if altitude > 150.0:
            target_vy = -18.0
        elif altitude > 50.0:
            target_vy = -8.0
        elif altitude > 12.0:
            target_vy = -2.2
        else:
            target_vy = -0.55

        # 3. Decision arbitration
        if abs(tilt_err) > 3.0:
            return 3 if tilt_err > 0 else 2
        else:
            need_h_accel = abs(desired_vx - horizontal_vel) > 2.0 and abs(tilt_angle) > 10.0 and abs(pos_x) > 30.0
            if need_h_accel and altitude > 80.0 and vertical_vel < -8.0:
                return 1  # Thrust while tilted to acquire horizontal velocity
            elif vertical_vel < target_vy:
                return 1  # Main thrust to brake descent
            else:
                return 0  # Coast
