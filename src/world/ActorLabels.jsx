import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { trafficFrame } from './traffic.js';
import { airTrafficPose } from './airTraffic.js';
import { hitsAnyBuilding } from './solidIndex.js';
import { actorLabelVisible } from './actorLabels.js';
import './ui/worldScores.css';
const CAP = 16;
/** A fixed DOM pool reads the exact traffic frame and air poses used by the models. */
export default function ActorLabels({ extent, trafficCount, airCount, hiddenRef, airCombatRef, buildings }) {
  const nodes = useRef([]), last = useRef(-1), point = useRef(new Vector3());
  useFrame(({ camera, clock, size }) => {
    if (clock.elapsedTime - last.current < .1) return;
    last.current = clock.elapsedTime;
    const candidates = [];
    const consider = (x, y, z, label, maxDistance) => {
      const position = { x, y, z };
      const distance = camera.position.distanceTo(point.current.set(x, y, z));
      point.current.project(camera);
      if (!actorLabelVisible(point.current, distance, maxDistance)) return;
      candidates.push({ position, distance, label, x: (point.current.x + 1) * size.width / 2, y: (1 - point.current.y) * size.height / 2 });
    };
    const traffic = trafficFrame(trafficCount, clock.elapsedTime, extent);
    for (let i = 0; i < traffic.count; i++) if (!hiddenRef.current.has(i)) consider(traffic.x[i], traffic.y[i] + (traffic.truck[i] ? 4 : 2.5), traffic.z[i], traffic.truck[i] ? '트럭' : '차량', 190);
    for (let i = 0; i < airCount; i++) if (!airCombatRef.current.downed.has(i)) {
      const pose = airTrafficPose(i, clock.elapsedTime, extent);
      consider(pose.x, pose.y + 7, pose.z, pose.label, 550);
    }
    candidates.sort((a, b) => a.distance - b.distance);
    let used = 0;
    for (const candidate of candidates) {
      if (used >= CAP) break;
      if (hitsAnyBuilding(camera.position, candidate.position, buildings, null, { margin: 0, roofMargin: 0 })) continue;
      const node = nodes.current[used++];
      if (!node) continue;
      node.style.display = 'block'; node.style.left = `${candidate.x}px`; node.style.top = `${candidate.y}px`;
      node.textContent = `◆ AI · ${candidate.label} · ${Math.round(candidate.distance)}m`;
    }
    for (let i = used; i < CAP; i++) if (nodes.current[i]) nodes.current[i].style.display = 'none';
  });
  return <Html fullscreen zIndexRange={[14, 1]} style={{ pointerEvents: 'none' }}><div className="actor-label-layer" aria-hidden="true">{Array.from({ length: CAP }, (_, i) => <span key={i} className="actor-ai-label" ref={node => { nodes.current[i] = node; }} />)}</div></Html>;
}
