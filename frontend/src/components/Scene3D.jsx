import React, { useRef, useMemo, Suspense, Component } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, Grid, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const MODEL_HEIGHT = 2.2;
const SCALE_X = 0.05; // 1m range = 0.05 scene units (pad 50m = 2.5 scene units)
const SCALE_Y = 0.05; // 1m alt = 0.05 scene units (500m alt = 25 scene units)

/** Unit plume geometry for main thruster */
const FLAME_GEOMETRY = (() => {
  const geom = new THREE.ConeGeometry(0.35, 1.4, 16, 1, true);
  geom.rotateX(Math.PI);
  geom.translate(0, -0.7, 0);
  return geom;
})();

/** Unit plume geometry for RCS lateral jets */
const RCS_GEOMETRY = (() => {
  const geom = new THREE.ConeGeometry(0.12, 0.6, 12, 1, true);
  geom.translate(0, 0.3, 0);
  return geom;
})();

/** Shows fallback if GLTF cannot load */
class ModelBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn('GLTF loading error, using procedural fallback:', err);
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

/** 3D GLTF Model loaded from /cx3-pdi.glb */
function GltfModel() {
  const { scene } = useGLTF('/cx3-pdi.glb');
  const clone = useMemo(() => {
    const c = scene.clone();
    c.scale.set(0.00065, 0.00065, 0.00065);
    c.position.set(0, -0.6, 0);
    return c;
  }, [scene]);

  return <primitive object={clone} />;
}

/** Procedural fallback model with Apollo / PDI style lander components */
function ProceduralLander() {
  return (
    <group>
      {/* Octagonal Descent Stage / Fuel Core */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.65, 0.6, 8]} />
        <meshStandardMaterial color="#8a7658" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Gold Foil Thermal Insulation Wraps */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.9, 0.45, 0.9]} />
        <meshStandardMaterial color="#b58900" metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Crew Cabin / Ascent Capsule */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.4, 0.52, 0.6, 12]} />
        <meshStandardMaterial color="#404040" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* Forward Observation Windows */}
      <mesh position={[0, 0.62, 0.38]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.3, 0.16, 0.1]} />
        <meshStandardMaterial color="#1a3b5c" roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Top Docking Hatch & RCS Hub */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.15, 12]} />
        <meshStandardMaterial color="#2d2d2d" metalness={0.5} />
      </mesh>

      {/* Main Descent Engine Bell */}
      <mesh position={[0, -0.42, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.32, 0.45, 16, 1, true]} />
        <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Four Quad Outrigger Landing Legs with Footpads */}
      {[0, 1, 2, 3].map((idx) => {
        const angle = (idx * Math.PI) / 2 + Math.PI / 4;
        const x = Math.cos(angle) * 0.7;
        const z = Math.sin(angle) * 0.7;
        return (
          <group key={idx} position={[x, -0.2, z]} rotation={[Math.sin(angle) * 0.4, 0, -Math.cos(angle) * 0.4]}>
            {/* Primary Strut */}
            <mesh position={[0, -0.3, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.7, 8]} />
              <meshStandardMaterial color="#737373" metalness={0.7} />
            </mesh>
            {/* Dish Footpad */}
            <mesh position={[0, -0.65, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.03, 12]} />
              <meshStandardMaterial color="#908172" metalness={0.6} />
            </mesh>
          </group>
        );
      })}

      {/* Gruvbox Green Nose Alignment Boom */}
      <mesh position={[0, 0.35, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
        <meshStandardMaterial color="#689a6a" emissive="#689a6a" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.35, 0.86]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial color="#689a6a" />
      </mesh>
    </group>
  );
}

