# Mission 

A simple Lunar Lander game using Pygame and Gymnasium with minimal set of parameters such as 
| Parameters        | Unit | Data type | State   |
| ----------------- | ---- | --------- | ------- |
| Time stamp        | time | time      | Dynamic |
| Fuel Consumed     | %    | int       | Dynamic |
| Vertical Velocity | m/s  | int       | Dynamic |
| Horizontal Vel    | m/s  | int       | Dynamic |
| Altitude          | m    | int       | Dynamic |
| Tilt Angle        | deg  | int       | Dynamic |
| Range to Pad      | m    | int       | Dynamic |
| Mode              | -    | Enum      | Static  |
| Result            | -    | Boolean   | Static  |

## Parameters that has to be defined 

1. Fuel Consumption - Mass flow (amount of fuel burnt per second)
2. Alt - (Starting point)
3. Range - starting point for lander to pad
4. Throttle impact on vertical velocity per percentage - tilt has to be accounted 

These telemetry values has to be stored in a DB, so that we can train the Lander with Gymnasium RL to create a optimized policy only using the telemetry data of successful landings. 
## Constraints 

1. Sink Rate (< 1.0 m/s)
2. Tilt Angle (<10 deg)
3. Fuel consumption (can't thrust or pitch after < 0%)

## Modes 

1. Easy - Gravity wouldn't act and constraints are relaxed. 
2. Hard - Includes Gravity Force (1.62 m/s which consumes more fuel and decreases the vertical velocity), strict constraints 

## Controls & Movements 

1. Thrust (△) - Ascending meters 
2. Pitch (◁ | ▷) - Tilt angle 
3. Pause (Spacebar)

