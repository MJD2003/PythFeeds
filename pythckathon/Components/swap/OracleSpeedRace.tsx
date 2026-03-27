"use client";

import React, {
  useEffect, useRef, useState, useMemo, useCallback,
  Component, type ErrorInfo, type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { runOracleRace, type OracleResult } from "@/lib/oracle-latency";
import { X, AlertTriangle } from "lucide-react";
import * as THREE from "three";

/* ── constants ── */
const TRACK_LENGTH = 140;
const LANE_WIDTH = 3.0;
const BG_COLOR = "#06020F";
const NEON_CYAN = "#00E5FF";
const RACE_DURATION = 6000;
const INTRO_DURATION = 1800;
const FONT_SYNE = "var(--font-syne), sans-serif";
const FONT_JB = "var(--font-jb-mono), monospace";

function OracleLogo({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  const s = size;
  const c = color || "currentColor";
  switch (name) {
    case "Pyth Network":
      return (
        <svg width={s} height={s} viewBox="0 0 1000 1000" fill="none">
          <path d="M1000 500C1000 776.142 776.142 1000 500 1000C223.858 1000 0 776.142 0 500C0 223.858 223.858 0 500 0C776.142 0 1000 223.858 1000 500Z" fill={`${c}20`} />
          <path d="M575.336 459.157C575.336 494.675 546.559 523.473 511.068 523.473V587.789C582.05 587.789 639.604 530.193 639.604 459.157C639.604 388.122 582.05 330.526 511.068 330.526C487.669 330.526 465.695 336.78 446.801 347.746C408.374 369.97 382.533 411.539 382.533 459.157V780.736L446.801 845.052V459.157C446.801 423.64 475.577 394.841 511.068 394.841C546.559 394.841 575.336 423.64 575.336 459.157Z" fill={c} />
          <path d="M511.07 201.904C464.243 201.904 420.352 214.442 382.535 236.346C358.322 250.338 336.638 268.169 318.268 289.026C278.271 334.376 254 393.95 254 459.168V652.115L318.268 716.431V459.168C318.268 402.037 343.091 350.695 382.535 315.351C401.08 298.771 422.851 285.681 446.803 277.245C466.888 270.089 488.543 266.22 511.07 266.22C617.543 266.22 703.873 352.614 703.873 459.168C703.873 565.721 617.543 652.115 511.07 652.115V716.431C653.063 716.431 768.14 601.238 768.14 459.168C768.14 317.097 653.063 201.904 511.07 201.904Z" fill={c} />
        </svg>
      );
    case "Switchboard":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.5" fill={`${c}15`} />
          <circle cx="12" cy="12" r="4" fill={c} opacity="0.7" />
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" stroke={c} strokeWidth="1.5" />
        </svg>
      );
    case "Chainlink":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" stroke={c} strokeWidth="1.5" fill={`${c}15`} />
          <path d="M12 7l4.33 2.5v5L12 17l-4.33-2.5v-5L12 7z" stroke={c} strokeWidth="1.2" fill={`${c}30`} />
        </svg>
      );
    case "Band Protocol":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M3 16c3-6 6 2 9-4s6 2 9-4" stroke={c} strokeWidth="2" strokeLinecap="round" />
          <path d="M3 12c3-6 6 2 9-4s6 2 9-4" stroke={c} strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
          <path d="M3 20c3-6 6 2 9-4s6 2 9-4" stroke={c} strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
        </svg>
      );
    default:
      return <div style={{ width: s, height: s, borderRadius: "50%", background: c }} />;
  }
}

/* ═══════════════════════════════════════════
   Error Boundary
   ═══════════════════════════════════════════ */
class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[OracleSpeedRace] 3D error:", error, info);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

/* ═══════════════════════════════════════════
   Spring — procedural camera shake
   ═══════════════════════════════════════════ */
class Spring {
  pos = 0; vel = 0;
  constructor(public stiffness = 80, public damping = 8) {}
  kick(force: number) { this.vel += force; }
  update(dt: number) {
    const f = -this.stiffness * this.pos;
    const d = -this.damping * this.vel;
    this.vel += (f + d) * dt;
    this.pos += this.vel * dt;
    return this.pos;
  }
}

/* ═══════════════════════════════════════════
   Spaceship — angular delta-wing fighter
   ═══════════════════════════════════════════ */
