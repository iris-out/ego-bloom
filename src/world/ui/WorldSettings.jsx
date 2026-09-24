export default function WorldSettings({ quality, onQuality, timeOfDay, onTimeOfDay, weather, onWeather, anonymous, onAnonymous, volume, onVolume, hudScale, onHudScale, highContrast, onHighContrast, reducedMotion, onReducedMotion }) {
  return <div className="world-settings-fields">
    <h2>플레이 설정</h2>
    <label>그래픽 품질<select value={quality} onChange={e=>onQuality(e.target.value)}><option value="low">낮음 · 가볍게</option><option value="medium">보통 · 균형 있게</option><option value="high">높음 · 섬세하게</option></select></label>
    <label>시간대<select value={timeOfDay} onChange={e=>onTimeOfDay(e.target.value)}><option value="day">낮</option><option value="dawn">새벽 · 일출</option><option value="sunset">저녁 · 노을</option><option value="night">밤</option></select></label>
    <label>날씨<select value={weather} onChange={e=>onWeather(e.target.value)}><option value="clear">맑음</option><option value="cloudy">흐림</option><option value="rain">비</option><option value="snow">눈</option></select></label>
    <label>전체 음량 <output>{Math.round(volume*100)}%</output><input aria-label="전체 음량" type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>onVolume(Number(e.target.value))}/></label>
    <label>HUD 크기 <output>{Math.round(hudScale*100)}%</output><input aria-label="HUD 크기" type="range" min="0.8" max="1.4" step="0.05" value={hudScale} onChange={e=>onHudScale(Number(e.target.value))}/></label>
    <label className="world-setting-check"><input type="checkbox" checked={highContrast} onChange={e=>onHighContrast(e.target.checked)}/>HUD 높은 대비</label>
    <label className="world-setting-check"><input type="checkbox" checked={reducedMotion} onChange={e=>onReducedMotion(e.target.checked)}/>화면 움직임 줄이기</label>
    <label className="world-setting-check"><input type="checkbox" checked={anonymous} onChange={e=>onAnonymous(e.target.checked)}/>빌딩 제작자 미공개</label>
    <p>ESC 게임 메뉴 · C 시점 전환 · 화면의 조작 도움말에서 현재 탈것의 키를 확인하세요.</p>
  </div>;
}
