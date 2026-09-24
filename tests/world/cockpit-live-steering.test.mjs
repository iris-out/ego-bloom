import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';

test('cockpit passes the live wheel ref to the mounted cabin', async () => {
  const source = await readFile(new URL('../../src/world/cockpits/index.jsx', import.meta.url), 'utf8');
  const component = source.slice(source.indexOf('export default function Cockpit')).replace('export default function Cockpit', 'function Cockpit');
  const { code } = await transformWithOxc(component, 'Cockpit.jsx', { jsx: { runtime: 'classic', pragma: 'h' } });
  const Interior = () => null;
  const h = (type, props, ...children) => ({ type, props, children });
  const Cockpit = new Function('h', 'useLayoutEffect', 'setNightPanels', 'applyPalette', 'COCKPITS', 'COCKPIT_ROOT', 'StaticBatch',
    `${code}; return Cockpit;`)(h, () => {}, () => {}, () => {}, { electric: Interior }, {}, () => null);
  const wheelsRef = { current: { steer: .6 } };
  const tree = Cockpit({ rideKey: 'electric', wheelsRef });
  const cabin = tree.children[0].children[0];
  assert.equal(cabin.type, Interior);
  assert.equal(cabin.props.wheelsRef, wheelsRef);
});