function Spaceship({
  lane,
  color,
  progressRef,
  totalLanes,
  raceStarted,
}: {
  lane: number;
  color: string;
  progressRef: React.MutableRefObject<number>;
  totalLanes: number;
  raceStarted: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const exhaustRef = useRef<THREE.Mesh>(null!);
  const exhaust2Ref = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.PointLight>(null!);
  const col = useMemo(() => new THREE.Color(color), [color]);
  const prevZ = useRef(0);

  const xPos = (lane - (totalLanes - 1) / 2) * LANE_WIDTH;

  const hullGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -0.12);
    shape.lineTo(0.22, -0.08);
    shape.quadraticCurveTo(0.28, 0, 0.22, 0.08);
    shape.lineTo(0, 0.12);
    shape.lineTo(-0.22, 0.08);
    shape.quadraticCurveTo(-0.28, 0, -0.22, -0.08);
    shape.lineTo(0, -0.12);
    return new THREE.ExtrudeGeometry(shape, {
      steps: 1, depth: 2.8, bevelEnabled: true,
      bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 4,
    });
  }, []);

  const wingGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.9, -0.05);
    shape.lineTo(0.5, 0.6);
    shape.lineTo(0, 0.4);
    shape.lineTo(0, 0);
    return new THREE.ExtrudeGeometry(shape, {
      steps: 1, depth: 0.02, bevelEnabled: false,
    });
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    const p = progressRef.current;
    const targetZ = -p * TRACK_LENGTH;
    const g = groupRef.current;

    const currentZ = g.position.z;
    const dz = targetZ - currentZ;
    const speedFactor = Math.abs(dz) / 3;
    g.position.z += dz * 0.08;
    g.position.x = xPos;

    const t = Date.now() * 0.001;
    const hover = raceStarted
      ? 0.6 + Math.sin(t * 3 + lane * 1.7) * 0.04
      : 0.6 + Math.sin(t * 1.2 + lane * 2) * 0.06;
    g.position.y = hover;

    if (raceStarted) {
      g.rotation.x = Math.sin(t * 2 + lane) * 0.02 + speedFactor * 0.005;
      g.rotation.z = Math.sin(t * 2.5 + lane * 0.9) * 0.03;
      const accel = (g.position.z - prevZ.current);
      g.rotation.x += accel * 0.1;
    } else {
      g.rotation.x = Math.sin(t * 0.8 + lane) * 0.01;
      g.rotation.z = 0;
    }
    prevZ.current = g.position.z;

    if (exhaustRef.current && exhaust2Ref.current) {
      const idleFlame = 0.2 + Math.sin(t * 8 + lane) * 0.05;
      const raceFlame = raceStarted ? (p >= 1 ? 0.15 : 0.5 + speedFactor * 0.3 + Math.sin(t * 14 + lane) * 0.15) : idleFlame;
      exhaustRef.current.scale.set(raceFlame, raceFlame, raceFlame * 3.5);
      (exhaustRef.current.material as THREE.MeshBasicMaterial).opacity = raceStarted ? (p >= 1 ? 0.08 : 0.6) : 0.2;
      exhaust2Ref.current.scale.set(raceFlame * 0.5, raceFlame * 0.5, raceFlame * 2);
      (exhaust2Ref.current.material as THREE.MeshBasicMaterial).opacity = raceStarted ? (p >= 1 ? 0.04 : 0.4) : 0.1;
    }
    if (glowRef.current) {
      glowRef.current.intensity = raceStarted ? (p >= 1 ? 0.4 : 2 + speedFactor * 1.5 + Math.sin(t * 10) * 0.3) : 0.6;
    }
  });

  return (
    <group ref={groupRef} position={[xPos, 0.6, 0]}>
      {/* Main hull — angular, iridescent */}
      <mesh geometry={hullGeo} rotation={[0, Math.PI, 0]} position={[0, 0, 1.4]}>
        <meshPhysicalMaterial
          color={col} metalness={0.88} roughness={0.18}
          clearcoat={1} clearcoatRoughness={0.04}
          iridescence={0.5} iridescenceIOR={1.4}
          emissive={col} emissiveIntensity={0.3}
        />
      </mesh>

      {/* Nose — sharp pointed cone */}
      <mesh position={[0, 0, -1.5]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.18, 1.0, 8]} />
        <meshPhysicalMaterial
          color="#c8c8d8" metalness={0.95} roughness={0.06}
          emissive={col} emissiveIntensity={0.4}
          clearcoat={1} clearcoatRoughness={0.03}
        />
      </mesh>

      {/* Cockpit canopy — glowing dome */}
      <mesh position={[0, 0.16, -0.5]}>
        <sphereGeometry args={[0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial
          color={col} emissive={col} emissiveIntensity={3}
          metalness={0} roughness={0.05} transparent opacity={0.9}
          clearcoat={1}
        />
      </mesh>

      {/* Left delta wing */}
      <mesh geometry={wingGeo} position={[-0.2, -0.03, 0.3]} rotation={[0, 0, -0.15]}>
        <meshPhysicalMaterial
          color={col} metalness={0.85} roughness={0.2}
          clearcoat={0.8} emissive={col} emissiveIntensity={0.15}
        />
      </mesh>
      {/* Right delta wing — mirrored */}
      <mesh geometry={wingGeo} position={[0.2, -0.03, 0.3]} rotation={[0, 0, 0.15]} scale={[-1, 1, 1]}>
        <meshPhysicalMaterial
          color={col} metalness={0.85} roughness={0.2}
          clearcoat={0.8} emissive={col} emissiveIntensity={0.15}
        />
      </mesh>

      {/* Vertical stabilizer */}
      <mesh position={[0, 0.28, 1.0]}>
        <boxGeometry args={[0.02, 0.35, 0.6]} />
        <meshPhysicalMaterial color={col} metalness={0.8} roughness={0.25} emissive={col} emissiveIntensity={0.3} />
      </mesh>

      {/* Left engine pod */}
      <mesh position={[-0.38, -0.04, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 1.0, 8]} />
        <meshPhysicalMaterial color="#1a1a2e" metalness={0.95} roughness={0.05} emissive={col} emissiveIntensity={0.1} />
      </mesh>
      {/* Left engine nozzle ring */}
      <mesh position={[-0.38, -0.04, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.1, 0.02, 6, 12]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={2} />
      </mesh>

      {/* Right engine pod */}
      <mesh position={[0.38, -0.04, 0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 1.0, 8]} />
        <meshPhysicalMaterial color="#1a1a2e" metalness={0.95} roughness={0.05} emissive={col} emissiveIntensity={0.1} />
      </mesh>
      {/* Right engine nozzle ring */}
      <mesh position={[0.38, -0.04, 1.15]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.1, 0.02, 6, 12]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={2} />
      </mesh>

      {/* Central engine nozzle */}
      <mesh position={[0, 0, 1.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 0.2, 10]} />
        <meshStandardMaterial color="#0d0d1a" metalness={0.95} roughness={0.03} />
      </mesh>

      {/* Main exhaust — outer flame */}
      <mesh ref={exhaustRef} position={[0, 0, 1.9]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 2.0, 8]} />
        <meshBasicMaterial color={col} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Inner flame — white-hot core */}
      <mesh ref={exhaust2Ref} position={[0, 0, 1.65]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.06, 0.8, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Left nacelle exhaust */}
      <mesh position={[-0.38, -0.04, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.07, 0.8, 6]} />
        <meshBasicMaterial color={col} transparent opacity={raceStarted ? 0.35 : 0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Right nacelle exhaust */}
      <mesh position={[0.38, -0.04, 1.4]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.07, 0.8, 6]} />
        <meshBasicMaterial color={col} transparent opacity={raceStarted ? 0.35 : 0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Glow light */}
      <pointLight ref={glowRef} color={col} intensity={1.5} distance={8} decay={2} position={[0, 0, 1.5]} />
    </group>
  );
}

