"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

// HTML→WebGL "distortion" banner treatment: the image is sampled into a plane
// and rippled by pointer motion, with a subtle chromatic split. The static
// <picture> underneath stays the LCP + complete fallback (see HeroMedia).

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec2 uMouse;       // -1..1
  uniform float uStrength;   // pointer velocity magnitude (0..1)
  uniform float uTexAspect;
  uniform float uViewAspect;
  varying vec2 vUv;

  vec2 coverUv(vec2 uv, float texA, float viewA) {
    vec2 s = vec2(1.0);
    if (viewA > texA) { s.y = texA / viewA; } else { s.x = viewA / texA; }
    return (uv - 0.5) * s + 0.5;
  }

  void main() {
    vec2 uv = coverUv(vUv, uTexAspect, uViewAspect);

    // Ripple emanating from the pointer; amplitude scales with velocity.
    vec2 focal = vec2(0.5) + uMouse * 0.5;
    float d = distance(uv, focal);
    float wave = sin(d * 22.0 - uTime * 2.2) * 0.012 * (0.25 + uStrength);
    vec2 dir = normalize(uv - focal + 1e-4);
    vec2 disp = dir * wave;

    // Chromatic split grows with velocity.
    float ca = 0.004 * (0.3 + uStrength);
    float r = texture2D(uTexture, clamp(uv + disp + vec2(ca, 0.0), 0.0, 1.0)).r;
    float g = texture2D(uTexture, clamp(uv + disp, 0.0, 1.0)).g;
    float b = texture2D(uTexture, clamp(uv + disp - vec2(ca, 0.0), 0.0, 1.0)).b;

    vec3 col = vec3(r, g, b);
    float vig = smoothstep(1.2, 0.35, distance(vUv, vec2(0.5)));
    col *= mix(0.9, 1.0, vig);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function DistortPlane({ src, onReady }: { src: string; onReady?: () => void }) {
  const texture = useLoader(THREE.TextureLoader, src);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport, size } = useThree();
  const pointer = useRef(new THREE.Vector2(0, 0));
  const target = useRef(new THREE.Vector2(0, 0));
  const last = useRef(new THREE.Vector2(0, 0));
  const velocity = useRef(0);
  const announced = useRef(false);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  }, [texture]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      velocity.current = Math.min(
        1,
        velocity.current + Math.hypot(x - last.current.x, y - last.current.y) * 3,
      );
      last.current.set(x, y);
      target.current.set(x, y);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const img = texture.image as { width: number; height: number } | undefined;
  const texAspect = img && img.height ? img.width / img.height : 1;

  const uniforms = useMemo(
    () => ({
      uTexture: { value: texture },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uStrength: { value: 0 },
      uTexAspect: { value: texAspect },
      uViewAspect: { value: 1 },
    }),
    [texture, texAspect],
  );

  useFrame((state) => {
    pointer.current.lerp(target.current, 0.08);
    velocity.current *= 0.92; // decay
    if (matRef.current) {
      const u = matRef.current.uniforms;
      u.uTime.value = state.clock.elapsedTime;
      u.uMouse.value.copy(pointer.current);
      u.uStrength.value = velocity.current;
      u.uViewAspect.value = size.width / Math.max(1, size.height);
    }
    if (!announced.current) {
      announced.current = true;
      onReady?.();
    }
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}

export default function DistortionCanvas({
  src,
  onReady,
}: {
  src: string;
  onReady?: () => void;
}) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 1], zoom: 1 }}
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Suspense fallback={null}>
        <DistortPlane src={src} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
