import{a as e,c as t,d as n,i as r,n as i,o as a,t as o}from"./index-Bea1-wkX.js";var s=n(t(),1),c=a(),l=`#version 300 es
void main() {
  /* Fullscreen triangle from gl_VertexID — no vertex buffer at all. */
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,u=`#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;      /* -1..1, smoothed */

const int   NB    = 6;        /* metaballs */
const int   STEPS = 64;
const float BLEND = 0.38;     /* smin radius — how molten the union looks */
const float RAD   = 0.46;
const float FREQ  = 105.0;    /* contour bands per unit of radius */

/* Site tokens, linearised. --glow-violet, --c-accent, --c-bg. */
const vec3 VIOLET  = vec3(0.545, 0.247, 1.000);
const vec3 MAGENTA = vec3(1.000, 0.176, 0.435);
const vec3 GROUND  = vec3(0.043, 0.024, 0.078);

mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }

vec3 ballPos(int i, float t) {
  float f = float(i);
  return vec3(
    sin(t * 0.51 + f * 1.73) * 0.62,
    cos(t * 0.43 + f * 2.31) * 0.55,
    sin(t * 0.37 + f * 3.11) * 0.55
  );
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float map(vec3 p) {
  float d = 1e9;
  for (int i = 0; i < NB; i++) {
    d = smin(d, length(p - ballPos(i, uTime)) - RAD, BLEND);
  }
  return d;
}

/* Contour height. Distance from the blob's centroid, so the bands are
   concentric shells: on a lumpy surface they close into loops around every
   protrusion, which is what makes them read as topographic contours rather
   than stripes painted across the silhouette.
   (Distance to the *nearest ball centre* is the obvious choice and is wrong —
   it is constant across any unblended sphere, so it produces no bands at all.) */
float height(vec3 p) { return length(p); }

vec3 normalAt(vec3 p) {
  /* Tetrahedron normals: four map() calls instead of six. */
  const vec2 e = vec2(1.0, -1.0) * 0.0012;
  return normalize(
    e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
    e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

float ao(vec3 p, vec3 n) {
  float occ = 0.0, s = 1.0;
  for (int i = 1; i <= 5; i++) {
    float h = 0.02 + 0.11 * float(i);
    occ += (h - map(p + n * h)) * s;
    s *= 0.72;
  }
  return clamp(1.0 - 1.7 * occ, 0.0, 1.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

  /* Camera. The pointer nudges the orbit rather than driving it, so the
     composition never swings far from the framing the text is laid out for. */
  float yaw = uTime * 0.12 + uMouse.x * 0.35;
  float pit = uMouse.y * 0.22;

  vec3 ro = vec3(0.0, 0.0, 5.60);
  vec3 rd = normalize(vec3(uv, -1.35));
  ro.yz *= rot(pit);  rd.yz *= rot(pit);
  ro.xz *= rot(yaw);  rd.xz *= rot(yaw);

  vec3 col = GROUND;

  /* Ambient violet wash, matching the page's corner glows. */
  col += VIOLET * 0.055 * pow(max(0.0, 1.0 - length(uv * vec2(0.75, 1.1))), 2.5);

  /* March. */
  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.0016 * t) { hit = true; break; }
    t += d * 0.92;
    if (t > 9.0) break;
  }

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = normalAt(p);
    float occ = ao(p, n);

    /* Concentric contour bands, antialiased against their own screen-space
       rate of change. Without the fwidth term the bands alias into moiré as
       soon as they compress toward the silhouette — and at 55% render scale
       that is most of the shape. */
    float facing = abs(dot(n, -rd));
    float s     = height(p) * FREQ - uTime * 0.7;
    float rings = sin(s);
    float w     = clamp(fwidth(s) * 0.9, 0.06, 1.4);
    float band  = smoothstep(-w, w, rings);

    vec3 key  = normalize(vec3(-0.6, 0.8, 0.55));
    float dif = clamp(dot(n, key), 0.0, 1.0);
    float fre = pow(1.0 - facing, 3.0);

    /* Pale cool ridges, deep violet valleys. */
    vec3 ridge  = vec3(0.94, 0.93, 0.99) * (0.25 + 0.75 * dif);
    vec3 valley = VIOLET * 0.10;
    vec3 surf   = mix(valley, ridge, band) * occ;

    surf += MAGENTA * fre * 0.30;                        /* rim */
    surf += MAGENTA * (1.0 - occ) * 0.32 * (1.0 - band); /* crevice glow */

    col = surf;
  }

  /* Dashed ground line — the one graphic element under the blob. */
  float gy = uv.y + 0.30;
  float line = exp(-abs(gy) * 150.0);
  float dash = step(0.52, fract(uv.x * 46.0 + uTime * 0.25));
  float falloff = exp(-abs(uv.x) * 3.4);
  col += MAGENTA * line * dash * falloff * 0.55;
  col += MAGENTA * exp(-abs(gy) * 22.0) * falloff * 0.030;

  /* Vignette, then a dither to stop the dark gradients banding on 8-bit. */
  col *= 1.0 - 0.35 * pow(length(uv * vec2(0.62, 0.95)), 2.2);
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (dither - 0.5) / 255.0;

  fragColor = vec4(col, 1.0);
}`;function d(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(t||`shader compile failed`)}return r}function f({className:e=``,scale:t=.55}){let n=(0,s.useRef)(null),[r,i]=(0,s.useState)(!1);return(0,s.useEffect)(()=>{let e=n.current;if(!e)return;let r=e.getContext(`webgl2`,{alpha:!1,antialias:!1,depth:!1,stencil:!1,powerPreference:`high-performance`});if(!r){i(!0);return}let a;try{if(a=r.createProgram(),r.attachShader(a,d(r,r.VERTEX_SHADER,l)),r.attachShader(a,d(r,r.FRAGMENT_SHADER,u)),r.linkProgram(a),!r.getProgramParameter(a,r.LINK_STATUS))throw Error(r.getProgramInfoLog(a)||`link failed`)}catch(e){console.warn(`ShaderBlob failed to build, showing fallback:`,e.message),i(!0);return}r.useProgram(a);let o=r.getUniformLocation(a,`uRes`),s=r.getUniformLocation(a,`uTime`),c=r.getUniformLocation(a,`uMouse`),f=matchMedia(`(prefers-reduced-motion: reduce)`).matches,p={x:0,y:0,sx:0,sy:0},m=null,h=!0,g=0,_=0;function v(){let n=e.getBoundingClientRect(),i=Math.max(1,Math.round(n.width*t)),a=Math.max(1,Math.round(n.height*t));(i!==g||a!==_)&&(g=i,_=a,e.width=g,e.height=_,r.viewport(0,0,g,_),r.uniform2f(o,g,_))}let y=performance.now();function b(e){m=requestAnimationFrame(b),v(),p.sx+=(p.x-p.sx)*.06,p.sy+=(p.y-p.sy)*.06,r.uniform2f(c,p.sx,p.sy),r.uniform1f(s,f?8:(e-y)/1e3),r.drawArrays(r.TRIANGLES,0,3),f&&(cancelAnimationFrame(m),m=null)}function x(){m==null&&h&&!document.hidden&&(m=requestAnimationFrame(b))}function S(){m!=null&&cancelAnimationFrame(m),m=null}function C(t){let n=e.getBoundingClientRect();p.x=(t.clientX-n.left)/n.width*2-1,p.y=(t.clientY-n.top)/n.height*2-1}function w(){document.hidden?S():x()}let T=new IntersectionObserver(([e])=>{h=e.isIntersecting,h?x():S()});return T.observe(e),v(),x(),window.addEventListener(`mousemove`,C,{passive:!0}),document.addEventListener(`visibilitychange`,w),()=>{if(S(),T.disconnect(),window.removeEventListener(`mousemove`,C),document.removeEventListener(`visibilitychange`,w),!e.isConnected){let e=r.getExtension(`WEBGL_lose_context`);e&&e.loseContext()}}},[t]),r?(0,c.jsx)(`div`,{className:`blob blob--fallback ${e}`,"aria-hidden":`true`}):(0,c.jsx)(`canvas`,{ref:n,className:`blob ${e}`,"aria-hidden":`true`})}function p(){return(0,c.jsxs)(c.Fragment,{children:[(0,c.jsxs)(`div`,{className:`blobstage`,children:[(0,c.jsx)(f,{}),(0,c.jsxs)(`div`,{className:`blobstage__ui`,children:[(0,c.jsx)(`p`,{className:`blobstage__kicker`,children:`SmartGym 360`}),(0,c.jsx)(`h1`,{className:`blobstage__h`,children:`A gym that knows what is happening inside it.`}),(0,c.jsx)(`p`,{className:`blobstage__sub`,children:`Move the pointer — the camera follows it. Everything you see is one fragment shader; there is no model and no texture.`})]}),(0,c.jsx)(`div`,{className:`blobstage__fade`})]}),(0,c.jsxs)(r,{eyebrow:`Preview`,title:`What this is, and what it would cost`,lede:`A raymarched metaball drawn by a single fragment shader. Nothing here is geometry — the surface is found per-pixel, every frame.`,children:[(0,c.jsxs)(`div`,{className:`grid--3`,children:[(0,c.jsx)(e,{children:(0,c.jsx)(i,{n:1,title:`No Three.js`,children:`One fullscreen triangle and a fragment shader, in raw WebGL2. About 3 KB gzipped, against the 155 KB Three.js would cost to draw the same two triangles. It can go on any page without touching the bundle split.`})}),(0,c.jsx)(e,{delay:70,children:(0,c.jsx)(i,{n:2,title:`Cost is per pixel`,children:`Raymarching does not care how complex the shape is, only how many pixels it fills. That is why it renders at 55% resolution and is upscaled — the ring pattern hides the softness, and it cuts the work by two thirds.`})}),(0,c.jsx)(e,{delay:140,children:(0,c.jsx)(i,{n:3,title:`Degrades honestly`,children:`No WebGL2, a failed compile, a hidden tab or a scrolled-past canvas all stop the loop. Reduced motion draws one frozen frame. There is no state in which this spins invisibly.`})})]}),(0,c.jsx)(e,{delay:160,children:(0,c.jsxs)(o,{title:`The honest question about putting it on the Home page`,children:[(0,c.jsx)(`p`,{children:`The hero is currently a scroll-scrubbed sequence of the real gym floor — 240 photographic frames the viewer drives with the scroll wheel. It says something specific: this is a building full of equipment that reports its own state.`}),(0,c.jsx)(`p`,{children:`This shader says something different, and more generic. It is beautiful and it is abstract, which is why it suits an agency landing page. Putting it above the scrubber would mean the first thing an investor sees is a blob rather than a gym.`}),(0,c.jsx)(`p`,{children:`It fits better where the page is currently flat: behind the Economics header, or as the closing panel before the footer. Say where you want it and I will move it.`})]})})]})]})}export{p as default};