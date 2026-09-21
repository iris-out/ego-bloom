import { Map, Search, SlidersHorizontal, Trophy, Users } from 'lucide-react';

/** 상단 탭 정의다. 컴포넌트와 같은 파일에 두면 fast refresh 가 깨지므로 분리한다. */
export const WORLD_TABS = [
  { key: 'discover', ko: '탐색', Icon: Search },
  { key: 'ranking', ko: '랭킹', Icon: Trophy },
  { key: 'map', ko: '지도', Icon: Map },
  { key: 'roster', ko: '접속자', Icon: Users },
  { key: 'settings', ko: '설정', Icon: SlidersHorizontal },
];

export const WORLD_TAB_KEYS = WORLD_TABS.map((tab) => tab.key);
