"""Reinforcement Learning & Imitation Learning (DAgger) for Lunar Lander Game (LLG).

Uses Gymnasium LunarLanderEnv with continuous physics.
Implements:
1. Expert Demonstration Generation: Logs 1 Hz successful flights to telemetry.csv.
2. DAgger (Dataset Aggregation) Imitation Learning:
   - Rolls out trajectories with the neural network policy
   - Queries expert controller (PIDLanderAutopilot) for supervisory corrections
   - Retrains the PyTorch LanderPolicy across perturbed initial conditions to eliminate compounding drift.
3. Evaluation Benchmark:
   - Reports touchdown success rate, sink rate (< 1.0 m/s), horizontal offset (< 50 m), tilt angle (< 10°), and fuel left.
"""

import os
import csv
import argparse
from typing import List, Tuple, Dict, Any

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

from config import Config, GameMode
from lunar_lander_env import LunarLanderEnv
from policy import LanderPolicy, PIDLanderAutopilot


def generate_expert_demonstrations(
    num_episodes: int = 5,
    mode: GameMode = GameMode.HARD,
    csv_file: str = Config.TELEMETRY_CSV_FILE,
) -> int:
    """Generate flawless expert landings into telemetry.csv for Demonstration & RL seeding."""
    print(f"Generating {num_episodes} expert demonstration flights in {mode.value} mode...")
    env = LunarLanderEnv(mode=mode, telemetry_file=csv_file)
    autopilot = PIDLanderAutopilot(mode=mode)
    successful_count = 0

    for ep in range(num_episodes):
        obs, info = env.reset()
        done = False
        steps = 0
        while not done and steps < 6000:
            steps += 1
            action = autopilot.get_action(
                altitude=env.altitude,
                pos_x=env.pos_x,
                vertical_vel=env.vertical_velocity,
                horizontal_vel=env.horizontal_velocity,
                tilt_angle=env.tilt_angle,
                fuel_consumed=env.fuel_consumed,
            )
            obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated

        if info["landing_success"]:
            successful_count += 1
            print(f"  Demonstration {ep + 1}/{num_episodes}: SUCCESS! Sink: {info['sink_rate']:.2f} m/s | Fuel left: {100 - env.fuel_consumed:.1f}%")
        else:
            print(f"  Demonstration {ep + 1}/{num_episodes}: Status: {info['status_message']}")

    env.close()
    print(f"✓ Generated {successful_count}/{num_episodes} successful demonstrations logged to '{csv_file}'\n")
    return successful_count


def train_dagger_policy(
    csv_file: str = Config.TELEMETRY_CSV_FILE,
    dagger_iterations: int = 4,
    episodes_per_iter: int = 4,
    epochs_per_iter: int = 8,
    batch_size: int = 64,
    learning_rate: float = 1e-3,
    save_path: str = "models/lander_policy.pt",
) -> LanderPolicy:
    """Train neural policy using DAgger across state distribution perturbations."""
    print("=" * 60)
    print("TRAINING RL / DAGGER NEURAL POLICY WITH GYMNASIUM")
    print("=" * 60)

    # Ensure telemetry has expert data
    if not os.path.exists(csv_file):
        generate_expert_demonstrations(num_episodes=5, csv_file=csv_file)

    env = LunarLanderEnv(mode=GameMode.HARD, telemetry_file="models/dagger_scratch.csv")
    autopilot = PIDLanderAutopilot(mode=GameMode.HARD)
    policy = LanderPolicy(state_dim=6, action_dim=4, hidden_dim=128)
    optimizer = optim.Adam(policy.parameters(), lr=learning_rate)
    criterion = nn.CrossEntropyLoss()

    dataset: List[Tuple[np.ndarray, int]] = []

    print("Phase 1: Seeding initial dataset with expert demonstration flights...")
    for ep in range(8):
        init_alt = 500.0 + float(np.random.uniform(-15.0, 15.0))
        init_x = -300.0 + float(np.random.uniform(-15.0, 15.0))
        obs, info = env.reset(options={"altitude": init_alt, "pos_x": init_x})
        done = False
        steps = 0
        while not done and steps < 6000:
            steps += 1
            action = autopilot.get_action(
                env.altitude, env.pos_x, env.vertical_velocity,
                env.horizontal_velocity, env.tilt_angle, env.fuel_consumed
            )
            dataset.append((obs, action))
            obs, r, term, trunc, info = env.step(action)
            done = term or trunc

    print(f"Initial seed transitions: {len(dataset)}")

    print("\nPhase 2: DAgger iterations (visiting state distribution with expert supervision)...")
    for it in range(dagger_iterations):
        # 1. Fit policy on current aggregated dataset
        states = torch.FloatTensor(np.array([s for s, a in dataset]))
        actions = torch.LongTensor([a for s, a in dataset])
        indices = np.arange(len(dataset))

        for epoch in range(1, epochs_per_iter + 1):
            np.random.shuffle(indices)
            total_loss, correct, batches = 0.0, 0, 0
            for i in range(0, len(dataset), batch_size):
                b_idx = indices[i : i + batch_size]
                b_s = states[b_idx]
                b_a = actions[b_idx]

                optimizer.zero_grad()
                logits = policy(b_s)
                loss = criterion(logits, b_a)
                loss.backward()
                optimizer.step()

                total_loss += loss.item()
                preds = torch.argmax(logits, dim=1)
                correct += (preds == b_a).sum().item()
                batches += 1

        acc = (correct / len(dataset)) * 100.0
        print(f"  DAgger Iteration {it + 1}/{dagger_iterations}: Loss: {total_loss / max(1, batches):.4f} | Accuracy: {acc:.1f}% (Dataset size: {len(dataset)})")

        # 2. Rollout policy with decaying exploration beta
        beta = 0.5 ** (it + 1)
        for ep in range(episodes_per_iter):
            init_alt = 500.0 + float(np.random.uniform(-10.0, 10.0))
            init_x = -300.0 + float(np.random.uniform(-10.0, 10.0))
            obs, info = env.reset(options={"altitude": init_alt, "pos_x": init_x})
            done = False
            steps = 0
            while not done and steps < 6000:
                steps += 1
                expert_act = autopilot.get_action(
                    env.altitude, env.pos_x, env.vertical_velocity,
                    env.horizontal_velocity, env.tilt_angle, env.fuel_consumed
                )
                dataset.append((obs, expert_act))

                pol_act = policy.get_action(obs, deterministic=True)
                act = expert_act if np.random.rand() < beta else pol_act
                obs, r, term, trunc, info = env.step(act)
                done = term or trunc

    # Final fine-tune on all collected recovery states
    states = torch.FloatTensor(np.array([s for s, a in dataset]))
    actions = torch.LongTensor([a for s, a in dataset])
    indices = np.arange(len(dataset))
    for epoch in range(6):
        np.random.shuffle(indices)
        for i in range(0, len(dataset), batch_size):
            b_idx = indices[i : i + batch_size]
            optimizer.zero_grad()
            logits = policy(states[b_idx])
            loss = criterion(logits, actions[b_idx])
            loss.backward()
            optimizer.step()

    env.close()

    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    policy.save(save_path)
    print(f"\n✓ Trained policy saved to '{save_path}'")
    return policy


