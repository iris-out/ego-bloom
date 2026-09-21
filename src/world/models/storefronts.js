/** A single shared sign atlas, eight instanced plane geometries. No text DOM or
 * per-shop textures; labels describe fictional neighborhood businesses. */
export const SHOP_SIGNS = Object.freeze([
  { text: '한강 부동산', sub: 'HANGANG REAL ESTATE', color: '#285e53' },
  { text: '서울 분식', sub: '김밥 · 떡볶이 · 국수', color: '#963e32' },
  { text: '우리 약국', sub: 'PHARMACY  +', color: '#326c47' },
  { text: '골목 커피', sub: 'COFFEE & BAKERY', color: '#384859' },
]);
export function addStoreSign(part,x,z,y,w,h,color,rotation=0) {
  // One front face replaces the old colored box; material owns a shared atlas.
  const offset=.17;
  part('shopfront',x+Math.sin(rotation)*offset,y,z+Math.cos(rotation)*offset,
    w,h,1,'pane',rotation,'#ffffff');
}

/** Select the atlas row in the vertex shader from the instance transform. This
 * keeps every sign in one instanced draw call without custom per-shop resources. */
export function applyStorefrontShader(material) {
  material.customProgramCacheKey=()=> 'seoul-storefront-atlas-v1';
  material.onBeforeCompile=shader=> {
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      #ifdef USE_INSTANCING
        float signRow=mod(floor(abs(instanceMatrix[3].x*11.0+instanceMatrix[3].z*7.0+instanceMatrix[3].y*13.0)),4.0);
        bool verticalSign=length(instanceMatrix[1].xyz)>length(instanceMatrix[0].xyz);
        vec2 signMin=vec2(verticalSign?448.0/512.0:4.0/512.0,1.0-(signRow+1.0)/4.0+4.0/512.0);
        vec2 signMax=vec2(verticalSign?508.0/512.0:440.0/512.0,1.0-signRow/4.0-4.0/512.0);
        vMapUv=mix(signMin,signMax,uv);
        vEmissiveMapUv=vMapUv;
      #endif`);
  };
}

export function paintStorefrontAtlas(ctx) {
  ctx.clearRect(0,0,512,512);
  SHOP_SIGNS.forEach((sign,i)=>{
    const y=i*128;
    ctx.fillStyle=sign.color;ctx.fillRect(0,y,512,128);
    ctx.strokeStyle='#f2e7cf';ctx.lineWidth=2;ctx.strokeRect(9,y+9,424,110);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff6df';
    ctx.font='bold 52px "Noto Sans CJK KR", sans-serif';ctx.fillText(sign.text,221,y+48,398);
    ctx.font='17px "Noto Sans CJK KR", sans-serif';ctx.fillText(sign.sub,221,y+94,390);
    const vertical=sign.text.replaceAll(' ','').slice(-2);
    ctx.fillStyle='#f2eadb';ctx.fillRect(448,y,64,128);ctx.fillStyle=sign.color;
    ctx.font='bold 36px "Noto Sans CJK KR", sans-serif';
    [...vertical].forEach((char,j)=>ctx.fillText(char,480,y+38+j*50,52));
  });
}
