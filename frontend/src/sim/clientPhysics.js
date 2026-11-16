import { Config, GameMode } from './constants';

export class ClientPhysics {
  constructor(mode = GameMode.HARD) {
    this.mode = mode;
    this.reset();
  }

  setMode(mode) {
    this.mode = mode;
    this.reset();
  }

  reset() {
    this.altitude = Config.START_ALTITUDE;
    this.range_to_pad = Config.START_RANGE;
    this.vertical_velocity = Config.START_VERTICAL_VELOCITY;
    this.horizontal_velocity = Config.START_HORIZONTAL_VELOCITY;
    this.tilt_angle = Config.START_TILT_ANGLE;
    this.fuel_consumed = Config.START_FUEL_CONSUMED;
    this.elapsed_time = 0.0;
    this.steps = 0;
    this.is_terminal = false;
    this.landing_success = false;
    this.status_message = 'In Flight';
    this.last_action = 0;
    this.is_paused = false;

    // Telemetry log storage for export
    this.telemetryHistory = [
      {
        timestamp: '00:00.0',
        fuel_consumed: 0,
        vertical_velocity: 0,
        horizontal_velocity: 0,
        altitude: Math.round(this.altitude),
        tilt_angle: 0,
        range_to_pad: Math.round(this.range_to_pad),
        mode: this.mode,
        result: 'IN_PROGRESS',
      },
    ];
    this.lastLogSec = 0;
  }

  step(action) {
    if (this.is_terminal || this.is_paused) {
      return this.getState();
    }

    const dt = Config.DT;
    this.steps += 1;
    this.elapsed_time += dt;
    this.last_action = action;

    const hasFuel = this.fuel_consumed < 100.0;
    let thrustVx = 0.0;
    let thrustVy = 0.0;

    // 1. Actions
    if (action === 1 && hasFuel) {
      this.fuel_consumed = Math.min(100.0, this.fuel_consumed + Config.MAIN_THRUST_FUEL_RATE * dt);
      const angleRad = (this.tilt_angle * Math.PI) / 180.0;
      thrustVx = Config.MAIN_THRUST_ACCEL * Math.sin(angleRad);
      thrustVy = Config.MAIN_THRUST_ACCEL * Math.cos(angleRad);
    } else if (action === 2 && hasFuel) {
      this.fuel_consumed = Math.min(100.0, this.fuel_consumed + Config.PITCH_FUEL_RATE * dt);
      this.tilt_angle -= Config.PITCH_SPEED * dt;
    } else if (action === 3 && hasFuel) {
      this.fuel_consumed = Math.min(100.0, this.fuel_consumed + Config.PITCH_FUEL_RATE * dt);
      this.tilt_angle += Config.PITCH_SPEED * dt;
    }

    // Wrap tilt angle within [-180, 180]
    if (this.tilt_angle > 180.0) this.tilt_angle -= 360.0;
    else if (this.tilt_angle < -180.0) this.tilt_angle += 360.0;

    // 2. Gravity
    const gravity = this.mode === GameMode.HARD ? Config.GRAVITY_HARD : Config.GRAVITY_EASY;

    // 3. Acceleration & Velocity
    const accelX = thrustVx;
    const accelY = thrustVy - gravity;

    this.horizontal_velocity += accelX * dt;
    this.vertical_velocity += accelY * dt;

    // 4. Position update
    this.range_to_pad += this.horizontal_velocity * dt;
    this.altitude += this.vertical_velocity * dt;

    // 5. Constraints & Landing checks
    const maxSink = this.mode === GameMode.HARD ? Config.HARD_MAX_SINK_RATE : Config.EASY_MAX_SINK_RATE;
    const maxTilt = this.mode === GameMode.HARD ? Config.HARD_MAX_TILT_ANGLE : Config.EASY_MAX_TILT_ANGLE;
    const sinkRate = this.vertical_velocity < 0 ? -this.vertical_velocity : 0.0;

    if (this.altitude <= 0.0) {
      this.altitude = 0.0;
      this.is_terminal = true;

      const onPad = Math.abs(this.range_to_pad) <= Config.PAD_WIDTH / 2.0;
      const acceptableSink = sinkRate <= maxSink;
      const acceptableTilt = Math.abs(this.tilt_angle) <= maxTilt;

      if (onPad && acceptableSink && acceptableTilt) {
        this.landing_success = true;
        this.status_message = 'SUCCESSFUL LANDING!';
      } else {
        this.landing_success = false;
        const failureReasons = [];
        if (!acceptableSink) {
          failureReasons.push(`Hard Impact (Sink Rate: ${sinkRate.toFixed(1)} m/s > ${maxSink} m/s)`);
        }
        if (!acceptableTilt) {
          failureReasons.push(`Excessive Tilt (${Math.abs(this.tilt_angle).toFixed(1)}° > ${maxTilt}°)`);
        }
        if (!onPad) {
          failureReasons.push(`Missed Pad (Range: ${this.range_to_pad.toFixed(1)} m)`);
        }
        this.status_message = 'CRASH: ' + failureReasons.join(', ');
      }
    } else if (this.altitude > 1500.0 || Math.abs(this.range_to_pad) > 600.0) {
      this.is_terminal = true;
      this.landing_success = false;
      this.status_message = 'ABORT: Out of bounds (Drift limit exceeded)';
    }

    // 1 Hz telemetry log
    const currentSec = Math.floor(this.elapsed_time);
    if (currentSec > this.lastLogSec || this.is_terminal) {
      this.lastLogSec = currentSec;
      const mins = Math.floor(this.elapsed_time / 60);
      const secs = (this.elapsed_time % 60).toFixed(1);
      const formattedTime = `${String(mins).padStart(2, '0')}:${secs.padStart(4, '0')}`;
      this.telemetryHistory.push({
        timestamp: formattedTime,
        fuel_consumed: Math.round(this.fuel_consumed),
        vertical_velocity: Math.round(this.vertical_velocity),
        horizontal_velocity: Math.round(this.horizontal_velocity),
        altitude: Math.round(this.altitude),
        tilt_angle: Math.round(this.tilt_angle),
        range_to_pad: Math.round(this.range_to_pad),
        mode: this.mode,
        result: this.is_terminal ? (this.landing_success ? 'SUCCESS' : 'CRASH') : 'IN_PROGRESS',
      });
    }

    return this.getState();
  }

  togglePause() {
    this.is_paused = !this.is_paused;
    return this.is_paused;
  }

  getState() {
    const maxSink = this.mode === GameMode.HARD ? Config.HARD_MAX_SINK_RATE : Config.EASY_MAX_SINK_RATE;
    const maxTilt = this.mode === GameMode.HARD ? Config.HARD_MAX_TILT_ANGLE : Config.EASY_MAX_TILT_ANGLE;
    const sinkRate = this.vertical_velocity < 0 ? -this.vertical_velocity : 0.0;

    return {
      altitude: this.altitude,
      range_to_pad: this.range_to_pad,
      vertical_velocity: this.vertical_velocity,
      horizontal_velocity: this.horizontal_velocity,
      tilt_angle: this.tilt_angle,
      fuel_consumed: this.fuel_consumed,
      elapsed_time: this.elapsed_time,
      is_terminal: this.is_terminal,
      landing_success: this.landing_success,
      status_message: this.status_message,
      mode: this.mode,
      last_action: this.last_action,
      sink_rate: sinkRate,
      max_sink_rate: maxSink,
      max_tilt_angle: maxTilt,
      pad_width: Config.PAD_WIDTH,
      is_paused: this.is_paused,
    };
  }
}
