"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

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
  uniform sampler2D uTexture2;
  uniform float uProgress;
  uniform float uIntensity;
  uniform float uTexAspect;
  uniform float uTexAspect2;
  uniform float uViewAspect;
  varying vec2 vUv;

  vec2 coverUv(vec2 uv, float texA, float viewA) {
    vec2 s = vec2(1.0);
    if (viewA > texA) { s.y = texA / viewA; } else { s.x = viewA / texA; }
    return (uv - 0.5) * s + 0.5;
  }

  void main() {
    float p = smoothstep(0.0, 1.0, uProgress);
    vec2 wave = vec2(
      sin((vUv.y + p * 0.35) * 18.0) * 0.025,
      cos((vUv.x - p * 0.25) * 14.0) * 0.012
    ) * uIntensity;
    vec2 uv1 = coverUv(vUv + wave * p, uTexAspect, uViewAspect);
    vec2 uv2 = coverUv(vUv - wave * (1.0 - p), uTexAspect2, uViewAspect);
    vec4 a = texture2D(uTexture, clamp(uv1, 0.0, 1.0));
    vec4 b = texture2D(uTexture2, clamp(uv2, 0.0, 1.0));
    gl_FragColor = mix(a, b, p);
  }
`;

function DistortionPlane({
  primarySrc,
  secondarySrc,
  active,
  onReady,
}: {
  primarySrc: string;
  secondarySrc: string;
  active: boolean;
  onReady: () => void;
}) {
  const [primary, secondary] = useLoader(THREE.TextureLoader, [primarySrc, secondarySrc]);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const progress = useRef(0);
  const ready = useRef(false);
  const { viewport, size } = useThree();

  useEffect(() => {
    for (const texture of [primary, secondary]) {
      // Match the app's existing distortion canvas: avoid shader-darkened photos.
      texture.colorSpace = THREE.LinearSRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    }
  }, [primary, secondary]);

  const primaryImage = primary.image as { width?: number; height?: number } | undefined;
  const secondaryImage = secondary.image as { width?: number; height?: number } | undefined;
  const primaryAspect =
    primaryImage?.width && primaryImage.height ? primaryImage.width / primaryImage.height : 1;
  const secondaryAspect =
    secondaryImage?.width && secondaryImage.height
      ? secondaryImage.width / secondaryImage.height
      : primaryAspect;

  const uniforms = useMemo(
    () => ({
      uTexture: { value: primary },
      uTexture2: { value: secondary },
      uProgress: { value: 0 },
      uIntensity: { value: 0.95 },
      uTexAspect: { value: primaryAspect },
      uTexAspect2: { value: secondaryAspect },
      uViewAspect: { value: 1 },
    }),
    [primary, primaryAspect, secondary, secondaryAspect],
  );

  useFrame(() => {
    progress.current += ((active ? 1 : 0) - progress.current) * 0.08;
    if (matRef.current) {
      matRef.current.uniforms.uProgress.value = progress.current;
      matRef.current.uniforms.uViewAspect.value = size.width / Math.max(1, size.height);
    }
    if (!ready.current) {
      ready.current = true;
      onReady();
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

export function PortfolioDistortionImage({
  primarySrc,
  secondarySrc,
}: {
  primarySrc?: string | null;
  secondarySrc?: string | null;
}) {
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  if (!primarySrc || !secondarySrc || primarySrc === secondarySrc || reduced) return null;

  return (
    <div
      className={`portfolio-distortion-overlay${ready ? " is-ready" : ""}`}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      onPointerDown={() => setActive((value) => !value)}
      aria-hidden="true"
    >
      <Canvas
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Suspense fallback={null}>
          <DistortionPlane
            primarySrc={primarySrc}
            secondarySrc={secondarySrc}
            active={active}
            onReady={() => setReady(true)}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
