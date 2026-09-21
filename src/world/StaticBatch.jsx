import { useLayoutEffect, useRef } from 'react';
import { mergeStatic } from './staticBatch.js';

/** 감싼 자식 중 움직이지 않는 mesh 를 재질별로 합쳐 그린다. 바늘이나 반동처럼 움직이는 가지는
 * userData={{ dynamic: true }} 를 단 group 으로 감싸 빼 둔다. version 이 바뀌면 다시 합친다.
 * 자식의 모양이나 재질 속성이 렌더마다 바뀌는 곳은 감싸지 않는다. 합친 뒤의 변경은 반영되지 않는다. */
export default function StaticBatch({ children, enabled = true, version = 0 }) {
  const root = useRef();
  useLayoutEffect(() => {
    const group = root.current;
    if (!enabled || !group) return undefined;
    const { merged, hidden } = mergeStatic(group);
    for (const mesh of merged) group.add(mesh);
    return () => {
      for (const mesh of merged) { group.remove(mesh); mesh.geometry.dispose(); }
      for (const original of hidden) original.visible = true;
    };
  }, [enabled, version]);
  return <group ref={root}>{children}</group>;
}
