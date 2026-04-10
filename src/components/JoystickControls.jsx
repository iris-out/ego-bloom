import React, { useState, useRef, useEffect } from 'react';

function Joystick({ onMove, onEnd }) {
  const containerRef = useRef(null);
  const pointerId = useRef(null);
  const [nubPos, setNubPos] = useState({ x: 0, y: 0 });
  const maxDist = 40; // Max radius for the nub to travel

  const handlePointerDown = (e) => {
    e.target.setPointerCapture(e.pointerId);
    pointerId.current = e.pointerId;
    updateNub(e);
  };

  const handlePointerMove = (e) => {
    if (pointerId.current !== e.pointerId) return;
    updateNub(e);
  };

  const handlePointerUp = (e) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    e.target.releasePointerCapture(e.pointerId);
    setNubPos({ x: 0, y: 0 });
    if (onEnd) onEnd();
  };

  const updateNub = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > maxDist) {
      dx = (dx / dist) * maxDist;
      dy = (dy / dist) * maxDist;
    }
    
    setNubPos({ x: dx, y: dy });
    if (onMove) {
      // Normalize to lengths between -1 and 1
      onMove({ x: dx / maxDist, y: -dy / maxDist }); // Invert Y so up is positive
    }
  };

  return (
    <div 
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="w-28 h-28 rounded-full border border-white/20 bg-white/10 backdrop-blur-md relative flex items-center justify-center pointer-events-auto touch-none select-none"
    >
      <div 
        className="w-12 h-12 bg-white/80 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)] pointer-events-none"
        style={{ transform: `translate(${nubPos.x}px, ${nubPos.y}px)` }}
      />
    </div>
  );
}

export default function JoystickControls({ joystickValues }) {
  return (
    <>
      <div className="lg:hidden fixed left-8 bottom-12 z-[9999]">
        <Joystick 
          onMove={({x,y}) => {
            joystickValues.current.move.x = x;
            joystickValues.current.move.y = y;
          }}
          onEnd={() => {
            joystickValues.current.move.x = 0;
            joystickValues.current.move.y = 0;
          }}
        />
      </div>
      <div className="lg:hidden fixed right-8 bottom-12 z-[9999]">
        <Joystick 
          onMove={({x,y}) => {
            joystickValues.current.rotate.x = x * 0.04;
            joystickValues.current.rotate.y = -y * 0.04; // Y inverted again for rotation
          }}
          onEnd={() => {
            joystickValues.current.rotate.x = 0;
            joystickValues.current.rotate.y = 0;
          }}
        />
      </div>
    </>
  );
}