/** Animated Lander Group with Position, Tilt, Flames, and RCS */
function LanderVehicle({ state, lastAction }) {
  const groupRef = useRef();
  const flameRef = useRef();
  const leftRcsRef = useRef();
  const rightRcsRef = useRef();
  const flameLightRef = useRef();

  const targetX = (state.range_to_pad || 0) * SCALE_X;
  const targetY = Math.max(0.4, (state.altitude || 0) * SCALE_Y + 0.4);
  const targetTiltRad = ((state.tilt_angle || 0) * Math.PI) / 180;

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;

    // Smooth movement interpolation
    const lerpFactor = 1 - Math.exp(-18 * delta);
    groupRef.current.position.x += (targetX - groupRef.current.position.x) * lerpFactor;
    groupRef.current.position.y += (targetY - groupRef.current.position.y) * lerpFactor;
    groupRef.current.position.z = 0;

    // Tilt rotation on Z-axis (positive tilt = pitch right clockwise)
    const currentRotZ = groupRef.current.rotation.z;
    groupRef.current.rotation.z += (-targetTiltRad - currentRotZ) * lerpFactor;

    // Main Thruster Plume Animation
    const isThrusting = state.last_action === 1 && state.fuel_consumed < 100 && !state.is_terminal;
    if (flameRef.current) {
      flameRef.current.visible = isThrusting;
      if (isThrusting) {
        const time = clock.getElapsedTime();
        const flicker = 1 + 0.12 * Math.sin(time * 50);
        flameRef.current.scale.set(flicker, flicker * 1.3, flicker);
      }
    }
    if (flameLightRef.current) {
      flameLightRef.current.intensity = isThrusting ? 3.5 : 0;
    }

    // RCS Lateral Thrusters: Left tilts right (Action 3), Right tilts left (Action 2)
    const isPitchLeft = state.last_action === 2 && state.fuel_consumed < 100 && !state.is_terminal;
    const isPitchRight = state.last_action === 3 && state.fuel_consumed < 100 && !state.is_terminal;

    if (leftRcsRef.current) {
      leftRcsRef.current.visible = isPitchRight;
      if (isPitchRight) {
        const f = 1 + 0.1 * Math.sin(clock.getElapsedTime() * 40);
        leftRcsRef.current.scale.set(f, f, f);
      }
    }

    if (rightRcsRef.current) {
      rightRcsRef.current.visible = isPitchLeft;
      if (isPitchLeft) {
        const f = 1 + 0.1 * Math.sin(clock.getElapsedTime() * 40);
        rightRcsRef.current.scale.set(f, f, f);
      }
    }
  });

  return (
    <group ref={groupRef} position={[targetX, targetY, 0]}>
      <ModelBoundary fallback={<ProceduralLander />}>
        <Suspense fallback={<ProceduralLander />}>
          <GltfModel />
        </Suspense>
      </ModelBoundary>

      {/* Main Engine Plumes */}
      <group ref={flameRef} position={[0, -0.4, 0]} visible={false}>
        {/* Hot Core Plume */}
        <mesh geometry={FLAME_GEOMETRY} scale={[0.5, 0.9, 0.5]}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        {/* Inner Orange Plume */}
        <mesh geometry={FLAME_GEOMETRY} scale={[0.8, 1.2, 0.8]}>
          <meshBasicMaterial color="#ff7a00" transparent opacity={0.8} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        {/* Outer Glow Flame */}
        <mesh geometry={FLAME_GEOMETRY} scale={[1.2, 1.5, 1.2]}>
          <meshBasicMaterial color="#ff3300" transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        {/* Dynamic Thruster Light */}
        <pointLight ref={flameLightRef} color="#ff7700" distance={6} intensity={0} decay={2} />
      </group>

      {/* RCS Plumes */}
      {/* Left Nozzle (pushes nose right, points to the left) */}
      <group ref={leftRcsRef} position={[-0.55, 0.5, 0]} rotation={[0, 0, Math.PI / 2]} visible={false}>
        <mesh geometry={RCS_GEOMETRY}>
          <meshBasicMaterial color="#5aa6ff" transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Right Nozzle (pushes nose left, points to the right) */}
      <group ref={rightRcsRef} position={[0.55, 0.5, 0]} rotation={[0, 0, -Math.PI / 2]} visible={false}>
        <mesh geometry={RCS_GEOMETRY}>
          <meshBasicMaterial color="#5aa6ff" transparent opacity={0.85} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

