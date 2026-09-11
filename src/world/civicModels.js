// The two central blocks are reserved by shared/worldLayout.js.
export function addCivicScenery(add, quality) {
  const box = (material, x, y, z, w, h, d, color) => add(material, [x, y, z], [w, h, d], null, 'box', 0, color);
  const tree = (x, z, size = 1) => {
    add('wood', [x, 1.9, z], [0.6, 3.8, 0.6], null, 'trunk');
    add('leaf', [x, 5.4, z], [3.3 * size, 4.4 * size, 3.3 * size], null, 'tree');
  };
  const bench = (x, z) => {
    box('wood', x, 1.15, z, 5, 0.35, 1.5);
    box('wood', x, 1.8, z - 0.65, 5, 1.1, 0.25);
    for (const dx of [-1.8, 1.8]) box('dark', x + dx, 0.7, z, 0.3, 1, 1.4);
  };
  const lamp = (x, z) => {
    box('dark', x, 3.2, z, 0.23, 6.1, 0.23);
    box('lamp', x, 6.2, z, 1.1, 0.7, 1.1);
    box('dark', x, 6.65, z, 1.4, 0.18, 1.4);
  };
  box('pavement', 64, 0.35, -64, 93, 0.6, 93);
  box('green', -64, 0.35, -64, 93, 0.6, 93, '#c4d6a6');
  box('sand', -64, 0.69, -64, 87, 0.12, 5);
  box('sand', -64, 0.69, -64, 5, 0.12, 87);
  for (const side of [-1, 1]) {
    box('sand', -64 + side * 34, 0.69, -64, 3.5, 0.12, 70);
    box('sand', -64, 0.69, -64 + side * 34, 70, 0.12, 3.5);
  }
  // Sunken garden pond, stepping stones, and a small timber footbridge.
  add('stone', [-82, 0.6, -83], [14, 0.7, 11], null, 'octagon');
  add('water', [-82, 1, -83], [12.8, 0.15, 9.8], null, 'octagon');
  box('wood', -82, 1.45, -83, 3.8, 0.4, 24);
  for (const dx of [-2.1, 2.1]) {
    box('wood', -82 + dx, 2.7, -83, 0.2, 0.2, 24);
    for (let z = -93; z <= -73; z += 5) box('wood', -82 + dx, 2, z, 0.25, 1.5, 0.25);
  }
  for (let i = 0; i < 5; i++) box('stone', -78 + i * 2.6, 0.8, -54 + i * 2, 1.7, 0.2, 1.7);
  const parkTrees = [[-104,-102],[-90,-103],[-74,-103],[-50,-103],[-28,-101],[-28,-83],[-28,-48],[-27,-27],[-44,-26],[-80,-27],[-103,-27],[-103,-44],[-104,-76],[-44,-80],[-44,-43],[-83,-43]];
  parkTrees.forEach(([x, z], i) => { if (quality !== 'low' || i % 2 === 0) tree(x, z, 0.85 + i % 3 * 0.15); });
  for (const [x, z] of [[-82,-58],[-46,-58],[-82,-31],[-45,-96]]) bench(x, z);
  for (const [x, z] of [[-66,-103],[-103,-66],[-25,-66],[-66,-25]]) lamp(x, z);

  // Bank: limestone podium, a row of columns, and a proper triangular pediment.
  box('stone', 43, 1.3, -84, 31, 2, 29);
  box('sand', 43, 7.9, -87, 25, 13, 20);
  box('stone', 43, 2, -69, 30, 0.8, 3);
  box('stone', 43, 1.25, -67, 32, 0.65, 2);
  box('dark', 43, 5.5, -76.9, 4.6, 7, 0.15);
  for (const dx of [-9, -3, 3, 9]) {
    add('stone', [43 + dx, 8.6, -73], [0.85, 11, 0.85], null, 'trunk');
    box('stone', 43 + dx, 3.1, -73, 2.2, 0.5, 2.2);
    box('stone', 43 + dx, 14.2, -73, 2.3, 0.5, 2.3);
  }
  box('stone', 43, 14.8, -84, 31, 1, 28);
  add('sand', [43, 17.4, -84], [32, 4.2, 28], null, 'gable');
  for (const dx of [-8.2, 8.2]) box('glass', 43 + dx, 8.6, -76.9, 3.8, 5.5, 0.15);
  // Police: white civic office, a blue belt course, crest, and two patrol cars.
  box('stone', 85, 7.4, -85, 29, 14, 25);
  box('accent', 85, 11.2, -85, 30, 2.1, 26, '#7398bb');
  box('roof', 85, 14.8, -85, 30, 0.7, 26);
  box('dark', 85, 3.3, -72.4, 5, 5.6, 0.2);
  for (const dx of [-9, -4.8, 4.8, 9]) {
    box('glass', 85 + dx, 6.1, -72.4, 2.5, 3.6, 0.2);
    box('glass', 85 + dx, 12.8, -72.4, 2.5, 1.5, 0.2);
  }
  add('sand', [85, 11.3, -71.8], [1.5, 1.7, 0.35], null, 'tree');
  box('dark', 96, 18.3, -94, 0.2, 7, 0.2);
  box('dark', 96, 20.5, -94, 3, 0.15, 0.15);
  for (const x of [78, 94]) {
    box('car', x, 1.4, -63, 3.2, 1.7, 6);
    box('blueglass', x, 2.55, -63, 2.7, 1, 3.3);
    box('accent', x, 1.5, -63, 3.3, 0.65, 4.5, '#638cb1');
    box('accent', x - 0.55, 3.2, -63, 0.85, 0.25, 0.6, '#cf776b');
    box('accent', x + 0.55, 3.2, -63, 0.85, 0.25, 0.6, '#78add8');
  }
  // Plaza fountain and formal planting connect the two public buildings.
  add('stone', [64, 1, -40], [8, 1.2, 8], null, 'octagon');
  add('water', [64, 1.65, -40], [6.9, 0.15, 6.9], null, 'octagon');
  add('stone', [64, 3.5, -40], [1.4, 4, 1.4], null, 'octagon');
  add('sand', [64, 5.5, -40], [3, 0.6, 3], null, 'octagon');
  for (const [x,z] of [[25,-26],[103,-26],[26,-52],[103,-45]]) tree(x,z);
  for (const [x,z] of [[44,-37],[85,-37],[43,-24],[85,-24]]) bench(x,z);
  for (const [x,z] of [[26,-65],[107,-65],[47,-49],[82,-49]]) lamp(x,z);
  if (quality !== 'low') {
    for (const [i, [x,z]] of [[39,-57],[69,-52],[93,-48],[54,-29],[-62,-49],[-58,-81],[-87,-64],[-48,-32]].entries()) {
      box('accent', x, 1.65, z, 0.9, 1.6, 0.7, ['#a8b5ba','#b38972','#6d8194'][i % 3]);
      add('sand', [x, 2.9, z], [0.55, 0.6, 0.55], null, 'tree');
      for (const side of [-1,1]) box('dark', x + side * 0.25, 0.7, z, 0.28, 1, 0.35);
    }
  }
}
