import {sectionShell,airfoilGeometry,ductGeometry} from '../../src/world/models/vehicleSurfaces.js';
// These fixtures create the production geometry so mount tests keep measuring
// authored geometry/bounds, while React effects remain outside their scope.
export function surfaceFixtures(h){
 return {
  Shell:({stations,segments=32,steps=5,...props})=>h('mesh',{...props,geometry:sectionShell(stations,{segments,steps})}),
  Airfoil:({stations,...props})=>h('mesh',{...props,geometry:airfoilGeometry(stations)}),
  Duct:({radius,length,wall,...props})=>h('mesh',{...props,geometry:ductGeometry({radius,length,wall})}),
 };
}