/** Lunar Ground Surface and Landing Pad */
function LunarPad({ padWidthM = 50 }) {
  const padWidthScene = padWidthM * SCALE_X; // 50 * 0.05 = 2.5 scene units radius approx

  return (
    <group position={[0, 0, 0]}>
      {/* Dark Lunar Surface Disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[60, 48]} />
        <meshStandardMaterial color="#0d0f12" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Tactical Lunar Grid */}
      <Grid
        args={[80, 80]}
        position={[0, 0.01, 0]}
        cellColor="#262b33"
        sectionColor="#3e4756"
        cellSize={1}
        sectionSize={5}
        fadeDistance={50}
        fadeStrength={1.5}
      />

      {/* Target Landing Pad */}
      <group position={[0, 0.02, 0]}>
        {/* Pad Outer Platform */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0, padWidthScene / 2, 32]} />
          <meshStandardMaterial color="#1a202c" roughness={0.7} metalness={0.3} />
        </mesh>

        {/* Outer Glowing Boundary Ring (Accent Green) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[padWidthScene / 2 - 0.08, padWidthScene / 2, 32]} />
          <meshBasicMaterial color="#689a6a" side={THREE.DoubleSide} />
        </mesh>

        {/* Inner Bulls-Eye Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.42, 24]} />
          <meshBasicMaterial color="#fabd2f" side={THREE.DoubleSide} />
        </mesh>

        {/* Center Target Crosshair Lines */}
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[padWidthScene * 0.8, 0.04]} />
          <meshBasicMaterial color="#e8d9af" opacity={0.6} transparent />
        </mesh>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[padWidthScene * 0.8, 0.04]} />
          <meshBasicMaterial color="#e8d9af" opacity={0.6} transparent />
        </mesh>

        {/* 4 Corner Touchdown Beacons */}
        {[
          [-padWidthScene / 2, 0, -padWidthScene / 2],
          [padWidthScene / 2, 0, -padWidthScene / 2],
          [-padWidthScene / 2, 0, padWidthScene / 2],
          [padWidthScene / 2, 0, padWidthScene / 2],
        ].map(([bx, by, bz], i) => (
          <group key={i} position={[bx, by, bz]}>
            <mesh position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.04, 0.05, 0.3, 8]} />
              <meshStandardMaterial color="#555555" />
            </mesh>
            <mesh position={[0, 0.32, 0]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshBasicMaterial color="#689a6a" />
            </mesh>
            <pointLight color="#689a6a" distance={2} intensity={0.8} />
          </group>
        ))}
      </group>
    </group>
  );
}

/** Dynamic Camera Framing */
function DynamicCameraController({ state, cameraMode }) {
  const { camera } = useThree();
  const targetLookAt = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (cameraMode === 'free') return; // User OrbitControls handles position

    const landerX = (state.range_to_pad || 0) * SCALE_X;
    const landerY = Math.max(0.4, (state.altitude || 0) * SCALE_Y + 0.4);
    const speed = 1 - Math.exp(-6 * delta);

    if (cameraMode === 'chase') {
      // Behind and slightly above lander, framing both lander and landing pad
      const camTargetX = landerX * 0.6;
      const camTargetY = Math.max(3.5, landerY + 2.5);
      const camTargetZ = 8.5;

      camera.position.x += (camTargetX - camera.position.x) * speed;
      camera.position.y += (camTargetY - camera.position.y) * speed;
      camera.position.z += (camTargetZ - camera.position.z) * speed;

      targetLookAt.current.x += (landerX * 0.8 - targetLookAt.current.x) * speed;
      targetLookAt.current.y += (landerY * 0.5 - targetLookAt.current.y) * speed;
      targetLookAt.current.z += (0 - targetLookAt.current.z) * speed;

      camera.lookAt(targetLookAt.current);
    } else if (cameraMode === 'pad') {
      // Fixed on the ground pad edge looking up at lander
      camera.position.x += (1.8 - camera.position.x) * speed;
      camera.position.y += (0.6 - camera.position.y) * speed;
      camera.position.z += (3.5 - camera.position.z) * speed;

      targetLookAt.current.x += (landerX - targetLookAt.current.x) * speed;
      targetLookAt.current.y += (landerY - targetLookAt.current.y) * speed;
      targetLookAt.current.z += (0 - targetLookAt.current.z) * speed;

      camera.lookAt(targetLookAt.current);
    }
  });

  return null;
}

export default function Scene3D({ state, cameraMode = 'chase' }) {
  return (
    <Canvas
      camera={{ position: [0, 6, 12], fov: 45 }}
      style={{ width: '100%', height: '100%', background: '#000000' }}
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={['#000000']} />
      
      {/* Lighting */}
      <ambientLight intensity={1.2} />
      <directionalLight position={[10, 20, 15]} intensity={2.5} color="#e8d9af" castShadow />
      <directionalLight position={[-15, 10, -10]} intensity={0.6} color="#4488ff" />

      {/* Deep Space Starfield */}
      <Stars radius={150} depth={50} count={3500} factor={4} saturation={0} fade speed={0.8} />

      {/* Lunar Pad and Surface */}
      <LunarPad padWidthM={state.pad_width || 50} />

      {/* 3D Lander */}
      <LanderVehicle state={state} lastAction={state.last_action} />

      {/* Camera logic */}
      <DynamicCameraController state={state} cameraMode={cameraMode} />

      {cameraMode === 'free' && (
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2 - 0.05} // Do not clip below ground
          minDistance={2}
          maxDistance={35}
        />
      )}
    </Canvas>
  );
}
