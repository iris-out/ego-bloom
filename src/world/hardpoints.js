/** 기종별 장착점. 좌표는 모델 로컬 값이며 models/ 의 실제 mesh 위치에서 따왔다.
 * 모델의 노즐이나 파일런을 옮기면 이 표도 같이 옮긴다.
 */
export const ENGINE_PORTS = {
  jet: [{ position: [-3.4, -0.82, 4.05], radius: 0.4 }, { position: [3.4, -0.82, 4.05], radius: 0.4 }],
  bomber: [
    { position: [-2.9, 0.25, 2.3], radius: 0.34 }, { position: [2.9, 0.25, 2.3], radius: 0.34 },
    { position: [-5.6, 0.25, 2.3], radius: 0.34 }, { position: [5.6, 0.25, 2.3], radius: 0.34 },
  ],
  // 프로펠러기는 배기가 코 옆 배기관에서 나온다. 노즐 하나로 갈음한다.
  prop: [{ position: [0.8, 0.12, -2.8], radius: 0.12 }],
  // 전투기 모델을 FIGHTER_SCALE 로 키웠으므로 노즐 좌표도 같은 배율이다.
  fighter: [{ position: [-0.78, -0.06, 7.78], radius: 0.45, afterburner: true }, { position: [0.78, -0.06, 7.78], radius: 0.45, afterburner: true }],
  // 요격기는 날개 밑 나셀 두 개다. 로켓처럼 길고 밝은 배기를 낸다.
  interceptor: [{ position: [-2.2, -0.5, 1.9], radius: 0.42, afterburner: true }, { position: [2.2, -0.5, 1.9], radius: 0.42, afterburner: true }],
  helicopter: [{ position: [0.85, 1.1, 1.9], radius: 0.22 }],
};

const ARMAMENT = {
  fighter: {
    cannon: [[-0.69, 0.06, -6.05], [0.69, 0.06, -6.05]],
    missile: [[-4.37, -1.01, 1.46], [4.37, -1.01, 1.46], [-5.99, -0.62, 2.13], [5.99, -0.62, 2.13]],
  },
  // 요격기는 기수의 2연장 기관포를 100m 앞 중심선으로 수렴시킨다.
  interceptor: {
    cannon: [[-0.3, 0.1, -4.6], [0.3, 0.1, -4.6]],
    converge: 100,
  },
  // 샷거너는 요격기의 기수 2연장 포구를 공유하고 150m에서 두 탄도가 수렴한다.
  shotgun: {
    cannon: [[-0.3, 0.1, -4.6], [0.3, 0.1, -4.6]],
    converge: 150,
  },
  // 프로펠러기는 주익에 박은 기관총 네 정이다. 미사일은 달지 않는다.
  // converge 는 네 정이 모이는 기수 앞 거리다. 실제 2차대전기의 수렴 사격과 같고,
  // 이 거리에서 탄이 조준점 한 점으로 모인다.
  prop: {
    cannon: [[-1.9, -0.18, -2.45], [1.9, -0.18, -2.45], [-2.6, -0.18, -2.45], [2.6, -0.18, -2.45]],
    converge: 260,
  },
  // 폭격기는 동체 아래 폭탄창 하나다. 폭탄은 문 사이로 떨어진다.
  bomber: {
    bomb: [[0, -1.25, -0.6]],
  },
};

export function armamentOf(plane) {
  return ARMAMENT[plane] || null;
}

export function enginesOf(plane) {
  return ENGINE_PORTS[plane] || ENGINE_PORTS.jet;
}
