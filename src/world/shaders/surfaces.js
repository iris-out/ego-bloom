/** Extend the existing lit materials rather than replacing PBR/shadow support.
 * Patch points target pinned Three r182. Keep browser shader-error checks when
 * upgrading Three. Shared materials retain ownership in WorldScene/Ocean.
 */
export function applySurfaceShader(material, kind) {
 const time={value:0};
 material.customProgramCacheKey=()=>`miniature-${kind}-v1`;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uSurfaceTime=time;
  shader.vertexShader='varying vec3 vSurfaceWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec4 surfacePosition=vec4(position,1.0);
    #ifdef USE_INSTANCING
      surfacePosition=instanceMatrix*surfacePosition;
    #endif
    vSurfaceWorld=(modelMatrix*surfacePosition).xyz;`);
  shader.fragmentShader='varying vec3 vSurfaceWorld;\nuniform float uSurfaceTime;\n'+shader.fragmentShader;
  if(kind==='water'){
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    float rippleX=sin(vSurfaceWorld.x*.14+vSurfaceWorld.z*.09+uSurfaceTime*.8);
    float rippleZ=cos(vSurfaceWorld.z*.19-vSurfaceWorld.x*.06+uSurfaceTime*.62);
    normal=normalize(normal+mat3(viewMatrix)*vec3(rippleX*.055,0.0,rippleZ*.045));`);
  }else{
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float grain=fract(sin(dot(floor(vSurfaceWorld*13.0),vec3(12.9898,78.233,37.719)))*43758.5453);
    diffuseColor.rgb*=.96+grain*.08;
    ${kind==='glass'?`float horizontal=step(.13,fract(vSurfaceWorld.y*.31));
    float vertical=max(step(.12,fract(vSurfaceWorld.x*.38)),step(.12,fract(vSurfaceWorld.z*.38)));
    diffuseColor.rgb*=mix(.62,1.0,horizontal*vertical);`:''}`);
   if(kind==='glass')shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
    float sheen=pow(1.0-abs(dot(normal,normalize(vViewPosition))),3.0);
    outgoingLight+=vec3(.16,.23,.29)*sheen*.45;
    #include <opaque_fragment>`);
  }
 };
 return time;
}
