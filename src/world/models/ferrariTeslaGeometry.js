import * as THREE from 'three';
import { loftBody } from './carGeometry.js';
import { FOUR_VEHICLE_LAYOUT } from './fourVehicleLayout.js';

const BODY = {
  supercar: {
    hood: [
      { z:-2.32,width:.88,lowerY:-.62,shoulderY:-.24,topWidth:.72,topY:-.09,crown:.01 },
      { z:-2.12,width:1.02,lowerY:-.65,shoulderY:-.16,topWidth:.87,topY:.02,crown:.01 },
      { z:-1.38,width:1.08,lowerY:-.65,shoulderY:-.08,topWidth:.85,topY:.09,crown:.025 },
      { z:-.96,width:1.05,lowerY:-.62,shoulderY:.04,topWidth:.84,topY:.07,crown:.015 },
    ],
    deck: [
      { z:.91,width:1.09,lowerY:-.63,shoulderY:.13,topWidth:.81,topY:.16,crown:.02 },
      { z:1.25,width:1.12,lowerY:-.65,shoulderY:.20,topWidth:.86,topY:.27,crown:.025 },
      { z:1.85,width:1.10,lowerY:-.64,shoulderY:.18,topWidth:.87,topY:.23,crown:.015 },
      { z:2.31,width:.98,lowerY:-.57,shoulderY:-.07,topWidth:.86,topY:.09,crown:.005 },
      { z:2.32,width:.94,lowerY:-.54,shoulderY:-.10,topWidth:.83,topY:.06,crown:.005 },
    ],
    upper:[[-2.36,-.2],[-1.70,-.06],[-.95,.04],[.91,.12],[1.45,.21],[2.36,-.05]],
    width:[[-2.36,.91],[-1.50,1.085],[-.96,1.05],[.25,1.04],[1.32,1.105],[2.36,.96]],
    floorY:-.66,
  },
  electric: {
    hood: [
      { z:-2.49,width:.93,lowerY:-.58,shoulderY:-.15,topWidth:.82,topY:-.02,crown:.008 },
      { z:-2.21,width:1.00,lowerY:-.62,shoulderY:-.04,topWidth:.87,topY:.14,crown:.012 },
      { z:-1.58,width:1.065,lowerY:-.62,shoulderY:.12,topWidth:.88,topY:.23,crown:.02 },
      { z:-1.13,width:1.035,lowerY:-.61,shoulderY:.19,topWidth:.86,topY:.24,crown:.012 },
    ],
    deck: [
      { z:1.55,width:1.04,lowerY:-.62,shoulderY:.22,topWidth:.80,topY:.33,crown:.015 },
      { z:1.89,width:1.035,lowerY:-.61,shoulderY:.18,topWidth:.83,topY:.29,crown:.012 },
      { z:2.25,width:.98,lowerY:-.59,shoulderY:.08,topWidth:.85,topY:.20,crown:.008 },
      { z:2.49,width:.91,lowerY:-.54,shoulderY:-.03,topWidth:.82,topY:.12,crown:.005 },
    ],
    upper:[[-2.49,-.13],[-1.57,.12],[-1.13,.19],[.30,.23],[1.55,.22],[2.49,-.03]],
    width:[[-2.49,.92],[-1.57,1.065],[-1.13,1.035],[.4,1.045],[1.40,1.06],[2.49,.91]],
    floorY:-.64,
  },
};

function at(rows,z) {
  for(let i=1;i<rows.length;i++) if(z<=rows[i][0]) {
    const t=(z-rows[i-1][0])/(rows[i][0]-rows[i-1][0]);
    return rows[i-1][1]*(1-t)+rows[i][1]*t;
  }
  return rows.at(-1)[1];
}

function sideSkin(key) {
  const layout=FOUR_VEHICLE_LAYOUT[key], spec=BODY[key];
  const { frontZ,rearZ,radius,y:wheelY }=layout.wheels;
  const segments=112, bands=10, positions=[], indices=[];
  for(const side of [-1,1]) {
    const base=positions.length/3;
    for(let i=0;i<=segments;i++) {
      const z=-layout.depth/2+layout.depth*i/segments;
      let lower=spec.floorY;
      for(const wheelZ of [frontZ,rearZ]) {
        const dz=z-wheelZ,cut=radius+.055;
        if(Math.abs(dz)<cut) lower=Math.max(lower,wheelY+Math.sqrt(cut*cut-dz*dz));
      }
      const upper=at(spec.upper,z), half=at(spec.width,z);
      for(let j=0;j<=bands;j++) {
        const t=j/bands,y=lower+(upper-lower)*t;
        const flare=.04*Math.exp(-(((z-frontZ)/.42)**2))+.045*Math.exp(-(((z-rearZ)/.45)**2));
        const x=half-.065*(1-t)**2+(.035+flare)*Math.sin(Math.PI*t);
        positions.push(side*Math.min(layout.width/2,x),y,z);
      }
    }
    for(let i=0;i<segments;i++) for(let j=0;j<bands;j++) {
      const z=-layout.depth/2+layout.depth*(i+.5)/segments;
      const y=spec.floorY+(at(spec.upper,z)-spec.floorY)*(j+.5)/bands;
      // The Ferrari intake is a real opening in the outer side sheet.
      if(key==='supercar'&&z>-.32&&z<.69&&y>-.49&&y<-.075) continue;
      const a=base+i*(bands+1)+j,b=a+1,c=a+bands+1,d=c+1;
      if(side===1) indices.push(a,b,d,a,d,c);
      else indices.push(a,d,b,a,c,d);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  return g;
}

export function createFerrariTeslaBody(key) {
  if(!BODY[key]) throw new Error(`Unknown body ${key}`);
  const layout=FOUR_VEHICLE_LAYOUT[key],spec=BODY[key];
  const floor=new THREE.BoxGeometry(layout.cabin.innerWidth-.07,.055,layout.cabin.rearZ-layout.cabin.frontZ);
  floor.translate(0,layout.cabin.floorY-.055,(layout.cabin.frontZ+layout.cabin.rearZ)/2);
  return { hood:loftBody(spec.hood),deck:loftBody(spec.deck),sides:sideSkin(key),floor };
}
