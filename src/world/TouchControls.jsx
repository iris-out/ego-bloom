import { useRef, useState } from 'react';

function Stick({label,onMove}) {
  const pointer=useRef(null);
  const [position,setPosition]=useState({x:0,y:0});
  const update=e=>{
    const r=e.currentTarget.getBoundingClientRect();
    const x=(e.clientX-r.left-r.width/2)/28, y=(e.clientY-r.top-r.height/2)/28;
    const scale=Math.max(1,Math.hypot(x,y));
    setPosition({x:x/scale,y:y/scale}); onMove(x/scale,-y/scale);
  };
  const end=()=>{pointer.current=null;setPosition({x:0,y:0});onMove(0,0);};
  return <div className="world-stick-wrap"><span>{label}</span><div className="world-stick" role="group" aria-label={`${label} 조이스틱`}
    onPointerDown={e=>{pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);update(e);}}
    onPointerMove={e=>{if(pointer.current===e.pointerId)update(e);}}
    onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
    <div style={{transform:`translate(${position.x*28}px, ${position.y*28}px)`}} />
  </div></div>;
}

export default function TouchControls({onMove,onRotate,onVertical}) {
  return <div className="world-touch-controls">
    <Stick label="이동" onMove={onMove} />
    <div className="world-height-controls">{[1,-1].map(value=><button key={value} aria-label={value===1?'카메라 높이 올리기':'카메라 높이 내리기'}
      onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);onVertical(value);}}
      onPointerUp={()=>{onVertical(0);}} onPointerCancel={()=>{onVertical(0);}} onLostPointerCapture={()=>{onVertical(0);}}>{value===1?'↑':'↓'}</button>)}</div>
    <Stick label="회전" onMove={onRotate} />
  </div>;
}
