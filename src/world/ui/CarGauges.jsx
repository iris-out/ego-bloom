import { MAX_RPM, REDLINE_RPM, tachometer } from '../carGauges.js';

/** Third-person drive readout. RPM and gear come from physics when available. */
export default function CarGauges({ status = {} }) {
  const speed = Math.max(0, Math.round(Number(status.speed) || 0));
  const top = Math.max(40, Math.round((Number(status.top) || 62) * 3.6));
  const fallback = tachometer(speed, top);
  const maxRpm = Number.isFinite(status.maxRpm) && status.maxRpm > 0 ? status.maxRpm : MAX_RPM;
  const dialMaxRpm = Number.isFinite(status.dialMaxRpm) && status.dialMaxRpm >= maxRpm ? status.dialMaxRpm : maxRpm;
  const redlineRpm = Number.isFinite(status.redlineRpm) && status.redlineRpm > 0 ? status.redlineRpm : REDLINE_RPM;
  const rpm = Number.isFinite(status.rpm) ? Math.max(0, Math.min(maxRpm, status.rpm)) : fallback.rpm;
  const gear = status.gear === 'R' ? 'R' : (Number.isInteger(status.gear) ? status.gear : fallback.gear);
  const rpmPercent = Math.round((rpm / dialMaxRpm) * 100);
  const electric = status.powertrain === 'electric';
  const power = Math.max(-1, Math.min(1, Number(status.power) || 0));

  return <section className="wui-gauges" aria-label="주행 계기">
    <div className="wui-drive-heading"><span>DRIVE</span><span>{status.braking ? 'BRAKE' : 'LIVE'}</span></div>
    <div className="wui-drive-main">
      <div className="wui-drive-speed" role="meter" aria-label="속도" aria-valuemin={0}
        aria-valuemax={Math.max(top, speed)} aria-valuenow={speed}>
        <b>{speed}</b><span>KM/H</span>
      </div>
      <div className="wui-drive-gear" aria-label={`기어 ${electric ? (gear === 'R' ? 'R' : 'D') : gear}`}><b>{electric ? (gear === 'R' ? 'R' : 'D') : gear}</b><span>{electric ? 'DRIVE' : 'GEAR'}</span></div>
    </div>
    {electric ? <div className="wui-drive-rpm" role="meter" aria-label="구동 및 회생 제동" aria-valuemin={-100}
      aria-valuemax={100} aria-valuenow={Math.round(power * 100)}>
      <div><span>{power < 0 ? 'REGEN' : 'POWER'}</span><b>{Math.round(Math.abs(power) * 100)} <small>%</small></b></div>
      <span className="wui-drive-rpm-track"><i style={{ width: `${Math.round(Math.abs(power) * 100)}%` }} /></span>
    </div> : <div className="wui-drive-rpm" role="meter" aria-label="회전수" aria-valuemin={0}
      aria-valuemax={dialMaxRpm} aria-valuenow={rpm}>
      <div><span>RPM</span><b>{(rpm / 1000).toFixed(1)} <small>×1000</small></b></div>
      <span className="wui-drive-rpm-track"><i style={{ width: `${rpmPercent}%` }} /><em style={{ left: `${(redlineRpm / dialMaxRpm) * 100}%` }} /></span>
    </div>}
  </section>;
}