/* ═══════════════════════════════════════════
   Track — neon corridor with ShaderMaterial floor
   ═══════════════════════════════════════════ */
function RaceTrack({ laneCount }: { laneCount: number }) {
  const floorRef = useRef<THREE.Mesh>(null!);
  const trackWidth = laneCount * LANE_WIDTH + 2;
  const halfW = trackWidth / 2;

  const floorShader = useMemo(() => ({
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(NEON_CYAN) } },
    vertexShader: `
      varying vec2 vUv;
      varying float vDist;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 color;
      varying vec2 vUv;
      varying float vDist;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        float a = hash(i); float b = hash(i+vec2(1,0));
        float c = hash(i+vec2(0,1)); float d = hash(i+vec2(1,1));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
      }
      void main() {
        float scroll = time * 1.2;
        float y = fract(vUv.y * 30.0 + scroll);
        float line = smoothstep(0.0, 0.03, y) * (1.0 - smoothstep(0.05, 0.08, y));
        float chevron = step(0.47, abs(vUv.x - 0.5));
        float grid = smoothstep(0.0, 0.005, abs(fract(vUv.x * float(${laneCount})) - 0.5) - 0.49);
        float n = noise(vUv * 80.0 + time * 0.3) * 0.15;
        float dash = line * 0.4 + chevron * line * 0.55 + (1.0 - grid) * 0.1 + n * 0.08;
        float fade = 1.0 - smoothstep(5.0, 120.0, vDist) * 0.6;
        vec3 base = vec3(0.015, 0.008, 0.04);
        gl_FragColor = vec4((base + color * dash) * fade, 1.0);
      }
    `,
  }), [laneCount]);

  useFrame(() => {
    if (floorRef.current) {
      (floorRef.current.material as THREE.ShaderMaterial).uniforms.time.value = Date.now() * 0.001;
    }
  });

  const wallColor = new THREE.Color(NEON_CYAN);

  return (
    <>
      {/* Floor with scrolling shader */}
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, -TRACK_LENGTH / 2]}>
        <planeGeometry args={[trackWidth, TRACK_LENGTH, 1, 1]} />
        <shaderMaterial args={[floorShader]} />
      </mesh>

      {/* Left wall — translucent panel */}
      <mesh position={[-halfW, 1.2, -TRACK_LENGTH / 2]}>
        <boxGeometry args={[0.05, 3, TRACK_LENGTH]} />
        <meshStandardMaterial color="#0a0520" transparent opacity={0.3} />
      </mesh>
      {/* Left neon rail — bottom */}
      <mesh position={[-halfW, -0.2, -TRACK_LENGTH / 2]}>
        <boxGeometry args={[0.08, 0.08, TRACK_LENGTH]} />
        <meshStandardMaterial color={wallColor} emissive={wallColor} emissiveIntensity={2.5} />
      </mesh>
      {/* Left neon rail — top */}
      <mesh position={[-halfW, 2.7, -TRACK_LENGTH / 2]}>
        <boxGeometry args={[0.08, 0.08, TRACK_LENGTH]} />
        <meshStandardMaterial color={wallColor} emissive={wallColor} emissiveIntensity={2.0} />
      </mesh>

      {/* Right wall */}
      <mesh position={[halfW, 1.2, -TRACK_LENGTH / 2]}>
        <boxGeometry args={[0.05, 3, TRACK_LENGTH]} />
        <meshStandardMaterial color="#0a0520" transparent opacity={0.3} />
      </mesh>
      {/* Right neon rails */}
      <mesh position={[halfW, -0.2, -TRACK_LENGTH / 2]}>
        <boxGeometry args={[0.08, 0.08, TRACK_LENGTH]} />
        <meshStandardMaterial color={wallColor} emissive={wallColor} emissiveIntensity={2.5} />
      </mesh>
      <mesh position={[halfW, 2.7, -TRACK_LENGTH / 2]}>
        <boxGeometry args={[0.08, 0.08, TRACK_LENGTH]} />
        <meshStandardMaterial color={wallColor} emissive={wallColor} emissiveIntensity={2.0} />
      </mesh>

      {/* Overhead arcs every 15 units */}
      {Array.from({ length: 8 }).map((_, i) => {
        const z = -i * 15 - 5;
        return (
          <group key={`arc-${i}`} position={[0, 2.8, z]}>
            <mesh>
              <torusGeometry args={[halfW, 0.04, 6, 24, Math.PI]} />
              <meshStandardMaterial color={wallColor} emissive={wallColor} emissiveIntensity={1.8} />
            </mesh>
          </group>
        );
      })}

      {/* Lane dividers — emissive strips */}
      {Array.from({ length: laneCount - 1 }).map((_, i) => {
        const x = ((i + 1) - (laneCount) / 2) * LANE_WIDTH;
        return (
          <mesh key={`div-${i}`} position={[x, -0.28, -TRACK_LENGTH / 2]}>
            <boxGeometry args={[0.04, 0.02, TRACK_LENGTH]} />
            <meshStandardMaterial color={wallColor} emissive={wallColor} emissiveIntensity={1.5} transparent opacity={0.6} />
          </mesh>
        );
      })}

      {/* Start line */}
      <mesh position={[0, -0.15, 1]}>
        <boxGeometry args={[trackWidth, 0.3, 0.15]} />
        <meshStandardMaterial color="#7C3AED" emissive="#7C3AED" emissiveIntensity={2} />
      </mesh>
      {/* Start pillars */}
      <mesh position={[-halfW, 1, 1]}>
        <boxGeometry args={[0.15, 2.5, 0.15]} />
        <meshStandardMaterial color="#7C3AED" emissive="#7C3AED" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[halfW, 1, 1]}>
        <boxGeometry args={[0.15, 2.5, 0.15]} />
        <meshStandardMaterial color="#7C3AED" emissive="#7C3AED" emissiveIntensity={1.5} />
      </mesh>

      {/* Finish line */}
      <mesh position={[0, -0.15, -TRACK_LENGTH + 2]}>
        <boxGeometry args={[trackWidth + 0.5, 0.4, 0.2]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={2.5} />
      </mesh>
      {/* Finish gate */}
      <mesh position={[-halfW - 0.1, 1.3, -TRACK_LENGTH + 2]}>
        <boxGeometry args={[0.2, 3, 0.2]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={2} />
      </mesh>
      <mesh position={[halfW + 0.1, 1.3, -TRACK_LENGTH + 2]}>
        <boxGeometry args={[0.2, 3, 0.2]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 2.9, -TRACK_LENGTH + 2]}>
        <boxGeometry args={[trackWidth + 0.8, 0.15, 0.15]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={2.5} />
      </mesh>
    </>
  );
}

