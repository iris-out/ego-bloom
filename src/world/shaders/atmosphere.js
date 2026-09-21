/** Directional sky shader: horizon scattering and a bright solar disc share the
 * same direction as city lighting. Moon relief is procedural, not a photo/map.
 * Color conversion chunks are required because Three uniforms are linear RGB.
 */
// 하늘은 불투명 도시를 다 그린 뒤 먼 평면(깊이 1) 에 그린다. 도시가 덮은 화소는 깊이 검사에서
// 셰이더를 돌리기 전에 떨어진다. z 를 w 보다 아주 조금 작게 두어 먼 평면 clip 에 걸리지 않게 한다.
export const skyVertex=`varying vec3 vSkyDirection;
 void main(){vSkyDirection=position;vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.0);
 gl_Position=vec4(clip.xy,clip.w*0.999999,clip.w);}`;
export const skyFragment=`
uniform vec3 uZenith,uHorizon,uSunColor,uSunDirection;
uniform float uNight,uGlow,uCloud;
varying vec3 vSkyDirection;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
 vec3 d=normalize(vSkyDirection),s=normalize(uSunDirection);
 float height=max(d.y,0.0),sunDot=clamp(dot(d,s),-1.0,1.0);
 float angle=acos(sunDot);
 vec3 sky=mix(uHorizon,uZenith,pow(smoothstep(-.04,.8,d.y),.55));
 float horizon=exp(-abs(d.y)*9.0);
 // 밤에는 지평선 산란을 거의 끈다. 달 방향에 남는 것만 허용한다.
 sky+=uSunColor*horizon*pow(max(sunDot,0.0),12.0)*uGlow*.45*mix(1.0,.3,uNight);
 // halo 는 낮의 태양 아우라용이다. 밤에는 달 주변이 하늘을 들어올리지 않게 크게 줄인다.
 float halo=exp(-angle*angle/ .014)*(.11+uGlow*.24)*mix(1.0,.12,uNight);
 sky+=uSunColor*halo*(1.0-uCloud*.7);
 if(uNight<.5){
  float disc=1.0-smoothstep(.011,.013,angle);
  float aureole=exp(-angle*42.0)*.22;
  sky+=uSunColor*(disc*5.0+aureole)*(1.0-uCloud*.78);
 }else{
  vec3 right=normalize(cross(vec3(0,1,0),s)),up=cross(s,right);
  vec2 uv=vec2(dot(d,right),dot(d,up))/.019;
  float r=length(uv),disc=1.0-smoothstep(.97,1.0,r);
  if(r<1.0){
   vec3 n=vec3(uv,sqrt(max(0.0,1.0-r*r)));
   float relief=.68+noise(uv*12.0)*.14+noise(uv*35.0)*.07;
   for(int i=0;i<9;i++){
    float f=float(i);vec2 center=vec2(sin(f*17.1),cos(f*11.7))*.7;
    float crater=length(uv-center)/( .08+hash(vec2(f,2.0))*.13);
    relief-=exp(-crater*crater*2.0)*.18;
    relief+=exp(-pow(crater-1.0,2.0)*45.0)*.06;
   }
   float phase=max(.09,dot(n,normalize(vec3(-.45,.2,.86))));
   sky=mix(sky,vec3(.82,.86,.88)*relief*phase*1.6,disc);
  }
 }
 sky=mix(sky,vec3(dot(sky,vec3(.2126,.7152,.0722))),uCloud*.25);
 gl_FragColor=vec4(sky,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
