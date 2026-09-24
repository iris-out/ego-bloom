/** Shared curved glass placement, relative to the established driver eye. */
export const MODERN_DISPLAYS = Object.freeze({
  sedan:Object.freeze({x:.31,y:-.24,z:-.755,width:1.04,height:.19,bow:.048}),
  suv:Object.freeze({x:.34,y:-.29,z:-.88,width:1.10,height:.215,bow:.055}),
});
export function modernScreenFacets(vehicle) {
  const s=MODERN_DISPLAYS[vehicle];
  return Object.freeze([-1,1].map((side,index)=>Object.freeze({id:index?'center':'driver',mode:index?'roadnav':'executiveCluster',x:s.x+side*s.width/4,y:s.y,z:s.z+s.bow/4,width:s.width/2-.008,height:s.height,yaw:-side*.05})));
}
