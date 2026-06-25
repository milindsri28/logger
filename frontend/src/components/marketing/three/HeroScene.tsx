'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Stars } from '@react-three/drei';
import * as THREE from 'three';

const LOG_LINES = [
  'ERROR connection refused',
  'WARN retry attempt 3',
  'FATAL OOM killed',
  'DEBUG timeout 30s',
  'ERROR 500 internal',
  'panic: nil pointer',
  'segfault at 0x0',
  'OOMKilled pod/api',
];

const COMMITS = ['a3f9c2d', '8b1e4f0', 'c7d2a91', 'f4e8b33', '1a9d7c5', 'e2b6f88'];

function InvestigationCore() {
  const ref = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.x = t * 0.15;
      ref.current.rotation.y = t * 0.22;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.4;
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.5) * 0.1;
    }
  });

  return (
    <group>
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.55, 1]} />
        <MeshDistortMaterial
          color="#6366f1"
          emissive="#4338ca"
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.8}
          distort={0.35}
          speed={2}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[0.85, 0.02, 16, 64]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.1, 0.015, 16, 64]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.25} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={2} color="#6366f1" distance={4} />
    </group>
  );
}

function FlowingElements() {
  const groupRef = useRef<THREE.Group>(null);
  const count = 48;

  const elements = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const type = i % 4;
      const angle = (i / count) * Math.PI * 2;
      const radius = 3.5 + Math.random() * 4;
      return {
        type,
        angle,
        radius,
        speed: 0.15 + Math.random() * 0.25,
        offset: Math.random() * Math.PI * 2,
        y: (Math.random() - 0.5) * 3,
        scale: 0.08 + Math.random() * 0.12,
        label: type === 0 ? LOG_LINES[i % LOG_LINES.length] : type === 1 ? COMMITS[i % COMMITS.length] : '',
      };
    });
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    groupRef.current.children.forEach((child, i) => {
      const el = elements[i];
      const spiral = el.angle + t * el.speed + el.offset;
      const r = el.radius * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.3 + el.offset)));
      child.position.x = Math.cos(spiral) * r;
      child.position.z = Math.sin(spiral) * r;
      child.position.y = el.y + Math.sin(t * 0.5 + el.offset) * 0.4;
      child.lookAt(0, child.position.y * 0.3, 0);
    });
  });

  return (
    <group ref={groupRef}>
      {elements.map((el, i) => (
        <group key={i} scale={el.scale * 3}>
          {el.type === 0 && (
            <mesh>
              <planeGeometry args={[2.2, 0.35]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.7} side={THREE.DoubleSide} />
            </mesh>
          )}
          {el.type === 1 && (
            <mesh>
              <boxGeometry args={[0.8, 0.25, 0.05]} />
              <meshStandardMaterial color="#22c55e" emissive="#166534" emissiveIntensity={0.3} metalness={0.5} />
            </mesh>
          )}
          {el.type === 2 && (
            <mesh>
              <boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.4} metalness={0.6} roughness={0.3} />
            </mesh>
          )}
          {el.type === 3 && (
            <mesh>
              <octahedronGeometry args={[0.35]} />
              <meshStandardMaterial color="#a78bfa" emissive="#6d28d9" emissiveIntensity={0.5} wireframe />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function ParticleField() {
  const ref = useRef<THREE.Points>(null);
  const count = 800;

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 20;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.02;
    const pos = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const dx = -pos[idx] * 0.002;
      const dz = -pos[idx + 2] * 0.002;
      pos[idx] += dx;
      pos[idx + 2] += dz;
      const dist = Math.sqrt(pos[idx] ** 2 + pos[idx + 2] ** 2);
      if (dist < 0.5) {
        pos[idx] = (Math.random() - 0.5) * 20;
        pos[idx + 2] = (Math.random() - 0.5) * 20;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#6366f1" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

function Scene() {
  return (
    <>
      <color attach="background" args={['#050506']} />
      <fog attach="fog" args={['#050506', 6, 18]} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 5, 5]} intensity={0.4} color="#e0e7ff" />
      <Stars radius={80} depth={40} count={2000} factor={3} saturation={0} fade speed={0.5} />
      <ParticleField />
      <FlowingElements />
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
        <InvestigationCore />
      </Float>
    </>
  );
}

export function HeroScene() {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 1.5, 7], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        <Scene />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050506]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#050506_75%)]" />
    </div>
  );
}
