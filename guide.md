# Lunar Lander Flight Manual & Landing Guide (`guide.md`)

Welcome to the **Apollo Lunar Lander Flight Manual**. This guide provides flight procedures, physics principles, and step-by-step techniques to achieve a gentle, successful touchdown on the lunar surface.

---

## 1. Mission Briefing & Initial Conditions

| Flight Parameter | Starting Value | Target at Touchdown |
| :--- | :--- | :--- |
| **Altitude** | `500.0 m` | `0.0 m` (Surface level) |
| **Position X** | `-300.0 m` (Left of pad) | `0.0 m` (Center of pad flags) |
| **Range to Pad** | `300.0 m` | $\le 50.0\text{ m}$ (Between the flags) |
| **Vertical Velocity ($V_y$)** | `0.0 m/s` | **Hard Mode**: $>-1.0\text{ m/s}$ (Sink Rate $< 1.0\text{ m/s}$)<br>**Easy Mode**: $>-3.0\text{ m/s}$ (Sink Rate $< 3.0\text{ m/s}$) |
| **Horizontal Vel ($V_x$)** | `0.0 m/s` | $\approx 0.0\text{ m/s}$ (Stationary hover/descent) |
| **Tilt Angle ($\theta$)** | `0.0°` (Upright) | **Hard Mode**: $< 10.0^\circ$<br>**Easy Mode**: $< 25.0^\circ$ |
| **Fuel Remaining** | `100.0%` (0% consumed) | $> 0.0\%$ (Controls lock at 0%) |

---

## 2. Flight Controls

| Action | Keyboard | Touch / On-Screen | Function |
| :--- | :--- | :--- | :--- |
| **Main Thruster** | `W` / `↑` / `Up Arrow` | `▲ Thrust` | Fires main engine ($3.50\text{ m/s}^2$ thrust along lander axis) |
| **Pitch Left** | `A` / `←` / `Left Arrow` | `◀` | Tilts vehicle counter-clockwise ($30^\circ/\text{sec}$) |
| **Pitch Right** | `D` / `→` / `Right Arrow` | `▶` | Tilts vehicle clockwise ($30^\circ/\text{sec}$) |
| **Pause / Resume** | `Spacebar` | `⏸` / `▶` | Freezes physics simulation |
| **Quick Restart** | `R` | `↺ [R]` | Immediately resets to initial release point |
| **Toggle Mode** | `M` | `Mode` pill | Switches between **Easy** and **Hard** modes |
| **AI Autopilot** | `P` | `[P]` | Engages / Disengages trained neural guidance policy |

---

## 3. Flight Mechanics & Thrust Vectoring

Moon gravity ($g = 1.62\text{ m/s}^2$) continuously pulls the lander toward the surface in **both Easy and Hard modes**.

Thrust is always directed through the **lander's vertical centerline**:
$$\text{Vertical Accel: } a_y = T \cdot \cos(\theta) - 1.62\text{ m/s}^2$$
$$\text{Horizontal Accel: } a_x = -T \cdot \sin(\theta)$$

- **Upright ($\theta = 0^\circ$)**: Provides maximum vertical climb/braking ($\text{net } a_y = +1.88\text{ m/s}^2$, $a_x = 0$).
- **Tilted Left ($\theta < 0^\circ$)**: Main thrust pushes the lander **to the right** toward the pad.
- **Tilted Right ($\theta > 0^\circ$)**: Main thrust pushes the lander **to the left**.

> [!TIP]
> Because you start **$300\text{ m}$ to the left** of the pad, your first maneuver is to **tilt left** ($\theta \approx -15^\circ$ to $-20^\circ$) and fire the thruster to acquire rightward speed.

---

## 4. Step-by-Step Landing Corridor (The 4 Flight Phases)

```
       Alt 500m  [Lander] (x = -300m)
                   \
                    \   Phase 1: Pitch Left (-20°), burn thrust -> Gain Vx ~ +10 m/s
                     \
       Alt 300m       \  Phase 2: Pitch Right (+15°), brake Vx as pad approaches
                       \
       Alt 100m         |  Phase 3: Zero out tilt (0°), align over pad, reduce Vy to -3 m/s
                        |
       Alt 30m          |  Phase 4: Gentle feathering, Sink Rate < 1.0 m/s
                        |
       Surface (0m)   [ |=== PAD ===| ]
```

### Phase 1: Transposition & Cross-Range Acceleration (Alt 500m $\to$ 350m)
1. At release, tap `A` (Pitch Left) until Tilt Angle reaches approximately **$-18^\circ$ to $-22^\circ$**.
2. Press and hold `W` (Thrust) in a **2 to 3 second burn**.
3. Watch the **Horizontal Vel** pill: aim for **$+8\text{ m/s}$ to $+12\text{ m/s}$** toward the right.
4. Return the lander upright (`D`) to stop increasing horizontal velocity.

