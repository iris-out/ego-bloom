import { Component } from 'react';

export default class SceneBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error, errorInfo) {
    console.warn('SceneBoundary caught 3D scene error:', error, errorInfo);
    this.props.onError?.(error);
  }
  render(){
    if(this.state.failed) return <div className="world-scene-message" role="alert">
      <h2>3D 화면을 열지 못했습니다</h2>
      <p>GPU 자원이 부족하거나 WebGL 컨텍스트가 손실되었습니다. 그래픽 품질을 낮추거나 새로고침해주세요.</p>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
        <button className="eb-btn eb-btn-primary" onClick={() => this.props.onRetry?.('low')}>낮은 품질로 다시 시도</button>
        <button className="eb-btn eb-btn-secondary" onClick={() => window.location.reload()}>새로고침</button>
      </div>
    </div>;
    return this.props.children;
  }
}