/* ═══════════════════════════════════════════
   Speed Streaks — InstancedMesh for performance
   ═══════════════════════════════════════════ */
function SpeedStreakLayer({ active, count, color, opacity, speedMul }: {
  active: boolean; count: number; color: string; opacity: number; speedMul: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const speeds = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) arr[i] = (0.25 + Math.random() * 0.75) * speedMul;
    return arr;
  }, [count, speedMul]);
  const positions = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      arr.push([
        (Math.random() - 0.5) * 16,
        Math.random() * 4 - 0.3,
        -Math.random() * TRACK_LENGTH,
      ]);
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (!meshRef.current || !active) return;
    for (let i = 0; i < count; i++) {
      positions[i][2] += speeds[i] * delta * 60;
      if (positions[i][2] > 5) {
        positions[i][2] = -TRACK_LENGTH - Math.random() * 20;
        positions[i][0] = (Math.random() - 0.5) * 16;
        positions[i][1] = Math.random() * 4 - 0.3;
      }
      dummy.position.set(positions[i][0], positions[i][1], positions[i][2]);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.012, 0.012, 0.9]} />
      <meshBasicMaterial
        color={color} transparent opacity={opacity}
        blending={THREE.AdditiveBlending} depthWrite={false}
      />
    </instancedMesh>
  );
}

function SpeedStreaks({ active }: { active: boolean }) {
  return (
    <>
      <SpeedStreakLayer active={active} count={180} color={NEON_CYAN} opacity={0.22} speedMul={1} />
      <SpeedStreakLayer active={active} count={120} color="#9C5AFF" opacity={0.15} speedMul={0.7} />
    </>
  );
}

/* ═══════════════════════════════════════════
   Camera Rig — intro fly-in + chase cam
   ═══════════════════════════════════════════ */