### Phase 2: Cruising & Horizontal Braking Approach (Alt 350m $\to$ 100m)
1. You are now gliding rightward toward the landing pad. Gravity will naturally increase your **Sink Rate** (vertical speed downward).
2. Give short 1-second throttle pulses upright to maintain Sink Rate between **$5\text{ m/s}$ and $8\text{ m/s}$**. Do not let sink rate exceed $12\text{ m/s}$.
3. When **Range to Pad** drops below **$80\text{ m}$**, prepare to brake horizontally:
   - Tap `D` (Pitch Right) to tilt to **$+15^\circ$ to $+20^\circ$**.
   - Pulse `W` (Thrust) to cancel your rightward momentum until **Horizontal Vel** is under **$1.0\text{ m/s}$**.
   - Tap `A` to bring the lander upright ($\theta = 0^\circ$).

### Phase 3: Alignment & Terminal Descent (Alt 100m $\to$ 25m)
1. Confirm the lander is positioned directly between the two Atari flags ($|x| < 35\text{ m}$).
2. Keep the lander strictly upright ($|\theta| \le 3^\circ$).
3. Maintain steady pulses to keep Sink Rate at approximately **$2.5\text{ m/s}$**.

### Phase 4: Touchdown Flare (Alt 25m $\to$ 0m)
1. **Feather the Throttle**: Rather than holding thrust, use rapid, gentle half-second taps on `W`.
2. As altitude drops below $10\text{ m}$:
   - Keep tilt under **$3^\circ$**.
   - Reduce Sink Rate to between **$0.4\text{ m/s}$ and $0.8\text{ m/s}$**.
3. Contact ground at $0\text{ m}$. Footpads will rest directly on the pad surface, triggering:
   $$\text{✓ TOUCHDOWN SUCCESSFUL}$$

---

## 5. Easy vs. Hard Mode Comparison

| Feature | Easy Mode | Hard Mode | Pilot Advice |
| :--- | :--- | :--- | :--- |
| **Gravity** | $1.62\text{ m/s}^2$ | $1.62\text{ m/s}^2$ | Gravity is identical; descents feel equally realistic. |
| **Propellant Supply** | **Generous Fuel** ($1.0\%/\text{s}$) | **Default Fuel** ($2.5\%/\text{s}$) | In Hard mode, you have ~40s of total burn time. Coast between burns. |
| **Max Sink Rate** | $< 3.0\text{ m/s}$ | $< 1.0\text{ m/s}$ | In Hard mode, a landing at $1.2\text{ m/s}$ will crush the landing gear! |
| **Max Tilt Angle** | $< 25.0^\circ$ | $< 10.0^\circ$ | Keep the vehicle almost completely vertical ($< 5^\circ$) for safety. |

---

## 6. Top 5 Mistakes and How to Avoid Them

| Mistake | What Happens | How to Correct |
| :--- | :--- | :--- |
| **1. Continuous Thrusting** | Lander rockets up into space or runs out of propellant early. | Never hold thrust continuously. Use 1–2 second pulses and coast. |
| **2. Late Braking** | Waiting until $30\text{ m}$ to slow down from $12\text{ m/s}$. Physics won't allow stopping in time. | Start managing sink rate at $150\text{ m}$. Enter the final $30\text{ m}$ below $2.5\text{ m/s}$. |
| **3. Over-tilting near ground** | Tilting $> 15^\circ$ below $25\text{ m}$ causes sideways slide and failure. | Lock tilt to $0^\circ$ once below $30\text{ m}$. Focus only on vertical sink rate. |
| **4. Ignoring Horizontal Velocity** | Lander lands upright but slides across the surface outside the flags. | Brake horizontal speed early (around $100\text{ m}$ range) so $V_x \approx 0$ over the pad. |
| **5. Drifting Past the Pad** | Over-accelerating to $+15\text{ m/s}$ rightward and overshooting the flags. | Build no more than $+10\text{ m/s}$ rightward speed during Phase 1. |

---

## 7. Understanding the HUD Telemetry

- **`Range`**: Absolute horizontal distance to pad center. Must be $< 50\text{ m}$ at touchdown.
- **`Tilt`**: Degrees from vertical. Keep close to $0^\circ$ at landing.
- **`Sink Rate`**: Downward speed. In Hard mode, must be $< 1.0\text{ m/s}$ (amber/red alert if dangerously fast).
- **`Horizontal Vel`**: Sideways drift speed.
- **`Alt` Capsule (Teal)**: Full gauge represents $500\text{ m}$. Turns red near the ground if sink rate is hazardous.
- **`Fuel` Capsule (Teal)**: Decreases as thruster and RCS fire. Conserve above 15% for terminal flare.

Happy landings, Commander!
