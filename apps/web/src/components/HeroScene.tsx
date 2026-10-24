
"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  Float,
  MeshDistortMaterial,
} from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function FloatingObjects() {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current) return;

    group.current.rotation.y += delta * 0.12;
    group.current.rotation.x =
      Math.sin(state.clock.elapsedTime * 0.35) * 0.04;
  });

  return (
    <group ref={group} scale={0.82} position={[0, 0.15, 0]}>
      {/* Main electric-lime cube */}
      <Float speed={1.3} rotationIntensity={0.15} floatIntensity={0.35}>
        <mesh position={[0.15, 0.05, 0]}>
          <boxGeometry args={[1.45, 1.45, 1.45]} />
          <meshStandardMaterial
            color="#b9ff39"
            metalness={0.45}
            roughness={0.28}
          />
        </mesh>
      </Float>

      {/* Floating metallic ring */}
      <Float speed={1.6} rotationIntensity={0.25} floatIntensity={0.45}>
        <mesh position={[-1.25, 0.85, 0.2]} scale={0.48}>
          <torusGeometry args={[0.8, 0.24, 24, 80]} />
          <meshStandardMaterial
            color="#e6ffb7"
            metalness={0.75}
            roughness={0.22}
          />
        </mesh>
      </Float>

      {/* Glossy green sphere */}
      <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.4}>
        <mesh position={[1.1, -0.85, 0.35]} scale={0.43}>
          <sphereGeometry args={[1, 48, 48]} />
          <MeshDistortMaterial
            color="#72a51c"
            metalness={0.65}
            roughness={0.24}
            distort={0.18}
            speed={1.5}
          />
        </mesh>
      </Float>

      {/* Smaller circular display platform */}
      <mesh position={[0, -1.55, -0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.8, 64]} />
        <meshStandardMaterial
          color="#172013"
          metalness={0.45}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

export default function HeroScene() {
  return (
    <div className="hero-scene" aria-label="Animated 3D MINX objects">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.1} />

        <directionalLight position={[4, 5, 5]} intensity={2.5} />

        <pointLight
          position={[-4, 1, 2]}
          color="#b9ff39"
          intensity={20}
        />

        <pointLight
          position={[3, -2, 3]}
          color="#7b9c52"
          intensity={8}
        />

        <FloatingObjects />

        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