function CameraRig({
  progressRefs,
  oracles,
  phase,
  introStartTime,
}: {
  progressRefs: React.MutableRefObject<React.MutableRefObject<number>[]>;
  oracles: OracleResult[];
  phase: "intro" | "racing" | "results";
  introStartTime: number;
}) {
  const { camera } = useThree();
  const shakeX = useRef(new Spring(60, 7));
  const shakeY = useRef(new Spring(70, 8));
  const kickedRef = useRef(false);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = Date.now() * 0.001;

    if (phase === "intro") {
      const elapsed = Date.now() - introStartTime;
      const p = Math.min(elapsed / INTRO_DURATION, 1);
      const ease = 1 - Math.pow(1 - p, 3);

      const startX = 8, startY = 12, startZ = 18;
      const endX = 1.8, endY = 2.2, endZ = 10;

      camera.position.x = startX + (endX - startX) * ease;
      camera.position.y = startY + (endY - startY) * ease;
      camera.position.z = startZ + (endZ - startZ) * ease;

      const lookX = 0;
      const lookY = 0.6;
      const lookZ = -5 * ease;
      camera.lookAt(lookX, lookY, lookZ);
      return;
    }

    const pythIdx = oracles.findIndex((o) => o.name === "Pyth Network");
    const leadProgress = progressRefs.current.length > 0
      ? Math.max(...progressRefs.current.map((r) => r.current))
      : 0;
    const pythProgress = pythIdx >= 0 && progressRefs.current[pythIdx]
      ? progressRefs.current[pythIdx].current
      : leadProgress;

    const targetZ = -pythProgress * TRACK_LENGTH + 10;
    const targetY = 2.0 + leadProgress * 1.5;
    const targetX = 1.8;

    camera.position.x += (targetX - camera.position.x) * 0.03;
    camera.position.y += (targetY - camera.position.y) * 0.025;
    camera.position.z += (targetZ - camera.position.z) * 0.04;

    if (phase === "racing" && !kickedRef.current) {
      kickedRef.current = true;
      shakeX.current.kick(4);
      shakeY.current.kick(3);
    }

    if (phase === "racing" && leadProgress < 1) {
      shakeX.current.kick(Math.sin(t * 13) * 0.12);
      shakeY.current.kick(Math.cos(t * 17) * 0.08);
    }

    const sx = shakeX.current.update(dt);
    const sy = shakeY.current.update(dt);
    camera.position.x += sx * 0.05;
    camera.position.y += sy * 0.04;

    const lookZ = camera.position.z - 18 - leadProgress * 14;
    camera.lookAt(0, 0.5, lookZ);
  });

  return null;
}

/* ═══════════════════════════════════════════
   Main 3D Scene
   ═══════════════════════════════════════════ */
function RaceScene({
  oracles,
  phase,
  introStartTime,
  onRaceComplete,
  onProgressUpdate,
}: {
  oracles: OracleResult[];
  phase: "intro" | "racing" | "results";
  introStartTime: number;
  onRaceComplete: () => void;
  onProgressUpdate: (progresses: number[]) => void;
}) {
  const progressRefs = useRef<React.MutableRefObject<number>[]>([]);
  const startTimeRef = useRef(0);
  const completedRef = useRef(false);
  const lastUpdateRef = useRef(0);
  const startedRef = useRef(false);
  const maxLatency = useMemo(() => Math.max(...oracles.map((o) => o.latencyMs), 1), [oracles]);
  const raceStarted = phase === "racing" || phase === "results";

  if (progressRefs.current.length !== oracles.length) {
    progressRefs.current = oracles.map(() => ({ current: 0 }));
  }

  useEffect(() => {
    if (phase === "racing" && !startedRef.current) {
      startedRef.current = true;
      startTimeRef.current = Date.now();
      completedRef.current = false;
      progressRefs.current.forEach((r) => (r.current = 0));
    }
  }, [phase]);

  useFrame(() => {
    if (!startedRef.current || phase === "intro") return;
    const elapsed = Date.now() - startTimeRef.current;
    let allDone = true;
    const progresses: number[] = [];

    oracles.forEach((o, i) => {
      const finishAt = (o.latencyMs / maxLatency) * RACE_DURATION;
      const rawP = Math.min(elapsed / finishAt, 1);
      const burst = Math.sin(rawP * Math.PI * 3 + i * 1.5) * 0.02 * (1 - rawP);
      const eased = Math.min(1, (1 - Math.pow(1 - rawP, 3)) + burst);
      progressRefs.current[i].current = eased;
      progresses.push(eased);
      if (eased < 1) allDone = false;
    });

    const now = Date.now();
    if (now - lastUpdateRef.current > 100 || allDone) {
      lastUpdateRef.current = now;
      onProgressUpdate(progresses);
    }

    if (!completedRef.current && allDone) {
      completedRef.current = true;
      setTimeout(onRaceComplete, 800);
    }
  });

  const cyanColor = useMemo(() => new THREE.Color(NEON_CYAN), []);

  return (
    <>
      <ambientLight intensity={0.07} />
      <hemisphereLight color="#1a0a3e" groundColor="#000000" intensity={0.3} />
      <directionalLight position={[5, 12, 10]} intensity={0.5} color="#b0a0e0" />
      <directionalLight position={[-4, 6, -20]} intensity={0.35} color="#7C3AED" />
      <directionalLight position={[3, -1, 5]} intensity={0.18} color="#ff8060" />
      <directionalLight position={[0, 3, 5]} intensity={0.12} color="#ffffff" />

      <spotLight
        position={[0, 8, -TRACK_LENGTH + 2]}
        target-position={[0, 0, -TRACK_LENGTH + 2]}
        angle={0.4} penumbra={0.6} intensity={3.5}
        color="#FFD700" distance={35} decay={2}
      />

      {/* Start line spotlight — illuminates idle grid */}
      <spotLight
        position={[0, 6, 3]}
        target-position={[0, 0, 0]}
        angle={0.5} penumbra={0.8} intensity={phase === "intro" ? 2.5 : 0.5}
        color="#7142CF" distance={20} decay={2}
      />

      <Stars radius={150} depth={80} count={5000} factor={4.5} saturation={0.2} fade speed={0.4} />

      <fogExp2 attach="fog" args={["#08021a", 0.013]} />

      <CameraRig progressRefs={progressRefs} oracles={oracles} phase={phase} introStartTime={introStartTime} />
      <RaceTrack laneCount={oracles.length} />
      <SpeedStreaks active={raceStarted} />

      {oracles.map((o, i) => (
        <Spaceship
          key={o.name}
          lane={i}
          color={o.color}
          progressRef={progressRefs.current[i]}
          totalLanes={oracles.length}
          raceStarted={raceStarted}
        />
      ))}

      <pointLight position={[0, -0.5, -20]} color={cyanColor} intensity={0.4} distance={40} decay={2} />
      <pointLight position={[0, -0.5, -60]} color={cyanColor} intensity={0.3} distance={40} decay={2} />
      <pointLight position={[0, -0.5, -100]} color={cyanColor} intensity={0.2} distance={40} decay={2} />
    </>
  );
}