def evaluate_policy(
    policy: LanderPolicy,
    num_episodes: int = 5,
    mode: GameMode = GameMode.HARD,
) -> Dict[str, Any]:
    """Benchmark policy in Gymnasium LunarLanderEnv and report landing metrics."""
    print("\n" + "=" * 60)
    print("EVALUATING TRAINED NEURAL POLICY IN GYMNASIUM")
    print(f"Mode: {mode.value} | Test Episodes: {num_episodes}")
    print("=" * 60)

    env = LunarLanderEnv(mode=mode, telemetry_file="models/eval_telemetry.csv")
    successes = 0
    sink_rates = []
    tilt_angles = []
    remaining_fuels = []
    pad_offsets = []

    for ep in range(1, num_episodes + 1):
        obs, info = env.reset()
        done = False
        steps = 0
        while not done and steps < 6000:
            steps += 1
            action = policy.get_action(obs, deterministic=True)
            obs, reward, terminated, truncated, info = env.step(action)
            done = terminated or truncated

        sink_rates.append(info["sink_rate"])
        tilt_angles.append(abs(env.tilt_angle))
        remaining_fuels.append(max(0.0, 100.0 - env.fuel_consumed))
        pad_offsets.append(abs(env.pos_x))

        if info["landing_success"]:
            successes += 1
            status = "✓ TOUCHDOWN SUCCESS"
        else:
            status = f"✗ CRASH ({info['status_message']})"

        print(
            f"  Flight {ep:02d}: {status} | "
            f"Sink: {info['sink_rate']:.2f} m/s | "
            f"Offset: {abs(env.pos_x):.1f}m | "
            f"Tilt: {abs(env.tilt_angle):.1f}° | "
            f"Fuel: {100 - env.fuel_consumed:.1f}%"
        )

    env.close()

    success_rate = (successes / num_episodes) * 100.0
    avg_sink = float(np.mean(sink_rates))
    avg_tilt = float(np.mean(tilt_angles))
    avg_fuel = float(np.mean(remaining_fuels))
    avg_offset = float(np.mean(pad_offsets))

    print("-" * 60)
    print(f"OVERALL SUCCESS RATE: {success_rate:.1f}% ({successes}/{num_episodes})")
    print(f"Average Sink Rate:    {avg_sink:.2f} m/s (Limit: < 1.0 m/s)")
    print(f"Average Pad Offset:   {avg_offset:.1f} m (Pad Half-Width: 50.0 m)")
    print(f"Average Tilt Angle:   {avg_tilt:.1f}° (Limit: < 10.0°)")
    print(f"Average Fuel Left:    {avg_fuel:.1f}%")
    print("-" * 60)

    return {
        "success_rate": success_rate,
        "avg_sink_rate": avg_sink,
        "avg_tilt_angle": avg_tilt,
        "avg_fuel_remaining": avg_fuel,
        "avg_pad_offset": avg_offset,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gymnasium RL / DAgger Training for Lunar Lander")
    parser.add_argument("--episodes", type=int, default=5, help="Evaluation episodes")
    parser.add_argument("--mode", type=str, default="Hard", choices=["Easy", "Hard"], help="Game mode")
    args = parser.parse_args()

    mode = GameMode.HARD if args.mode == "Hard" else GameMode.EASY

    # 1. Train Neural Policy
    policy = train_dagger_policy(csv_file=Config.TELEMETRY_CSV_FILE)

    # 2. Evaluate Policy in Gymnasium
    evaluate_policy(policy=policy, num_episodes=args.episodes, mode=mode)
