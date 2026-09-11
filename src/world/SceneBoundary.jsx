import { Component } from 'react';

export default class SceneBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed) return <div className="world-scene-message" role="alert">
      <h2>3D 화면을 열지 못했습니다</h2>
      <p>제작자 목록과 프로필은 계속 이용할 수 있습니다.</p>
      <button className="eb-btn eb-btn-secondary" onClick={this.props.onRetry}>3D 다시 열기</button>
    </div>;
    return this.props.children;
  }
}