/* ═══════════════════════════════════════════
   Loading Scene — track + atmosphere while data loads
   ═══════════════════════════════════════════ */
function LoadingScene() {
  const { camera } = useThree();
  const startTime = useRef(Date.now());

  useFrame(() => {
    const elapsed = Date.now() - startTime.current;
    const t = elapsed * 0.001;
    const orbit = t * 0.15;
    camera.position.x = Math.sin(orbit) * 10;
    camera.position.y = 5 + Math.sin(t * 0.3) * 1;
    camera.position.z = Math.cos(orbit) * 10;
    camera.lookAt(0, 0.5, -15);
  });

  const cyanColor = useMemo(() => new THREE.Color(NEON_CYAN), []);

  return (
    <>
      <ambientLight intensity={0.07} />
      <hemisphereLight color="#1a0a3e" groundColor="#000000" intensity={0.3} />
      <directionalLight position={[5, 12, 10]} intensity={0.5} color="#b0a0e0" />
      <directionalLight position={[-4, 6, -20]} intensity={0.35} color="#7C3AED" />
      <Stars radius={150} depth={80} count={5000} factor={4.5} saturation={0.2} fade speed={0.4} />
      <fogExp2 attach="fog" args={["#08021a", 0.013]} />
      <RaceTrack laneCount={4} />
      <SpeedStreaks active={false} />
      <pointLight position={[0, -0.5, -20]} color={cyanColor} intensity={0.4} distance={40} decay={2} />
      <pointLight position={[0, -0.5, -60]} color={cyanColor} intensity={0.3} distance={40} decay={2} />
    </>
  );
}

/* ═══════════════════════════════════════════
   Racing HUD — minimal position strip
   ═══════════════════════════════════════════ */
