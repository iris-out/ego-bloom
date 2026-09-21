const VENT_BARS = [-1, 0, 1];
const FIGURE_SKIN = '#b8755d';
const FIGURE_SUIT = '#26343a';
const FIGURE_HELMET = '#394b52';
const DEFAULT_ROTATION = [0, 0, 0];

/** Thin, static exterior cues. Keep these below the silhouette and collision envelope. */
export function PanelSeam({ position, scale, rotation = DEFAULT_ROTATION, color = '#30383b' }) {
  return <mesh position={position} scale={scale} rotation={rotation} castShadow={false}>
    <boxGeometry />
    <meshStandardMaterial color={color} roughness={0.75} />
  </mesh>;
}

export function SurfaceVent({ position, scale = [0.32, 0.025, 0.08], rotation = DEFAULT_ROTATION, color = '#252c2f' }) {
  return <group position={position} rotation={rotation}>
    {VENT_BARS.map((offset) => <PanelSeam key={offset} position={[offset * scale[0] * 0.34, 0, 0]} scale={[scale[0] * 0.16, scale[1], scale[2]]} color={color} />)}
  </group>;
}

export function DetailLamp({ position, color, scale = 0.06 }) {
  return <mesh position={position}>
    <sphereGeometry args={[scale, 8, 6]} />
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} roughness={0.35} />
  </mesh>;
}

export function DriverFigure({ position = [0, 0, 0] }) {
  return <group position={position}>
    <mesh position={[0, 0.22, 0]} castShadow>
      <boxGeometry args={[0.28, 0.42, 0.2]} />
      <meshStandardMaterial color={FIGURE_SUIT} roughness={0.85} />
    </mesh>
    <mesh position={[0, 0.53, 0]} castShadow>
      <sphereGeometry args={[0.13, 10, 8]} />
      <meshStandardMaterial color={FIGURE_SKIN} roughness={0.9} />
    </mesh>
    <mesh position={[0, 0.6, 0]}>
      <sphereGeometry args={[0.145, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
      <meshStandardMaterial color={FIGURE_HELMET} roughness={0.6} />
    </mesh>
    <mesh position={[-0.15, 0.28, -0.02]} rotation={[0, 0, -0.45]}>
      <cylinderGeometry args={[0.035, 0.035, 0.36, 6]} />
      <meshStandardMaterial color={FIGURE_SUIT} roughness={0.85} />
    </mesh>
    <mesh position={[0.15, 0.28, -0.02]} rotation={[0, 0, 0.45]}>
      <cylinderGeometry args={[0.035, 0.035, 0.36, 6]} />
      <meshStandardMaterial color={FIGURE_SUIT} roughness={0.85} />
    </mesh>
  </group>;
}

export function RiderFigure({ position = [0, 0, 0] }) {
  return <group position={position}>
    <mesh position={[0, 0.22, 0]} castShadow>
      <boxGeometry args={[0.24, 0.38, 0.18]} />
      <meshStandardMaterial color={FIGURE_SUIT} roughness={0.8} />
    </mesh>
    <mesh position={[0, 0.5, 0]} castShadow>
      <sphereGeometry args={[0.125, 10, 8]} />
      <meshStandardMaterial color={FIGURE_HELMET} roughness={0.55} />
    </mesh>
    <mesh position={[0, 0.5, -0.1]} scale={[0.8, 0.35, 0.75]}>
      <sphereGeometry args={[0.12, 10, 6]} />
      <meshStandardMaterial color={FIGURE_HELMET} roughness={0.55} />
    </mesh>
    <mesh position={[-0.13, 0.28, -0.12]} rotation={[0.45, 0, -0.55]}>
      <cylinderGeometry args={[0.03, 0.03, 0.38, 6]} />
      <meshStandardMaterial color={FIGURE_SUIT} roughness={0.8} />
    </mesh>
    <mesh position={[0.13, 0.28, -0.12]} rotation={[0.45, 0, 0.55]}>
      <cylinderGeometry args={[0.03, 0.03, 0.38, 6]} />
      <meshStandardMaterial color={FIGURE_SUIT} roughness={0.8} />
    </mesh>
  </group>;
}
