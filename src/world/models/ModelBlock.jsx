/** Unit-box primitive for the airport and jet. position is the center;
 * scale is full XYZ size in city units. Instanced city batches use a separate path.
 */
export default function ModelBlock({ position, scale, color = '#e3dece', ...props }) {
  return <mesh position={position} scale={scale} castShadow receiveShadow {...props}><boxGeometry /><meshStandardMaterial color={color} roughness={0.8} /></mesh>;
}