function RacingHUD({
  oracles,
  progresses,
}: {
  oracles: OracleResult[];
  progresses: number[];
}) {
  const sorted = useMemo(() => {
    return oracles
      .map((o, i) => ({ ...o, progress: progresses[i] || 0, idx: i }))
      .sort((a, b) => b.progress - a.progress);
  }, [oracles, progresses]);

  return (
    <div
      className="absolute top-5 left-5 z-30 pointer-events-none flex items-center gap-0"
      style={{ fontFamily: FONT_SYNE }}
    >
      {sorted.map((o, pos) => {
        const done = o.progress >= 1;
        const isFirst = pos === 0;
        return (
          <div
            key={o.name}
            className="flex items-center gap-1.5 px-3 py-1.5"
            style={{
              background: isFirst ? "rgba(255,255,255,0.06)" : "transparent",
              borderRight: pos < sorted.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            <span
              style={{
                fontFamily: FONT_JB,
                fontSize: "9px",
                fontWeight: 700,
                color: isFirst ? o.color : "rgba(255,255,255,0.2)",
                letterSpacing: "0.05em",
              }}
            >
              P{pos + 1}
            </span>
            <OracleLogo name={o.name} size={14} color={o.color} />
            <span
              style={{
                fontFamily: FONT_SYNE,
                fontSize: "11px",
                fontWeight: 600,
                color: done ? "#FFD700" : isFirst ? "#fff" : "rgba(255,255,255,0.4)",
              }}
            >
              {o.name.replace(" Protocol", "").replace(" Network", "")}
            </span>
            {done && (
              <span
                style={{
                  fontFamily: FONT_JB,
                  fontSize: "9px",
                  fontWeight: 600,
                  color: "rgba(255,215,0,0.7)",
                }}
              >
                {o.latencyMs}ms
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main Export
   ═══════════════════════════════════════════ */
export default function OracleSpeedRace({
  onClose,
  inputSymbol,
  outputSymbol,
}: {
  onClose: () => void;
  inputSymbol: string;
  outputSymbol: string;
}) {
  const [oracles, setOracles] = useState<OracleResult[] | null>(null);
  const [phase, setPhase] = useState<"loading" | "intro" | "racing" | "results">("loading");
  const [progresses, setProgresses] = useState<number[]>([]);
  const [showFlash, setShowFlash] = useState(false);
  const [introStartTime, setIntroStartTime] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    runOracleRace().then((results) => {
      if (!cancelled) {
        setOracles(results);
        setIntroStartTime(Date.now());
        setPhase("intro");
        setTimeout(() => {
          if (!cancelled) setPhase("racing");
        }, INTRO_DURATION);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleRaceComplete = useCallback(() => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 400);
    setTimeout(() => setPhase("results"), 600);
  }, []);

  const handleProgressUpdate = useCallback((p: number[]) => setProgresses(p), []);

  useEffect(() => {
    const timer = setTimeout(onClose, 25000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const pythResult = oracles?.find((o) => o.name === "Pyth Network");
  const avgCompetitor =
    oracles && oracles.length > 1
      ? oracles.filter((o) => o.name !== "Pyth Network").reduce((s, o) => s + o.latencyMs, 0) / (oracles.length - 1)
      : 0;
  const speedMultiple = pythResult && avgCompetitor > 0 ? (avgCompetitor / pythResult.latencyMs).toFixed(1) : "?";
  const maxLatency = oracles ? Math.max(...oracles.map((o) => o.latencyMs), 1) : 1;
  const scenePhase = phase === "loading" ? "intro" : phase === "intro" ? "intro" : phase === "racing" ? "racing" : "results";

  return (
    <div className="fixed inset-0 z-9999" style={{ background: BG_COLOR }}>
      <style>{`
        @keyframes flashOut{0%{opacity:1}100%{opacity:0}}
        @keyframes termSlide{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rowIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
        @keyframes barGrow{from{width:0}to{width:var(--bar-w)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes goFlash{0%{opacity:0;transform:scale(2.5)}30%{opacity:1}100%{opacity:0;transform:scale(1)}}
      `}</style>

      {/* Close — subtle × */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 transition-opacity hover:opacity-100"
        style={{
          opacity: 0.3,
          color: "#fff",
          fontFamily: FONT_SYNE,
          fontSize: "18px",
          fontWeight: 300,
          lineHeight: 1,
          padding: "8px",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        <X size={16} strokeWidth={1.5} />
      </button>

      {/* Watermark — subtle top-right label */}
      <div
        className="absolute top-5 right-14 z-50 pointer-events-none"
        style={{
          fontFamily: FONT_SYNE,
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.2em",
          color: "rgba(255,255,255,0.12)",
          textTransform: "uppercase",
        }}
      >
        {inputSymbol}/{outputSymbol}
      </div>

      {/* Live Pyth Price — shown during intro/racing */}
      {pythResult?.price && (phase === "intro" || phase === "racing") && (
        <div
          className="absolute bottom-6 right-6 z-50 pointer-events-none"
          style={{ animation: "fadeIn 0.5s ease-out" }}
        >
          <div style={{
            fontFamily: FONT_JB, fontSize: "9px", fontWeight: 600,
            color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", marginBottom: "2px",
          }}>
            SOL/USD PYTH LIVE
          </div>
          <div style={{
            fontFamily: FONT_JB, fontSize: "22px", fontWeight: 700,
            color: "#7142CF", lineHeight: 1,
          }}>
            ${pythResult.price.toFixed(2)}
          </div>
          {pythResult.confidence && (
            <div style={{
              fontFamily: FONT_JB, fontSize: "9px", fontWeight: 500,
              color: "rgba(255,255,255,0.12)", marginTop: "2px",
            }}>
              ±${pythResult.confidence.toFixed(2)}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {phase === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center z-40">
          <div className="text-center">
            <div
              className="w-48 h-px mx-auto mb-5"
              style={{
                background: "linear-gradient(90deg, transparent, #7142CF, transparent)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <p style={{ fontFamily: FONT_SYNE, fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>
              Measuring oracle latency
            </p>
            <p style={{ fontFamily: FONT_JB, fontSize: "10px", color: "rgba(255,255,255,0.15)", marginTop: "6px" }}>
              Fetching SOL/USD from Pyth Hermes
            </p>
          </div>
        </div>
      )}

      {/* "GO" flash when intro ends and race starts */}
      {phase === "racing" && (
        <div
          className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
          style={{ animation: "goFlash 0.8s ease-out forwards" }}
        >
          <span style={{
            fontFamily: FONT_SYNE, fontSize: "5rem", fontWeight: 900,
            color: "#FFD700", textShadow: "0 0 40px #FFD700, 0 0 80px rgba(255,215,0,0.3)",
            letterSpacing: "0.2em",
          }}>
            GO
          </span>
        </div>
      )}

      {/* 3D Canvas — always mounted, shows track immediately */}
      <CanvasErrorBoundary
        fallback={
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="text-center p-6" style={{ background: "rgba(6,2,15,0.95)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <AlertTriangle size={20} className="mx-auto mb-3" style={{ color: "rgba(255,255,255,0.3)" }} />
              <p style={{ fontFamily: FONT_SYNE, fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>WebGL unavailable</p>
              {oracles && (
                <div className="mt-3" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {oracles.map((o) => (
                    <div key={o.name} className="flex items-center gap-2">
                      <OracleLogo name={o.name} size={14} color={o.color} />
                      <span style={{ fontFamily: FONT_SYNE, fontSize: "11px", fontWeight: 600, color: o.color }}>{o.name}</span>
                      <span style={{ fontFamily: FONT_JB, fontSize: "10px", color: "rgba(255,255,255,0.4)", marginLeft: "auto" }}>{o.latencyMs}ms</span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-4 transition-opacity hover:opacity-100"
                style={{ fontFamily: FONT_SYNE, fontSize: "10px", fontWeight: 600, color: "rgba(255,255,255,0.4)", background: "none", border: "1px solid rgba(255,255,255,0.08)", padding: "5px 14px", cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        }
      >
        <Canvas
          camera={{ position: [8, 12, 18], fov: 60 }}
          style={{ position: "absolute", inset: 0 }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.setClearColor(BG_COLOR);
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.5;
          }}
        >
          {oracles ? (
            <RaceScene
              oracles={oracles}
              phase={scenePhase}
              introStartTime={introStartTime}
              onRaceComplete={handleRaceComplete}
              onProgressUpdate={handleProgressUpdate}
            />
          ) : (
            <LoadingScene />
          )}
        </Canvas>

        {/* Racing HUD */}
        {oracles && (phase === "racing" || phase === "results") && (
          <RacingHUD oracles={oracles} progresses={progresses} />
        )}
      </CanvasErrorBoundary>

      {/* Finish flash */}
      {showFlash && (
        <div
          className="absolute inset-0 z-40 pointer-events-none"
          style={{ background: "rgba(255,215,0,0.12)", animation: "flashOut 0.4s ease-out forwards" }}
        />
      )}

      {/* Results — Race Terminal */}
      {phase === "results" && oracles && (
        <div
          className="absolute bottom-0 left-0 right-0 z-50"
          style={{
            background: "linear-gradient(180deg, transparent 0%, rgba(6,2,15,0.85) 30%, rgba(6,2,15,0.97) 100%)",
            animation: "termSlide 0.5s cubic-bezier(0.16,1,0.3,1)",
            padding: "40px 0 24px",
          }}
        >
          <div className="mx-auto" style={{ maxWidth: "620px", padding: "0 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {oracles.map((o, i) => {
                const isPyth = o.name === "Pyth Network";
                const barPct = Math.max(8, (o.latencyMs / maxLatency) * 100);
                return (
                  <div
                    key={o.name}
                    className="flex items-center"
                    style={{
                      padding: "10px 14px",
                      background: isPyth ? "rgba(113,66,207,0.08)" : "transparent",
                      borderLeft: isPyth ? "2px solid #7142CF" : "2px solid transparent",
                      animation: `rowIn 0.35s cubic-bezier(0.16,1,0.3,1) ${i * 80}ms both`,
                    }}
                  >
                    <span style={{
                      fontFamily: FONT_JB, fontSize: "10px", fontWeight: 700,
                      color: i === 0 ? "#FFD700" : "rgba(255,255,255,0.15)",
                      width: "24px", flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>

                    <div style={{ flexShrink: 0, marginRight: "10px" }}>
                      <OracleLogo name={o.name} size={18} color={o.color} />
                    </div>

                    <span style={{
                      fontFamily: FONT_SYNE, fontSize: "12px",
                      fontWeight: isPyth ? 700 : 500,
                      color: isPyth ? "#fff" : "rgba(255,255,255,0.4)",
                      width: "120px", flexShrink: 0,
                    }}>
                      {o.name}
                    </span>

                    <span style={{
                      fontFamily: FONT_JB, fontSize: "11px", fontWeight: 600,
                      color: isPyth ? "#fff" : "rgba(255,255,255,0.3)",
                      width: "60px", textAlign: "right", flexShrink: 0, marginRight: "14px",
                    }}>
                      {o.latencyMs}ms
                    </span>

                    <div className="flex-1 h-3 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${barPct}%`,
                          background: isPyth ? o.color : `${o.color}40`,
                          animation: `barGrow 0.8s cubic-bezier(0.16,1,0.3,1) ${i * 80 + 200}ms both`,
                          // @ts-expect-error CSS custom property
                          "--bar-w": `${barPct}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Context — why this matters for your swap */}
            <div
              className="mt-3 pt-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              <p style={{
                fontFamily: FONT_SYNE, fontSize: "10px", fontWeight: 500,
                color: "rgba(255,255,255,0.3)", lineHeight: 1.6, marginBottom: "10px",
              }}>
                Your {inputSymbol}/{outputSymbol} swap used Pyth price feeds to determine the fair exchange rate.
                Faster oracle updates mean your swap executes closer to the real-time market price,
                reducing slippage and protecting against stale pricing.
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span style={{
                    fontFamily: FONT_JB, fontSize: "20px", fontWeight: 700,
                    color: "#7142CF", lineHeight: 1,
                  }}>
                    {speedMultiple}×
                  </span>
                  <span style={{
                    fontFamily: FONT_SYNE, fontSize: "10px", fontWeight: 500,
                    color: "rgba(255,255,255,0.25)",
                  }}>
                    faster via Pyth
                  </span>
                  {pythResult?.price && (
                    <span style={{
                      fontFamily: FONT_JB, fontSize: "10px", fontWeight: 600,
                      color: "rgba(113,66,207,0.5)",
                    }}>
                      SOL ${pythResult.price.toFixed(2)}
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="transition-all hover:opacity-100"
                  style={{
                    fontFamily: FONT_SYNE, fontSize: "10px", fontWeight: 600,
                    color: "rgba(255,255,255,0.35)",
                    background: "none", border: "1px solid rgba(255,255,255,0.06)",
                    padding: "5px 16px", cursor: "pointer", opacity: 0.7,
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
