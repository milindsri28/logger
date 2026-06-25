'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

interface NodeDef {
  id: string;
  label: string;
  position: [number, number, number];
  color: string;
  type: 'log' | 'commit' | 'container' | 'incident' | 'infra';
}

const NODES: NodeDef[] = [
  { id: 'incident', label: 'INCIDENT', position: [0, 0, 0], color: '#ef4444', type: 'incident' },
  { id: 'log1', label: 'LOG', position: [-2.5, 1.2, 0.5], color: '#f97316', type: 'log' },
  { id: 'log2', label: 'LOG', position: [-2, -1, 1], color: '#f97316', type: 'log' },
  { id: 'log3', label: 'LOG', position: [-1.5, 0.5, -1.5], color: '#f97316', type: 'log' },
  { id: 'commit1', label: 'COMMIT', position: [2, 1.5, -0.5], color: '#22c55e', type: 'commit' },
  { id: 'commit2', label: 'COMMIT', position: [2.5, -0.5, 1], color: '#22c55e', type: 'commit' },
  { id: 'container1', label: 'DOCKER', position: [0, 2, 1.5], color: '#3b82f6', type: 'container' },
  { id: 'container2', label: 'DOCKER', position: [1, -2, -1], color: '#3b82f6', type: 'container' },
  { id: 'infra1', label: 'NODE', position: [-1, -2, 0], color: '#a78bfa', type: 'infra' },
  { id: 'infra2', label: 'NODE', position: [1.5, 0, 2], color: '#a78bfa', type: 'infra' },
];

const EDGES: [string, string][] = [
  ['log1', 'incident'],
  ['log2', 'incident'],
  ['log3', 'incident'],
  ['commit1', 'incident'],
  ['commit2', 'incident'],
  ['container1', 'incident'],
  ['container2', 'incident'],
  ['infra1', 'incident'],
  ['infra2', 'incident'],
  ['log1', 'commit1'],
  ['log2', 'container1'],
  ['commit2', 'container2'],
  ['infra1', 'container2'],
  ['infra2', 'container1'],
];

function GraphNode({ node, pulse }: { node: NodeDef; pulse: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const isCenter = node.type === 'incident';

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const scale = isCenter ? 1 + Math.sin(t * 2) * 0.08 : 1 + Math.sin(t * 3 + pulse) * 0.05;
    ref.current.scale.setScalar(scale);
  });

  return (
    <group position={node.position}>
      <mesh ref={ref}>
        {isCenter ? (
          <octahedronGeometry args={[0.35, 0]} />
        ) : node.type === 'container' ? (
          <boxGeometry args={[0.4, 0.4, 0.4]} />
        ) : node.type === 'commit' ? (
          <boxGeometry args={[0.5, 0.2, 0.15]} />
        ) : (
          <sphereGeometry args={[0.2, 16, 16]} />
        )}
        <meshStandardMaterial
          color={node.color}
          emissive={node.color}
          emissiveIntensity={isCenter ? 0.8 : 0.4}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
      {isCenter && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.55, 32]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function AnimatedEdge({ from, to, progress }: { from: [number, number, number]; to: [number, number, number]; progress: number }) {
  const mid: [number, number, number] = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2 + 0.3,
    (from[2] + to[2]) / 2,
  ];

  const points = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...from),
      new THREE.Vector3(...mid),
      new THREE.Vector3(...to),
    );
    return curve.getPoints(24).map((p) => [p.x, p.y, p.z] as [number, number, number]);
  }, [from, to, mid]);

  const visiblePoints = useMemo(() => {
    const count = Math.max(2, Math.floor(points.length * progress));
    return points.slice(0, count);
  }, [points, progress]);

  if (visiblePoints.length < 2) return null;

  return (
    <Line
      points={visiblePoints}
      color="#6366f1"
      lineWidth={1}
      transparent
      opacity={0.6}
    />
  );
}

function GraphScene({ edgeProgress }: { edgeProgress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const nodeMap = useMemo(() => Object.fromEntries(NODES.map((n) => [n.id, n])), []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {EDGES.map(([a, b], i) => (
        <AnimatedEdge
          key={`${a}-${b}`}
          from={nodeMap[a].position}
          to={nodeMap[b].position}
          progress={Math.min(1, edgeProgress - i * 0.05)}
        />
      ))}
      {NODES.map((node, i) => (
        <GraphNode key={node.id} node={node} pulse={i} />
      ))}
    </group>
  );
}

export function InvestigationGraph({ progress = 1 }: { progress?: number }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 3]} intensity={1} color="#818cf8" />
      <GraphScene edgeProgress={progress} />
    </Canvas>
  );
}
