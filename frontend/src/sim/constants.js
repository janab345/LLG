/**
 * Physical constants and configuration matching LLG.md and config.py.
 */

export const GameMode = {
  EASY: 'Easy',
  HARD: 'Hard',
};

export const Config = {
  // World parameters
  PAD_WIDTH: 50.0, // meters (+/- 25m from pad center)
  START_ALTITUDE: 500.0, // meters
  START_RANGE: -120.0, // meters offset from pad center
  START_VERTICAL_VELOCITY: 0.0, // m/s
  START_HORIZONTAL_VELOCITY: 0.0, // m/s
  START_TILT_ANGLE: 0.0, // degrees
  START_FUEL_CONSUMED: 0.0, // percentage (0 - 100%)

  // Physics constants
  GRAVITY_HARD: 1.62, // Moon gravity (m/s^2)
  GRAVITY_EASY: 0.00, // Zero-g mode (m/s^2)
  MAIN_THRUST_ACCEL: 3.50, // m/s^2 acceleration along lander normal
  PITCH_SPEED: 30.0, // deg/s tilt rate

  // Fuel consumption (Mass flow per second)
  MAIN_THRUST_FUEL_RATE: 2.5, // % fuel consumed per second of thrust
  PITCH_FUEL_RATE: 0.5, // % fuel consumed per second of pitch

  // Constraints for landing
  HARD_MAX_SINK_RATE: 1.0, // Sink rate < 1.0 m/s
  HARD_MAX_TILT_ANGLE: 10.0, // Tilt angle < 10 degrees

  EASY_MAX_SINK_RATE: 3.0, // Relaxed sink rate < 3.0 m/s
  EASY_MAX_TILT_ANGLE: 25.0, // Relaxed tilt angle < 25 degrees

  FPS: 60,
  DT: 1.0 / 60.0,
};
