"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

// A subtle WebGL depth-of-field + parallax treatment over a hero image. Loaded
// lazily and only when the enhancement gate passes (see feature.ts). The static
// <picture> underneath remains the LCP and the full fallback.

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
  uniform vec2 uMouse;
  uniform float uTexAspect;
  uniform float uViewAspect;
  varying vec2 vUv;

  // Map uv so the texture covers the viewport (object-fit: cover).
  vec2 coverUv(vec2 uv, float texA, float viewA) {
    vec2 s = vec2(1.0);
    if (viewA > texA) { s.y = texA / viewA; } else { s.x = viewA / texA; }
    return (uv - 0.5) * s + 0.5;
  }

  void main() {
    vec2 uv = coverUv(vUv, uTexAspect, uViewAspect);
    // Gentle parallax toward the pointer.
    uv += uMouse * 0.010;

    // Focal point drifts with the pointer; sharpness falls off with distance.
    vec2 focal = vec2(0.5) + uMouse * 0.22;
    float dist = distance(uv, focal);
    float blur = (smoothstep(0.10, 0.70, dist) * 0.0045 + 0.0012)
               * (0.85 + 0.15 * sin(uTime * 0.4));

    vec2 disk[12];
    disk[0]=vec2(0.0,0.0);  disk[1]=vec2(0.7,0.2);   disk[2]=vec2(-0.6,0.5);
    disk[3]=vec2(0.3,-0.8); disk[4]=vec2(-0.4,-0.6); disk[5]=vec2(0.9,-0.3);
    disk[6]=vec2(-0.9,-0.1);disk[7]=vec2(0.1,0.95);  disk[8]=vec2(0.5,0.6);
    disk[9]=vec2(-0.2,-0.9);disk[10]=vec2(-0.7,0.7); disk[11]=vec2(0.6,-0.6);

    vec3 col = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      vec2 off = disk[i] * blur * vec2(1.0, uViewAspect);
      col += texture2D(uTexture, clamp(uv + off, 0.0, 1.0)).rgb;
    }
    col /= 12.0;

    float vig = smoothstep(1.15, 0.35, distance(vUv, vec2(0.5)));
    col *= mix(0.92, 1.0, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function CoverPlane({ src, onReady }: { src: string; onReady?: () => void }) {
  const texture = useLoader(THREE.TextureLoader, src);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { viewport, size } = useThree();
  const pointer = useRef(new THREE.Vector2(0, 0));
  const targetPointer = useRef(new THREE.Vector2(0, 0));
  const announced = useRef(false);

  useEffect(() => {
    // LinearSRGBColorSpace (not SRGB): keeps the upload as RGBA8 so the GPU does
    // NOT decode sRGB->linear on sample. This custom shader has no output
    // re-encode, so an SRGB8 texture would render darker than the static <img>.
    texture.colorSpace = THREE.LinearSRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  }, [texture]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      targetPointer.current.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1),
      );
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
      uTexAspect: { value: texAspect },
      uViewAspect: { value: 1 },
    }),
    [texture, texAspect],
  );

  useFrame((state) => {
    pointer.current.lerp(targetPointer.current, 0.05);
    if (matRef.current) {
      const u = matRef.current.uniforms;
      u.uTime.value = state.clock.elapsedTime;
      u.uMouse.value.copy(pointer.current);
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

export default function HeroCanvas({
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
        <CoverPlane src={src} onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
