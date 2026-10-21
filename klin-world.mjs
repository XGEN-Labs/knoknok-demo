import * as THREE from './vendor/three/three.module.js';
import { loadNativeKlinStage } from './klin-native-model.mjs';
import { createContractLight } from './klin-contract-light.mjs';
import { createAwakeningField } from './klin-awakening-field.mjs?v=20261021-refine-27c';
import { createReferenceField as createWarmField, createReferenceDepth as createWarmDepth, updateReferenceDepth as updateWarmDepth, createReferenceGates as createFriendLounge, updateReferenceGates as updateFriendLounge, updateReferenceField } from './klin-reference-scene.mjs?v=20261021-refine-29b';

// Persistent world; supplied Blender juvenile/adult meshes and native hair curves
// are loaded once, then carried through all scenes by the same locomotion rig.
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => (t = clamp(t), t * t * (3 - 2 * t));
const ease = t => (t = clamp(t), t * t * t * (t * (t * 6 - 15) + 10));
const HOME_PAGES = new Set(['home', 'growing']);
const VISIT_PAGES = new Set(['relations', 'search']);
const AUTH_PAGES = new Set(['auth', 'login', 'register', 'phone', 'verify']);
const SETUP_PAGES = new Set(['basics', 'birth', 'setup', 'setup-basics', 'setup-birth', 'initializing', 'onboard']);
const SCENE_SPACING = 5.2;
const SCENE_X = Object.freeze({ welcome: -SCENE_SPACING, home: 0, porch: SCENE_SPACING, memory: SCENE_SPACING * 2, profile: SCENE_SPACING * 3, companion: SCENE_SPACING * 4, shared: SCENE_SPACING * 5 });
const SCENE_ORDER = Object.keys(SCENE_X);
const palette = Object.freeze({ background: 0xe4dfeb, cream: 0xf4e9df, blue: 0xb9c5df, accent: 0xe3c4bf, pearl: 0xfffbf3, floor: 0xeee3d7, ink: 0x393649 });

function random(seed = 1827) {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; };
}

function makeRoundedBox(w, h, d, radius = .12) {
  const r = Math.min(radius, w / 2, h / 2, d / 2);
  const g = new THREE.BoxGeometry(w, h, d, 5, 5, 5);
  const p = g.attributes.position;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(clamp(v.x, -w / 2 + r, w / 2 - r), clamp(v.y, -h / 2 + r, h / 2 - r), clamp(v.z, -d / 2 + r, d / 2 - r));
    v.sub(c).normalize().multiplyScalar(r).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// These invisible anchors keep locomotion independent from the authored model.
// No old procedural character mesh is created or retained in GPU memory.
function createKlinRig() {
  const root=new THREE.Group(),torso=new THREE.Group(),body=new THREE.Group(),tail=new THREE.Group();
  torso.add(body);root.add(torso,tail);
  const eyes=[new THREE.Group(),new THREE.Group()];body.add(...eyes);
  const limbs=[-1,1].map(side=>{const pivot=new THREE.Group(),hand=new THREE.Group();pivot.add(hand);root.add(pivot);return{side,pivot,hand};});
  const feet=[-1,1].map(side=>{const pivot=new THREE.Group(),foot=new THREE.Group();pivot.add(foot);root.add(pivot);return{side,pivot,foot};});
  return{root,torso,body,tail,eyes,limbs,feet,growth:0};
}

function cloneKlinRig(source) {
  const root = source.root.clone(true), copies = new Map();
  const pair = (a, b) => {
    copies.set(a, b);
    // The second companion shares the model, with a lighter strand draw range.
    if (b.isLineSegments) { b.geometry = b.geometry.clone(); b.geometry.setDrawRange(0, Math.floor(b.geometry.attributes.position.count * .55 / 6) * 6); }
    a.children.forEach((child, i) => pair(child, b.children[i]));
  };
  pair(source.root, root);
  return { root, torso: copies.get(source.torso), body: copies.get(source.body), eyes: source.eyes.map(x => copies.get(x)), limbs: source.limbs.map(x => ({side:x.side,pivot:copies.get(x.pivot),hand:copies.get(x.hand)})), feet: source.feet.map(x => ({side:x.side,pivot:copies.get(x.pivot),foot:copies.get(x.foot)})), tail: copies.get(source.tail), copies };
}

// The threshold lives on the same ground and receives the same cool fill as
// Klin. The right-hinged leaf opens away from the companion's clear left lane.
function createLightPortal() {
  const group=new THREE.Group();group.name='klin-light-threshold';
  const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  const glow=new THREE.ShaderMaterial({uniforms:{time:{value:0},strength:{value:1}},vertexShader:vertex,toneMapped:false,side:THREE.DoubleSide,
    fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;
      void main(){float edge=pow(abs(vUv.x-.5)*2.,5.);float glow=exp(-pow((vUv.x-.46-sin(time*.32)*.025)/.35,2.));
      vec3 color=mix(vec3(.67,.81,.98),vec3(1.,.99,.94),glow);color+=vec3(.07,.08,.1)*(1.-edge)*strength;
      gl_FragColor=vec4(color,1.);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
  const opening=new THREE.Mesh(new THREE.PlaneGeometry(1.64,3.25),glow);opening.position.set(0,1.625,-.14);group.add(opening);
  const frame=new THREE.Group();
  const frameMaterial=new THREE.MeshStandardMaterial({color:0xd8e9f8,emissive:0xc7e5ff,emissiveIntensity:.40,roughness:.34,metalness:.06});
  for(const side of [-1,1]){const jamb=new THREE.Mesh(makeRoundedBox(.065,3.34,.22,.026),frameMaterial);jamb.position.set(side*.85,1.64,-.035);frame.add(jamb);}
  for(const y of [0,3.29]){const jamb=new THREE.Mesh(makeRoundedBox(1.76,.06,.22,.026),frameMaterial);jamb.position.set(0,y,-.035);frame.add(jamb);}group.add(frame);
  const haloMaterial=new THREE.ShaderMaterial({uniforms:{strength:{value:1}},vertexShader:vertex,fragmentShader:`
    varying vec2 vUv;uniform float strength;void main(){vec2 q=(vUv-.5)*2.;float a=exp(-dot(q*vec2(1.,.72),q*vec2(1.,.72))*3.3);float edge=1.-smoothstep(.72,1.,max(abs(q.x),abs(q.y)));gl_FragColor=vec4(vec3(.46,.64,.86),a*edge*.40*strength);}
    `,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  const halo=new THREE.Mesh(new THREE.PlaneGeometry(3.8,5.2),haloMaterial);halo.position.set(0,1.55,-.22);group.add(halo);
  const floorMaterial=new THREE.ShaderMaterial({uniforms:{strength:{value:1}},vertexShader:vertex,fragmentShader:`
    varying vec2 vUv;uniform float strength;void main(){float width=mix(.48,.17,vUv.y);float side=1.-smoothstep(width*.38,width,abs(vUv.x-.5));float along=sin(vUv.y*3.1415926);gl_FragColor=vec4(vec3(1.,.98,.91),side*along*.60*strength);}`,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  const spillPlane=new THREE.Mesh(new THREE.PlaneGeometry(4.6,4.7),floorMaterial);spillPlane.rotation.x=-Math.PI/2;spillPlane.position.set(.15,.018,2.15);group.add(spillPlane);
  const leafPivot=new THREE.Group();leafPivot.position.set(.82,0,0);leafPivot.rotation.y=1.08;
  const leaf=new THREE.Mesh(makeRoundedBox(1.62,3.26,.055,.022),new THREE.MeshStandardMaterial({color:0xd0e3f6,roughness:.30,metalness:.03,emissive:0xb3d0ec,emissiveIntensity:.17,side:THREE.DoubleSide}));leaf.position.set(-.81,1.63,0);leaf.castShadow=true;leaf.receiveShadow=true;leafPivot.add(leaf);group.add(leafPivot);
  const leafEdge=new THREE.Mesh(makeRoundedBox(.018,3.20,.066,.008),new THREE.MeshBasicMaterial({color:0xecf6ff,toneMapped:false}));leafEdge.position.set(-1.61,1.63,.003);leafPivot.add(leafEdge);
  const warmEdge=lightPlane(2.2,4.2,0xfff2d9,'halo');warmEdge.position.set(0,1.625,-.08);warmEdge.material.uniforms.strength.value=.23;group.add(warmEdge);
  const spill=new THREE.PointLight(0xfff3df,1.1,7,1.3);spill.position.set(-.15,1.3,.7);group.add(spill);
  return {group,frame,glow,spill,haloMaterial,floorMaterial,leafPivot,warmEdge};
}

// Light is the shared material of the welcome, home and travel spaces. These
// meshes use soft analytical falloffs rather than solid gems or pearl objects.
function lightPlane(width, height, color = 0xe8d8ff, mode = 'halo') {
  const material = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(color) }, strength: { value: 1 }, time: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec2 vUv;uniform vec3 tint;uniform float strength;uniform float time;
      void main(){vec2 p=(vUv-.5)*2.;float a=0.;
        ${mode === 'beam' ? `float taper=.045+.16*pow(abs(p.y),1.25);a=exp(-pow(p.x/taper,2.)*1.4)*(1.-smoothstep(.45,1.,abs(p.y)));a+=exp(-dot(p,p)*5.)*.16;` : mode === 'ring' ? `float r=length(p);a=exp(-pow((r-.52)/.025,2.))*.65+exp(-pow((r-.52)/.13,2.))*.13;` : `a=exp(-dot(p,p)*5.5)*.53+exp(-dot(p,p)*20.)*.24;`}
        gl_FragColor=vec4(tint*(1.4+strength*.8),a*strength);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.renderOrder = 3;
  return mesh;
}

function createLightChoice(kind) {
  const group = new THREE.Group(); group.name = `klin-${kind}-light`;
  const focused = kind === 'geng', color = focused ? 0xffe7bc : 0xe5d7ff;
  const aura = lightPlane(focused ? 1.30 : 1.65, focused ? 1.60 : 1.65, color);
  aura.position.set(0, .40, -.06); group.add(aura);
  const core = lightPlane(focused ? .66 : 1.40, focused ? 1.32 : 1.40, color, focused ? 'beam' : 'ring');
  core.position.set(0, .41, .02); core.rotation.z = focused ? -.22 : 0; group.add(core);
  const echo = lightPlane(1.40, 1.40, 0xffffff, focused ? 'halo' : 'ring');
  echo.position.set(0, .40, -.02); echo.scale.set(focused ? .30 : .67, focused ? .64 : .67, 1); echo.rotation.z = focused ? .44 : 0; group.add(echo);
  const floor = lightPlane(1.60, 1.60, color); floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; group.add(floor);
  const positions = [], seed = random(focused ? 119 : 397);
  for (let i = 0; i < 26; i++) { const a = seed() * TAU, r = .33 + seed() * .23; positions.push(Math.cos(a) * r, .40 + Math.sin(a) * r, (seed() - .5) * .18); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const particles = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: .022, transparent: true, opacity: .78, depthWrite: false, blending: THREE.AdditiveBlending }));
  group.add(particles);
  return { group, core, aura, echo, floor, particles, kind };
}

function shadowTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 63);
  gradient.addColorStop(0, 'rgba(112,81,57,.40)'); gradient.addColorStop(.3, 'rgba(112,81,57,.22)'); gradient.addColorStop(1, 'rgba(112,81,57,0)');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function createRoom() {
  const environment=new THREE.Group(),worlds=new THREE.Group();environment.add(worlds);
  const groups=Object.fromEntries(Object.keys(SCENE_X).map(name=>{const group=new THREE.Group();group.name=`klin-${name}`;group.position.x=SCENE_X[name];worlds.add(group);return[name,group];}));
  const field=createWarmField();worlds.add(field.group);
  const inert=()=>new THREE.Group();
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(12,12),new THREE.ShadowMaterial({opacity:.15,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
  const rug=inert(),podium=inert(),miniGround=inert(),sharedTable=inert();
  environment.add(floor,miniGround);groups.home.add(rug);groups.welcome.add(podium);groups.shared.add(sharedTable);
  const lampShade={material:{emissiveIntensity:.13}};
  const portal=createLightPortal();portal.group.visible=false;groups.porch.add(portal.group);
  const lounge=createFriendLounge(makeRoundedBox,shadowTexture());groups.porch.add(lounge.group);
  const metalChoices=new THREE.Group();groups.welcome.add(metalChoices);
  const lightChoices={geng:createLightChoice('geng'),xin:createLightChoice('xin')};
  const geng=lightChoices.geng.group,xin=lightChoices.xin.group;metalChoices.add(geng,xin);
  const sceneDepth=Object.fromEntries(Object.entries(groups).map(([name,group])=>{const depth=createWarmDepth(name);group.add(depth.group);return[name,depth];}));
  const sceneLights=Object.fromEntries(Object.entries(groups).map(([name,group])=>{
    const glow=lightPlane(name==='shared'?7:5.3,name==='shared'?7:5.3,0xffe8c5);glow.rotation.x=-Math.PI/2;glow.position.set(0,.025,.25);group.add(glow);
    const veil=lightPlane(5.4,6.0,name==='porch'?0xffecde:0xcde6ff,'ring');veil.position.set(name==='porch'?.9:-1.05,2.0,-3.0);veil.rotation.z=name==='porch'?-.27:.35;group.add(veil);
    return[name,{glow,veil}];
  }));
  // Participant identity is shown by the HTML names above the two native
  // companions. Do not duplicate it with synthetic avatar disks in the scene.
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(2.65,2.2),new THREE.MeshBasicMaterial({map:shadowTexture(),transparent:true,depthWrite:false,opacity:.12}));contact.rotation.x=-Math.PI/2;environment.add(contact);
  return{environment,worlds,groups,room:groups.home,welcome:groups.welcome,floor,rug,podium,miniGround,contact,lampShade,portal,metalChoices,choiceProps:{geng,xin},lightChoices,sceneLights,sceneDepth,sharedTable,field,lounge};
}

export function sceneForKlinPage(page) {
  if (page === 'memory') return 'memory';
  if (page === 'profile' || page === 'public-card') return 'profile';
  if (page === 'chat' || page === 'connected') return 'shared';
  if (page === 'companion') return 'companion';
  if (['relations', 'search', 'demand', 'preview', 'candidate', 'invite'].includes(page)) return 'porch';
  if (page === 'welcome' || page === 'landing' || AUTH_PAGES.has(page) || SETUP_PAGES.has(page)) return 'welcome';
  return 'home';
}

export function getKlinPageLayout(page) {
  if (HOME_PAGES.has(page)) return { x: .5, footY: .68, height: .235, world: 'home', blur: false, mini: false };
  if(page==='profile'||page==='public-card')return {x:.5,footY:.67,height:.22,world:'profile',blur:true,mini:false,character:false};
  if(page==='chat'||page==='connected')return {x:.30,footY:.55,height:.125,world:'shared',blur:false,mini:false,shared:true};
  if (page === 'landing' || page === 'onboard') return { x: .5, footY: .54, height: .245, world: 'welcome', blur: false, mini: false };
  if (page === 'initializing') return { x: .5, footY: .54, height: .235, world: 'welcome', blur: false, mini: false };
  if (page === 'welcome') return { x: .5, footY: .66, height: .30, world: 'welcome', blur: false, mini: false };
  if (AUTH_PAGES.has(page)) return { x: .85, footY: .20, height: .10, world: 'welcome', blur: true, mini: true };
  if (VISIT_PAGES.has(page)) return { x: .50, footY: .62, height: .18, world: 'porch', blur: false, mini: false, portal: false, lounge: true };
  if (SETUP_PAGES.has(page)) return { x: .85, footY: .185, height: .095, world: 'welcome', blur: true, mini: true };
  return { x: .85, footY: .18, height: .09, world: sceneForKlinPage(page), blur: true, mini: true };
}

const pageLayout = getKlinPageLayout;

function createFallback(host, reason) {
  host.dataset.world = 'fallback';
  host.dataset.worldError = String(reason?.message || reason || 'WebGL unavailable').slice(0, 180);
  // The integrator keeps its existing accessible artwork when WebGL is absent.
  const complete = options => { queueMicrotask(() => options?.onComplete?.()); return () => {}; };
  return { supported: false, ready: Promise.resolve(false), setPage() {}, setStage() {}, setLayout() {}, setConversationMode() {}, setCardPreview() {}, setParticipants() {}, setPortalState() {}, setLoungeState() {}, setActive() {}, transition(_from, _to, options) { return complete(options); }, grow(options) { return complete(options); }, signContract(options={}) { let cancelled=false;queueMicrotask(()=>{if(!cancelled){options.onSigned?.();options.onComplete?.();}});return()=>{cancelled=true;}; }, interact() {}, setReducedMotion() {}, resize() {}, dispose() { host.replaceChildren(); } };
}

/**
 * Persistent 3D world API. Pages only move one rig; they never create new models.
 * Normalised layout coordinates are relative to host/phone, with footY denoting
 * physical foot contact rather than the centre of a character image.
 */
export function createKlinWorld({ host, reducedMotion = false } = {}) {
  if (!host) throw new TypeError('createKlinWorld requires a host element.');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', stencil: false });
  } catch (error) { return createFallback(host, error); }
  host.dataset.world = 'loading';
  const canvas = renderer.domElement;
  canvas.className = 'klin-world-canvas'; canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
  host.append(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.06;
  renderer.setClearColor(palette.background, 1);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(palette.background); scene.fog = new THREE.Fog(palette.background, 15, 38);
  const camera = new THREE.OrthographicCamera(-2.2, 2.2, 4.8, -4.8, .1, 80);
  camera.position.set(0, 5.1, 13); camera.lookAt(0, 1.8, 0); camera.updateMatrixWorld();
  const hemisphere=new THREE.HemisphereLight(0xdce6ff,0xbab8d4,1.13);scene.add(hemisphere);
  // The analytical contact field avoids a hard spiky silhouette in the haze.
  const key = new THREE.DirectionalLight(0xfff6ee, 2.30); key.position.set(3.8, 7.4, 5.7); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = key.shadow.camera.bottom = -5; key.shadow.camera.right = key.shadow.camera.top = 5;
  key.shadow.camera.near = .2; key.shadow.camera.far = 28; key.shadow.bias = -.0004; key.shadow.normalBias = .015; key.shadow.radius = 7;
  key.target.position.set(0, 1, 0); scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xb9caff, .62); fill.position.set(-4, 3, 3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe0d8ff, .78); rim.position.set(1, 5, -4); scene.add(rim);
  const room = createRoom(); scene.add(room.environment);
  const awakeningField = createAwakeningField(); scene.add(awakeningField.group);
  const contractLight=createContractLight();scene.add(contractLight.group);
  const rig = createKlinRig(); scene.add(rig.root);
  const otherRig=cloneKlinRig(rig);otherRig.root.visible=false;scene.add(otherRig.root);
  // Keep the old structural rig only for motion anchors. Never show the rejected
  // procedural body while the actual source geometry is downloading.
  for(const model of [rig,otherRig])for(const child of model.root.children)child.visible=false;
  const nativeModels={primary:null,secondary:null};
  let nativeReady=false;
  const otherContact=room.contact.clone();otherContact.material=room.contact.material.clone();otherContact.visible=false;scene.add(otherContact);
  const pointer = { x: 0, y: 0 };
  const state = {
    page: 'welcome', stage: 'juvenile', growth: 0, scale: 1, yaw: 0, look: 0,
    appearanceStarted: null, appearanceShown: false,
    reduced: !!reducedMotion, active: true, disposed: false, time: 0, blink: 1, eyeOpenness: 1,
    layout: pageLayout('welcome'), position: new THREE.Vector3(), action: null,
    width: 402, height: 874, last: performance.now(), frame: 0, mode: 'welcome', blur: 0, sceneX: SCENE_X.welcome, awaitingGrowth: false,
    conversation:false, transitionPhase:'idle', participants:[{id:'you'},{id:'friend'}],activeId:'you',portalState:'idle',selectedMetal:null,lounge:{count:3,activeId:null,phase:'idle'},realm:{recognition:1,resting:false,keepsake:false,conversationPhase:null,thinking:false},echoPulseStarted:-10,contractPhase:'idle',
  };
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  let readyResolved = false;
  const unprojected = new THREE.Vector3();
  const labelAnchor = new THREE.Vector3();
  let lastLabelAnchor = '';
  const setCameraX = x => {
    if (Math.abs(camera.position.x - x) > .00001) backgroundDirty = true;
    state.sceneX = x; camera.position.x = x; camera.lookAt(x, 1.8, 0); camera.updateMatrixWorld();
    key.position.x=x+3.8;key.target.position.x=x;key.target.updateMatrixWorld();
  };
  const layoutToWorld = (layout, sceneX = room.groups[layout.world]?.position.x ?? state.sceneX) => {
    const point = new THREE.Vector3(0, 0, 0).project(camera);
    unprojected.set(layout.x * 2 - 1, 1 - layout.footY * 2, point.z).unproject(camera);
    unprojected.x += sceneX - camera.position.x;
    return { position: unprojected.clone(), scale: (camera.top - camera.bottom) * layout.height / 2.72, sceneX };
  };
  let backgroundDirty = true, horizontalDirty = true, lastBlur = -1;
  function shiftOrigin(offset){
    if(Math.abs(offset)<.00001)return;
    for(const group of Object.values(room.groups))group.position.x-=offset;
    rig.root.position.x-=offset;otherRig.root.position.x-=offset;otherContact.position.x-=offset;
    state.position.x-=offset;setCameraX(camera.position.x-offset);backgroundDirty=true;
  }
  function prepareSceneRoute(layout,direction){
    // Rebase at the current camera without changing any pixel. A distant target
    // is then placed in the adjacent slot, so a tab never crosses an empty hall.
    shiftOrigin(camera.position.x);
    const target=room.groups[layout.world];
    if(!target)return [];
    const alreadyInView=target.visible&&Math.abs(target.position.x)<SCENE_SPACING*1.25;
    if(!alreadyInView)target.position.x=direction*SCENE_SPACING;
    target.visible=true;
    const moves=[];
    let index=1;
    for(const group of Object.values(room.groups)){
      if(group===target||!group.visible)continue;
      if(Math.abs(group.position.x-camera.position.x)>SCENE_SPACING*1.7){group.visible=false;continue;}
      moves.push({group,fromX:group.position.x,toX:target.position.x-direction*SCENE_SPACING*index++});
    }
    backgroundDirty=true;return moves;
  }
  function moveScenes(moves,t){for(const move of moves||[])move.group.position.x=lerp(move.fromX,move.toX,t);}
  function settleCorner(layout,position){
    const offset=camera.position.x;
    shiftOrigin(offset);position.x-=offset;
    for(const [name,group]of Object.entries(room.groups))group.visible=name===layout.world;
    backgroundDirty=true;
  }
  // Ordinary offscreen targets are linear and Three deliberately skips tone
  // mapping while rendering into them. Preserve values above 1 through BOTH
  // passes: an 8-bit target clips the lit milk-white surfaces before the final
  // ACES pass and turns an entire bright wall into the same middle grey.
  const linearHDR = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
  const backgroundTarget = new THREE.WebGLRenderTarget(128, 256, { ...linearHDR, depthBuffer: true });
  const horizontalTarget = new THREE.WebGLRenderTarget(128, 256, { ...linearHDR, depthBuffer: false });
  const postScene = new THREE.Scene(), postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: { image: { value: backgroundTarget.texture }, stepUV: { value: new THREE.Vector2() }, referencePlate: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader: `uniform sampler2D image;uniform vec2 stepUV;uniform float referencePlate;varying vec2 vUv;
      void main(){
        vec4 color=vec4(0.0); float total=0.0;
        for(int i=-16;i<=16;i++){
          float weight=exp(-float(i*i)/72.0);
          color+=texture2D(image,vUv+stepUV*float(i))*weight;total+=weight;
        }
        color/=total;
        gl_FragColor=color;
        if(referencePlate<.5){
          #include <tonemapping_fragment>
        }
        #include <colorspace_fragment>
      }`,
    // Physical surfaces use ACES. The authored reference plate already opts
    // out of ACES, so its isolated handoff pass must preserve that same color.
    toneMapped: true, depthTest: false, depthWrite: false,
  });
  const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMaterial); postQuad.frustumCulled = false; postScene.add(postQuad);
  const updateWorldMode = layoutOrMode => {
    const layout = typeof layoutOrMode === 'string' ? { ...state.layout, world: layoutOrMode } : layoutOrMode;
    const mode = layout.world || state.mode;
    if (mode !== state.mode) { backgroundDirty = true; horizontalDirty = true; }
    state.mode = mode;
    state.blur = layout.blur ? 1 : 0;
    // All six corners exist on one fixed rail. A route changes the camera's
    // destination, never the visibility or opacity of a replacement backdrop.
    room.worlds.visible = true;
    room.miniGround.visible = !!layout.mini;
    if(state.page==='onboard')room.metalChoices.visible=true;
    else if(state.page==='welcome'||state.page==='landing')room.metalChoices.visible=false;
    // Background changes are a camera/stage response; Klin remains the same rig.
    scene.background.setHex(palette.background);scene.fog.color.setHex(palette.background);
    hemisphere.groundColor.setHex(0xc2bfd8);
    fill.color.setHex(0xd8e0ff);
  };
  const applyLayout = layout => {
    const placement = layoutToWorld(layout);
    state.layout = { ...layout }; state.position.copy(placement.position); state.scale = placement.scale;
    setCameraX(placement.sceneX);
    for(const[name,group]of Object.entries(room.groups))group.visible=name===layout.world;
    updateWorldMode(layout);
  };
  function stopAction() {
    if (!state.action) return;
    if(state.action.kind==='contract')state.contractPhase='idle';
    state.action.cancelled = true; state.action = null;
  }
  function beginAction(action) {
    stopAction(); state.action = { ...action, started: performance.now(), cancelled: false };
    const token = state.action;
    requestFrame();
    return () => {
      if (state.action !== token) return;
      if (token.kind === 'transition' || token.kind === 'layout' || token.kind === 'grow') {
        state.position.copy(rig.root.position); state.scale = rig.root.scale.x; state.yaw = rig.root.rotation.y - pointer.x * .045; state.sceneX = camera.position.x;
      }
      stopAction(); updatePose(state.time); render();
    };
  }
  function setStage(stage, { immediate = true } = {}) {
    state.stage = stage === 'adult' ? 'adult' : 'juvenile';
    if (immediate) state.growth = state.stage === 'adult' ? 1 : 0;
    updatePose(state.time); requestFrame();
  }
  function setPage(page, { stage = state.stage, immediate = false, layout: override } = {}) {
    const next = String(page || 'welcome');
    if(next!=='home'){state.conversation=false;host.dataset.conversationMode='idle';}
    const changed = next !== state.page;
    const keepGrowthStation = next === 'home' && stage === 'juvenile' && (state.awaitingGrowth || state.mode === 'welcome');
    // Content refreshes do not interrupt a glide, card handoff or growth scene.
    if (!changed && !immediate) {
      if (!state.action && stage !== state.stage) setStage(stage);
      if(override&&!state.action&&JSON.stringify({...state.layout,...override})!==JSON.stringify(state.layout))setLayout(override,{immediate:state.reduced});
      return;
    }
    if (immediate || changed) stopAction();
    state.page = next; state.awaitingGrowth = keepGrowthStation;
    if(changed){state.appearanceStarted=null;state.appearanceShown=false;}
    if(next==='landing'&&nativeReady&&!state.appearanceShown){state.appearanceStarted=state.time;state.appearanceShown=true;}
    const layout = keepGrowthStation ? {...pageLayout('onboard'),footY:.62,height:.245} : {...pageLayout(next),...(override||{})};
    setStage(stage); applyLayout(layout);
    state.yaw = 0; updatePose(state.time); requestFrame();
  }
  function setLayout(layout = {}, { immediate = true } = {}) {
    const next = { ...state.layout, ...layout };
    if (immediate) { applyLayout(next); updatePose(state.time); requestFrame(); }
    else {
      const from = { position: rig.root.position.clone(), scale: rig.root.scale.x, sceneX: camera.position.x }, to = layoutToWorld(next);
      beginAction({ kind: 'layout', duration: state.reduced ? 120 : 650, from, to, layout: next });
    }
  }
  function setCardPreview(){} // Compatibility: the host now animates its actual DOM card.
  function setConversationMode(active=false){
    const enabled=!!active&&state.page==='home';
    if(enabled===state.conversation)return;
    state.conversation=enabled;host.dataset.conversationMode=enabled?'conversation':'idle';
    if(state.page!=='home'||state.action?.kind==='transition'||state.action?.kind==='grow')return;
    setLayout(enabled?{...pageLayout('home'),footY:.37,height:.13}:pageLayout('home'),{immediate:state.reduced});
  }
  function transition(from, to, { direction = 'forward', onComplete, onCardFrame, stage = state.stage, layout: override, preserveScene = false } = {}) {
    const nextPage = String(to || 'home');
    state.conversation=false;host.dataset.conversationMode='idle';
    const presentingCard=from==='home'&&(nextPage==='profile'||nextPage==='public-card');
    const growthEntrance = nextPage === 'home' && stage === 'juvenile' && (state.mode === 'welcome' || ['landing','onboard','initializing'].includes(from));
    // A card belongs to the current room. Keep its camera, character placement
    // and background through the entire offer, including the final frame.
    const layout = presentingCard && preserveScene ? {...state.layout,blur:false} : growthEntrance ? {...pageLayout('onboard'),footY:.62,height:.245} : {...pageLayout(nextPage),...(override||{})};
    const fromWorld=sceneForKlinPage(from),toWorld=layout.world;
    const sceneDirection=Math.sign(SCENE_ORDER.indexOf(toWorld)-SCENE_ORDER.indexOf(fromWorld))||(direction==='back'||direction==='backward'?-1:1);
    // A card is offered from Klin's present location, without traveling to an
    // unrelated corner. Its growing foreground surface becomes the DOM card.
    const sceneMoves=presentingCard?[]:prepareSceneRoute(layout,sceneDirection);
    if(presentingCard){room.groups.profile.position.x=camera.position.x;room.groups.profile.visible=false;}
    const placement = layoutToWorld(layout);
    const current = { position: rig.root.position.clone(), scale: rig.root.scale.x, yaw: rig.root.rotation.y, growth: state.growth, blur: state.blur, sceneX: camera.position.x };
    if(presentingCard){placement.position.copy(current.position);placement.scale=current.scale;placement.sceneX=current.sceneX;}
    state.page = nextPage; state.stage = stage === 'adult' ? 'adult' : 'juvenile'; state.awaitingGrowth = growthEntrance;
    if(nextPage==='onboard')room.metalChoices.visible=true;
    const targetGrowth = state.stage === 'adult' ? 1 : 0;
    const driftDirection = Math.sign(placement.sceneX - current.sceneX) || (direction === 'back' || direction === 'backward' ? -1 : 1);
    const cancel=beginAction({ kind: 'transition', duration: state.reduced ? 1 : presentingCard?1850:1150, from: current, to: placement, layout, sceneMoves, fromWorld:state.mode, direction: driftDirection, targetGrowth, presentingCard, onComplete, onCardFrame });
    // The overlay disables the full-canvas CSS blur for the offering actor.
    // Draw its isolated room blur now, before the browser can paint that change.
    if(presentingCard){updatePose(state.time);render();}
    return cancel;
  }
  function signContract({onComplete,onSigned}={}){
    if(state.action?.kind==='contract')return ()=>{};
    state.contractPhase='touch';state.echoPulseStarted=state.time;
    return beginAction({kind:'contract',duration:state.reduced?650:2550,onComplete,onSigned,signed:false,fromYaw:state.yaw});
  }
  function grow({ onComplete, replay = false } = {}) {
    if(state.action?.kind==='contract')return ()=>{};
    if (replay || state.growth > .01) { state.growth = 0; state.stage = 'juvenile'; }
    const layout = { ...pageLayout('home'), x: .5 };
    const sceneMoves=prepareSceneRoute(layout,1);
    const from = { position: rig.root.position.clone(), scale: rig.root.scale.x, sceneX: camera.position.x, yaw: rig.root.rotation.y, growth: state.growth };
    const homePlacement = layoutToWorld(layout);
    // Fine white grains release the juvenile outline and gather into the native
    // adult before the companion drifts toward its home.
    state.awaitingGrowth = false; state.page = 'home';
    state.position.copy(from.position); state.scale = from.scale;
    state.layout = { ...state.layout, mini: false, blur: false }; updateWorldMode(state.layout);
    return beginAction({ kind: 'grow', duration: state.reduced ? 1 : 5200, onComplete, from, to: homePlacement, layout,sceneMoves });
  }
  function setParticipants(participants=[],{activeId}={}){
    const people=Array.isArray(participants)?participants.filter(x=>x&&x.id!=null).slice(0,2).map(x=>({id:String(x.id),name:String(x.name||'')})):[];
    if(people.length)state.participants=people;
    if(activeId!=null)state.activeId=String(activeId);
    backgroundDirty=true;requestFrame();
  }
  function setLoungeState({count=state.lounge.count,activeId=state.lounge.activeId,phase='idle'}={}){
    state.lounge={count:clamp(Number.isFinite(count)?Math.round(count):3,0,3),activeId:activeId==null?null:String(activeId),phase};backgroundDirty=true;requestFrame();
  }
  function setRealmState(value={}){
    const oldPhase=state.realm.conversationPhase,wasThinking=state.realm.thinking;
    Object.assign(state.realm,value);state.realm.recognition=clamp(Number(state.realm.recognition)||0);
    state.realm.conversationPhase=state.realm.conversationPhase==null?null:String(state.realm.conversationPhase).slice(0,48);
    state.realm.thinking=!!state.realm.thinking;
    if((oldPhase!==state.realm.conversationPhase&&state.realm.conversationPhase)||(wasThinking&&!state.realm.thinking))state.echoPulseStarted=state.time;
    // Recognition changes the living light, never the clarity of the scene.
    host.style.setProperty('--realm-focus-blur','0px');
    host.dataset.environment='reference-scene';backgroundDirty=true;requestFrame();
  }
  function setPortalState(value='idle'){state.portalState=['idle','seeking','found','open'].includes(value)?value:'idle';requestFrame();}
  function interact(kind = 'wave') {
    if(state.action?.kind==='grow'||state.action?.kind==='contract')return ()=>{};
    state.echoPulseStarted=state.time;
    if(state.action?.kind==='transition'){
      const routeAction=state.action;
      if(['geng','xin','portal','knock'].includes(kind)){routeAction.queuedInteraction=kind;if(kind==='geng'||kind==='xin')state.selectedMetal=kind;}
      return ()=>{if(routeAction.queuedInteraction===kind)delete routeAction.queuedInteraction;};
    }
    if(kind==='geng'||kind==='xin'){
      state.selectedMetal=kind;
      return beginAction({kind:'choice',choice:kind,duration:state.reduced?1:1700,fromYaw:state.yaw});
    }
    if(kind==='portal'||kind==='knock')return beginAction({kind:'portal',duration:state.reduced?1:1350,fromYaw:state.yaw});
    if (kind === 'turn') {
      return beginAction({ kind: 'turn', duration: state.reduced ? 350 : 3000, fromYaw: state.yaw });
    }
    return beginAction({ kind: kind === 'look' ? 'look' : 'wave', duration: state.reduced ? 450 : 1550, fromYaw: state.yaw });
  }
  function updatePose(time) {
    const activity = state.action;
    const elapsed = activity ? clamp((performance.now() - activity.started) / activity.duration) : 0;
    let walk = 0, wave = 0, waveLeft = 0, squat = 0, stretch = 0, lean = 0, turn = state.yaw+(state.layout.shared ? .72 : 0), step = 0,portalPulse=0;
    let scale = state.scale, evolutionProgress = null,contractProgress=null;
    let position = state.position.clone();
    if (activity) {
      if (activity.kind === 'transition' || activity.kind === 'layout') {
        const t = ease(elapsed), route = activity.kind === 'transition';
        moveScenes(activity.sceneMoves,t);
        setCameraX(lerp(activity.from.sceneX ?? state.sceneX, activity.to.sceneX ?? state.sceneX, t));
        position.lerpVectors(activity.from.position, activity.to.position, t);scale=lerp(activity.from.scale,activity.to.scale,t);
        const drift=Math.sin(Math.PI*elapsed);
        // No feet stepping: the spirit rises, follows a soft arc and settles.
        position.y+=drift*scale*(route?.30:.12);
        position.z+=drift*scale*.14;
        turn=(activity.from.yaw||0)*(1-t)+drift*(activity.direction||-1)*.20;
        lean=drift*(activity.direction||-1)*-.025;
        if(route){
          state.growth=lerp(activity.from.growth,activity.targetGrowth,smooth(elapsed));
          if(activity.presentingCard){
            position.copy(activity.from.position);position.y+=Math.sin(elapsed*Math.PI)*scale*.10;
            turn=-Math.sin(Math.PI*elapsed)*.07;wave=smooth(elapsed/.27)*(1-smooth((elapsed-.76)/.24));waveLeft=wave*.75;
            position.z-=smooth((elapsed-.76)/.24)*scale*.18;scale*=1-smooth((elapsed-.76)/.24)*.07;
            state.transitionPhase=elapsed<.25?'present-card':elapsed<.76?'offer-card':'handoff';
            // Blur only the room pass, leaving the native hands and face sharp.
            // The shader's 8px step and sigma near 6 give about a 28px blur here.
            state.blur=.60;
          }else{
            state.transitionPhase=elapsed<.24?'rise':elapsed<.78?'glide':'settle';
            if(elapsed>.44&&state.mode!==activity.layout.world)updateWorldMode(activity.layout);
            state.blur=lerp(activity.from.blur||0,activity.layout.blur?1:0,smooth(elapsed));
          }
        }
      } else if (activity.kind === 'grow') {
        const t = elapsed;
        evolutionProgress = t;
        // Fine white particles inherit both native silhouettes. The material
        // dissolves before the stage switch, then resolves from the grains.
        const gather = smooth(t / .25) * (1 - smooth((t - .50) / .22));
        const lift = smooth((t - .13) / .24) * (1 - smooth((t - .61) / .18));
        const driftingHome = smooth((t - .74) / .26);
        moveScenes(activity.sceneMoves,driftingHome);
        const crossingRooms = Math.abs(activity.to.sceneX - activity.from.sceneX) > .01;
        setCameraX(lerp(activity.from.sceneX, activity.to.sceneX, driftingHome));
        position.lerpVectors(activity.from.position, activity.to.position, driftingHome);
        scale = lerp(activity.from.scale, activity.to.scale, driftingHome);
        state.growth = smooth((t - .35) / .24);
        squat = gather * .028; stretch = Math.sin(clamp((t - .35) / .28) * Math.PI) * .018;
        position.y += lift * .17 * scale;
        const faceAlongRoute = smooth((t - .74) / .08) * (1 - smooth((t - .91) / .09));
        turn = Math.sin(t * TAU) * gather * .15 + faceAlongRoute * (crossingRooms ? .22 : .12);
        lean = Math.sin(t * Math.PI * 4) * gather * .025;
        wave = smooth((t - .62) / .10) * (1 - smooth((t - .76) / .08));
        position.y += Math.sin(clamp((t-.74)/.26)*Math.PI)*.26*scale;
        position.z += Math.sin(clamp((t - .74) / .26) * Math.PI) * .12;
        if (t > .84 && state.mode !== activity.layout.world) updateWorldMode(activity.layout);
        state.blur = 0;
        room.lampShade.material.emissiveIntensity = .13 + gather * .28;
      } else if(activity.kind==='contract'){
        contractProgress=elapsed;
        state.contractPhase=elapsed<.24?'touch':elapsed<.52?'weave':elapsed<.80?'sign':elapsed<1?'acknowledge':'sealed';
        const consent=smooth(elapsed/.30)*(1-smooth((elapsed-.82)/.18));
        wave=consent*.30;waveLeft=consent*.25;turn=Math.sin(elapsed*Math.PI)*-.07;
        if(!state.reduced)position.y+=Math.sin(elapsed*Math.PI)*scale*.045;
        state.blur=0;
        if(elapsed>=.80&&!activity.signed){activity.signed=true;queueMicrotask(()=>{if(!activity.cancelled&&!state.disposed)activity.onSigned?.();});}
      } else if (activity.kind === 'turn') {
        // Stop briefly on the right and back views before returning to the user.
        const stops = [[0, 0], [.22, Math.PI / 2], [.40, Math.PI / 2], [.57, Math.PI], [.72, Math.PI], [1, TAU]];
        let a = stops[0], b = stops[stops.length - 1];
        for (let i = 1; i < stops.length; i++) if (elapsed <= stops[i][0]) { a = stops[i - 1]; b = stops[i]; break; }
        turn = activity.fromYaw + lerp(a[1], b[1], smooth((elapsed - a[0]) / Math.max(.001, b[0] - a[0])));
        position.y+=Math.sin(Math.PI*elapsed)*.14*scale;
      } else if (activity.kind === 'look') {
        turn = Math.sin(elapsed * TAU) * .40; lean = Math.sin(elapsed * Math.PI) * .04;
      } else if(activity.kind==='choice'){
        const side=activity.choice==='geng'?-1:1;
        const reach=smooth(elapsed/.30)*(1-smooth((elapsed-.70)/.30));
        position.x+=side*scale*.40*reach;turn=side*.83*reach;
        position.y+=reach*.18*scale;
        if(side>0)wave=reach*.70;else waveLeft=reach*.70;
      } else if(activity.kind==='portal'){
        const reach=Math.sin(elapsed*Math.PI);
        position.x-=scale*.045*reach;turn=.34*reach;wave=reach*.65;
        position.y+=reach*.16*scale;portalPulse=reach;
      } else {
        wave = Math.sin(Math.PI * elapsed); turn = Math.sin(Math.PI * elapsed) * -.13;
        squat = Math.sin(elapsed * TAU) * .024;
      }
      if (elapsed >= 1) {
        if (activity.kind === 'transition' || activity.kind === 'layout') { state.position.copy(activity.to.position); state.scale = activity.to.scale; state.layout = activity.layout; setCameraX(activity.to.sceneX); updateWorldMode(activity.layout); if(activity.kind==='transition'&&!activity.presentingCard)settleCorner(activity.layout,position);state.yaw = 0;turn=activity.layout.shared ? .72 : 0; if (activity.targetGrowth != null) state.growth = activity.targetGrowth; }
        if (activity.kind === 'grow') { state.growth = 1; state.stage = 'adult'; state.position.copy(activity.to.position); state.scale = activity.to.scale; state.layout = activity.layout; state.awaitingGrowth = false; setCameraX(activity.to.sceneX); updateWorldMode(activity.layout);settleCorner(activity.layout,position); room.lampShade.material.emissiveIntensity = .13; }
        if(activity.kind==='contract')state.contractPhase='sealed';
        if (activity.kind === 'turn') state.yaw = 0;
        state.action = null;
        queueMicrotask(() => { if (!activity.cancelled && !state.disposed) {activity.onComplete?.();if(activity.queuedInteraction&&!state.action)interact(activity.queuedInteraction);} });
      }
    }
    if(!state.action)state.transitionPhase='idle';
    host.dataset.transitionPhase=state.transitionPhase;
    host.dataset.contractPhase=state.contractPhase;
    const userOrigin=layoutToWorld({x:.50,footY:.86,height:.10,world:state.mode}).position.sub(position).divideScalar(Math.max(.001,scale));userOrigin.z=1.0;
    contractLight.update({progress:contractProgress,time,position,scale,origin:userOrigin,reduced:state.reduced,pixelRatio:renderer.getPixelRatio()});
    const echoPulse=state.reduced?0:1-smooth((state.time-state.echoPulseStarted)/1.45);
    const isFirstConversation=state.page==='landing'||state.page==='onboard'||state.page==='initializing';
    let appearanceProgress=state.page==='landing'&&state.appearanceStarted!=null?clamp((time-state.appearanceStarted)/3.8):null;
    if(appearanceProgress>=1||state.reduced){state.appearanceStarted=null;appearanceProgress=null;}
    host.dataset.appearancePhase=appearanceProgress==null?'idle':appearanceProgress<.48?'gather':'reveal';
    // Lower only the doorway plate while fine white grains assemble against
    // its bright opening. UI and native colors retain their normal brightness.
    const appearanceDim=appearanceProgress==null?0:.25*smooth(appearanceProgress/.12)*(1-smooth((appearanceProgress-.57)/.30));
    host.parentElement?.style.setProperty('--klin-appearance-dim',appearanceDim.toFixed(3));
    awakeningField.update({time,position,scale,yaw:turn,growth:state.growth,progress:evolutionProgress,appearance:appearanceProgress,
      recognition:state.realm.recognition,conversation:isFirstConversation,thinking:state.realm.thinking,
      pulse:echoPulse,reduced:state.reduced,pixelRatio:renderer.getPixelRatio()});
    host.dataset.lightCurrent=evolutionProgress!=null?'white-grains':appearanceProgress!=null?'white-gather':isFirstConversation?(state.reduced?'still':state.realm.thinking?'listening':'responsive'):'rest';
    host.dataset.evolutionPhase = evolutionProgress == null ? 'idle' : evolutionProgress < .25 ? 'gather' : evolutionProgress < .48 ? 'transform' : evolutionProgress < .74 ? 'reveal' : 'arrive';
    const g = state.growth;
    const breathing = state.reduced ? 0 : (Math.sin(time * 1.32)+Math.sin(time*.71+.8)*.18) * .009;
    const settle = state.reduced ? 0 : Math.sin(time * .64+.9) * .012;
    if(!state.reduced&&!state.action){position.y+=(Math.sin(time*.94)*.025+Math.sin(time*1.81+.5)*.006)*scale;position.x+=Math.sin(time*.47)*.009*scale;turn+=Math.sin(time*.39+.6)*.035;}
    rig.root.position.copy(position); rig.root.scale.setScalar(scale); rig.root.rotation.set(0, turn + pointer.x * .045, lean);
    labelAnchor.copy(rig.root.position).project(camera);
    const anchorX=((labelAnchor.x+1)*50).toFixed(3)+'%',anchorY=((1-labelAnchor.y)*50).toFixed(3)+'%';
    if(lastLabelAnchor!==anchorX+anchorY){host.parentElement?.style.setProperty('--klin-foot-x',anchorX);host.parentElement?.style.setProperty('--klin-foot-y',anchorY);lastLabelAnchor=anchorX+anchorY;}
    rig.root.visible=nativeReady&&(!!state.action||state.layout.character!==false);
    room.contact.visible=rig.root.visible;
    room.miniGround.visible=rig.root.visible&&!!state.layout.mini;
    rig.growth = g;
    if(nativeModels.primary){
      const models=nativeModels.primary;
      const childScale=lerp(.78,1,g);
      for(const [stage,model]of Object.entries(models)){
        model.root.visible=stage===(g<.5?'juvenile':'adult');
        const normalized=2.72/(model.height||2.72);
        model.root.scale.set(normalized*childScale*(1+ squat*.11-stretch*.12-breathing*.3),normalized*childScale*(1-squat*.25+stretch+breathing),normalized*childScale);
        model.root.position.y=Math.max(0,Math.sin(step*2))*walk*.045;
        model.root.rotation.set(pointer.y*-.018,0,settle+Math.sin(step)*walk*.026);
        model.setPose?.({time,breath:breathing,lean:settle+lean,pitch:pointer.y*-.018,yaw:turn,offer:activity?.presentingCard?wave:0,waveLeft:activity?.presentingCard?0:waveLeft,waveRight:activity?.presentingCard?0:wave,lift:Math.max(0,position.y-state.position.y),reduced:state.reduced});
      }
    }
    rig.torso.position.set(0, lerp(.86, 1.12, g) - squat + Math.max(0, Math.sin(step * 2)) * walk * .028, 0);
    rig.torso.rotation.z = settle + Math.sin(step) * walk * .018;
    rig.body.scale.set(lerp(.89, 1.06, g) * (1 + squat * .26 - stretch * .20 - breathing * .4), lerp(.85, 1.04, g) * (1 - squat * .45 + stretch + breathing), lerp(.85, 1.0, g));
    rig.body.rotation.x = pointer.y * -.018;
    const blinkPhase = time % 5.1;
    const naturalBlink = blinkPhase > 4.78 && blinkPhase < 4.96 ? .14 + Math.abs((blinkPhase - 4.87) / .09) * .86 : 1;
    const waking = state.page==='landing' ? .62+state.realm.recognition*.38 : 1;
    state.eyeOpenness=state.reduced?1:lerp(state.eyeOpenness,activity?.kind==='wave'?1:waking,.08);
    const blink = state.reduced ? 1 : naturalBlink*state.eyeOpenness;
    rig.eyes.forEach(eye => { eye.scale.y = .168 * blink; });
    if(nativeModels.primary)for(const model of Object.values(nativeModels.primary))model.setBlink?.(blink);
    for (const limb of rig.limbs) {
      limb.pivot.position.set(limb.side * lerp(.72, .92, g), lerp(.65, 1.06, g) - squat, 0);
      limb.hand.scale.set(lerp(.11, .21, g), lerp(.15, .29, g), lerp(.14, .22, g));
      limb.hand.position.y = -lerp(.10, .20, g);
      let angle = limb.side * lerp(.18, .12, g);
      if (limb.side > 0) angle = lerp(angle, 2.10 + Math.sin(elapsed * Math.PI * 8) * .22, wave);
      else angle = lerp(angle+walk*Math.sin(step+Math.PI)*.22-stretch*.6,-2.05,waveLeft);
      limb.pivot.rotation.set(walk * Math.sin(step) * .32 * limb.side, 0, angle);
    }
    for (const foot of rig.feet) {
      const phase = step + (foot.side > 0 ? Math.PI : 0), swing = Math.sin(phase) * walk;
      // Each foot lifts only during its forward swing; the supporting foot is
      // pinned to the contact plane, unlike a whole-image floating bob.
      const soleHeight = lerp(.14, .30, g), footX = foot.side * lerp(.27, .35, g);
      foot.pivot.position.set(footX, soleHeight * .7075 + Math.max(0, swing) * .13 - footX * Math.sin(lean), .10 + swing * .11);
      foot.pivot.rotation.x = swing * -.20;
      foot.foot.scale.set(lerp(.20, .28, g), soleHeight, lerp(.23, .30, g));
    }
    rig.tail.position.set(0, lerp(.40, .59, g), -lerp(.69, .83, g)); rig.tail.scale.setScalar(lerp(.17, .25, g));
    room.contact.position.set(position.x, state.position.y + .018 * scale, position.z + .06 * scale);
    room.contact.scale.set(scale * lerp(.69, .94, g), scale * lerp(.62, .87, g), 1);
    // First contact floats above the cloud path. A floor contact shadow would
    // hang in the open sky at this higher dialogue placement.
    const floatsInWelcome=state.page==='landing'||state.page==='onboard'||state.page==='initializing';
    room.contact.material.opacity = floatsInWelcome?0:(state.layout.mini ? .10 : .23)/(1+Math.max(0,position.y-state.position.y)*1.6);
    room.floor.visible=!floatsInWelcome&&activity?.kind!=='grow';
    room.miniGround.position.set(position.x, position.y - .075 * scale, position.z + .05 * scale); room.miniGround.scale.set(scale * 1.17, scale, scale * .83);
    const homeBase = layoutToWorld(pageLayout('home'),room.groups.home.position.x);
    const porchBase = layoutToWorld(pageLayout('relations'),room.groups.porch.position.x);
    // The curved floor, soft seats and Klin share a physical contact plane.
    const floorY=name=>name==='porch'?porchBase.position.y:name==='shared'?layoutToWorld(pageLayout('chat'),room.groups.shared.position.x).position.y:name==='welcome'?layoutToWorld(pageLayout('landing'),room.groups.welcome.position.x).position.y:homeBase.position.y;
    // While neighboring coves share the viewport, keep their physical floors
    // coplanar. A raised lounge floor must never clip the traveling companion.
    const travelFloor=activity?.kind==='transition'&&!activity.presentingCard?lerp(floorY(activity.fromWorld),floorY(activity.layout.world),ease(elapsed)):null;
    for (const[name,group]of Object.entries(room.groups))group.position.y=travelFloor??floorY(name);
    room.floor.position.set(position.x,state.position.y-.015,position.z);
    room.rug.position.set(0, -.41, .30);
    room.field.material.uniforms.time.value=state.reduced?0:time;room.field.material.uniforms.conversation.value=state.conversation?1:0;
    if(!state.reduced)backgroundDirty=true;
    const inWelcome = state.mode === 'welcome' && !state.layout.mini && (!state.action || state.action.layout?.world === 'welcome');
    if (inWelcome) {
      const podiumHeight = .48 * scale;
      room.podium.position.set(position.x-room.groups.welcome.position.x,position.y-homeBase.position.y-podiumHeight/2,position.z+.05*scale);
      room.podium.scale.set(scale,podiumHeight,scale*.75);
    }
    key.position.x = state.sceneX + 3.8; fill.position.x = state.sceneX - 4; rim.position.x = state.sceneX + 1;
    key.target.position.set(state.sceneX, homeBase.position.y + 1, homeBase.position.z);
    const portalPlace=layoutToWorld({x:.69,footY:.67,height:.33,world:'porch'});
    room.portal.group.position.set(portalPlace.position.x-room.groups.porch.position.x,portalPlace.position.y-room.groups.porch.position.y,portalPlace.position.z-.05);
    const portalScale=(camera.top-camera.bottom)*.33/3.49;
    room.portal.group.scale.set(portalScale*.82,portalScale,portalScale);room.portal.group.rotation.y=-.10;
    room.portal.group.visible=false; // Legacy API remains; friends now gather in a lounge.
    room.lounge.group.visible=state.layout.lounge!==false;
    updateFriendLounge(room.lounge,state.lounge,state.reduced?0:time);
    room.portal.glow.uniforms.time.value=state.time;
    room.portal.glow.uniforms.strength.value=({idle:1,seeking:1.25,found:1.6,open:2}[state.portalState]||1)+portalPulse*.65;
    room.portal.spill.intensity=0;
    room.portal.haloMaterial.uniforms.strength.value=1+portalPulse*.20;
    room.portal.warmEdge.material.uniforms.strength.value=.30+(state.reduced?0:(Math.sin(time*.8)+1)*.05)+portalPulse*.18;
    room.portal.leafPivot.rotation.y=1.08+(state.reduced?0:Math.sin(time*.34)*.018)+portalPulse*.10;
    room.portal.floorMaterial.uniforms.strength.value=1+portalPulse*.25;
    for(const[name,prop]of Object.entries(room.choiceProps)){
      const at=layoutToWorld({x:name==='geng' ? .22 : .78,footY:.70,height:.07,world:'welcome'});
      prop.position.set(at.position.x-room.groups.welcome.position.x,at.position.y-room.groups.welcome.position.y,at.position.z);
      prop.scale.setScalar(state.selectedMetal===name?.64:.56);
    }
    for(const[name,light]of Object.entries(room.lightChoices)){
      const selected=state.selectedMetal===name;
      const pulse=state.reduced?0:Math.sin(time*.85+(name==='geng'?0:1.8))*.06;
      const touch=state.action?.kind==='choice'&&state.action.choice===name?Math.sin(elapsed*Math.PI)*.42:0;
      light.core.material.uniforms.strength.value=.78+(selected?.32:0)+touch+pulse;
      light.aura.material.uniforms.strength.value=.48+(selected?.22:0)+touch*.5;
      light.echo.material.uniforms.strength.value=.38+(selected?.16:0);
      light.floor.material.uniforms.strength.value=.34+(selected?.18:0);
      light.particles.rotation.z=state.reduced?0:time*(name==='geng'?.07:-.05);
      light.core.position.y=.41+(state.reduced?0:Math.sin(time*.8)*.025);
    }
    for(const[name,light]of Object.entries(room.sceneLights)){
      light.glow.material.uniforms.strength.value=0;
      light.veil.material.uniforms.strength.value=0;
      if(name==='welcome')light.glow.position.set(room.podium.position.x,room.podium.position.y+.26*scale,room.podium.position.z);
    }
    for(const depth of Object.values(room.sceneDepth))updateWarmDepth(depth,state.reduced?0:time,pointer.x,state.realm);
    updateReferenceField(room.field,{page:state.page,from:activity?.kind==='transition'?activity.fromWorld:state.mode,to:activity?.kind==='transition'?activity.layout.world:state.mode,mix:activity?.kind==='transition'?ease(elapsed):0,visit:state.lounge,keepsake:state.realm.keepsake});
    if(activity?.presentingCard&&activity.onCardFrame){
      rig.root.updateMatrixWorld(true);
      const model=nativeModels.primary?.[g<.5?'juvenile':'adult'];
      const hand=model?.getOfferAnchor?model.root.localToWorld(model.getOfferAnchor()).project(camera):new THREE.Vector3(.12,1.30,.97).multiplyScalar(scale).applyEuler(rig.root.rotation).add(position).project(camera);
      activity.onCardFrame({progress:elapsed,phase:elapsed>=.76?'handoff':state.transitionPhase,hand:{x:(hand.x+1)/2,y:(1-hand.y)/2},rotation:-.12*(1-smooth((elapsed-.25)/.55))});
    }
    const sharedAt=layoutToWorld({x:.5,footY:.55,height:.125,world:'shared'});
    const tableHeight=.42;
    room.sharedTable.position.set(0,sharedAt.position.y-homeBase.position.y-tableHeight/2,sharedAt.position.z+.12);room.sharedTable.scale.set(1,tableHeight,.63);
    otherRig.root.visible=nativeReady&&room.groups.shared.visible&&state.participants.length>1;
    otherContact.visible=otherRig.root.visible;
    if(otherRig.root.visible){
      for(const[original,copy]of otherRig.copies)if(original!==rig.root){copy.position.copy(original.position);copy.rotation.copy(original.rotation);copy.scale.copy(original.scale);}
      const at=layoutToWorld({...pageLayout('chat'),x:.72});
      otherRig.root.position.copy(at.position);otherRig.root.scale.setScalar(at.scale);otherRig.root.rotation.set(0,-.72,0);
      if(nativeModels.secondary)for(const[stage,model]of Object.entries(nativeModels.secondary)){
        model.root.visible=stage==='adult';const normalized=2.72/(model.height||2.72);
        model.root.scale.set(normalized,normalized*(1+(state.reduced?0:Math.sin(time*1.55+1.6)*.004)),normalized);
        model.root.rotation.z=state.reduced?0:Math.sin(time*.69+1.1)*.004;
        model.setPose?.({time:time+1.6,breath:state.reduced?0:Math.sin(time*1.32+1.6)*.007,lean:state.reduced?0:Math.sin(time*.64+1.8)*.009,pitch:0,yaw:0,offer:0,waveLeft:0,waveRight:0,lift:0,reduced:state.reduced});
      }
      otherRig.torso.position.set(0,1.12,0);otherRig.torso.rotation.z=state.reduced?0:Math.sin(time*.69+1.1)*.004;
      otherRig.body.scale.set(1.06,1.04*(1+(state.reduced?0:Math.sin(time*1.55+1.6)*.003)),1);
      for(const foot of otherRig.feet){foot.pivot.position.set(foot.side*.35,.30*.7075,.10);foot.pivot.rotation.set(0,0,0);foot.foot.scale.set(.28,.30,.30);}
      for(const limb of otherRig.limbs){limb.pivot.position.set(limb.side*.92,1.06,0);limb.hand.scale.set(.21,.29,.22);limb.hand.position.y=-.20;limb.pivot.rotation.set(0,0,limb.side*.12);}
      const phase=(time+2.1)%5.1,secondBlink=state.reduced?1:phase>4.78&&phase<4.96?.14+Math.abs((phase-4.87)/.09)*.86:1;
      for(const eye of otherRig.eyes)eye.scale.y=.168*secondBlink;
      if(nativeModels.secondary)for(const model of Object.values(nativeModels.secondary))model.setBlink?.(secondBlink);
      otherContact.position.set(at.position.x,at.position.y+.04,at.position.z+.06*at.scale);otherContact.scale.set(at.scale*.94,at.scale*.87,1);
    }
  }
  function render() {
    if (state.disposed || !state.active || document.hidden) return;
    if(!nativeReady){renderer.clear();return;}
    try {
      if (state.page === 'landing') {
        // The supplied empty doorway is the background. Render only the real
        // juvenile and its particles above it; no second welcome room plate.
        const background=scene.background,fog=scene.fog,environmentVisible=room.environment.visible,otherVisible=otherRig.root.visible,contactVisible=otherContact.visible;
        scene.background=null;scene.fog=null;room.environment.visible=false;otherRig.root.visible=false;otherContact.visible=false;
        renderer.setRenderTarget(null);renderer.autoClear=true;renderer.setClearColor(0x000000,0);renderer.render(scene,camera);
        scene.background=background;scene.fog=fog;room.environment.visible=environmentVisible;otherRig.root.visible=otherVisible;otherContact.visible=contactVisible;
        renderer.setClearColor(palette.background,1);backgroundDirty=true;
      } else if (state.blur > .005) {
        blurMaterial.uniforms.referencePlate.value=state.action?.presentingCard?1:0;
        const primaryVisible=rig.root.visible,miniVisible = room.miniGround.visible, contactVisible = room.contact.visible;
        if (backgroundDirty) {
          const secondVisible=otherRig.root.visible,secondContactVisible=otherContact.visible;
          rig.root.visible = false; room.miniGround.visible = false; room.contact.visible = false;
          otherRig.root.visible=false;otherContact.visible=false;
          renderer.setRenderTarget(backgroundTarget); renderer.autoClear = true; renderer.render(scene, camera);
          renderer.setRenderTarget(null); rig.root.visible = primaryVisible; room.miniGround.visible = miniVisible; room.contact.visible = contactVisible;
          otherRig.root.visible=secondVisible;otherContact.visible=secondContactVisible;
          backgroundDirty = false; horizontalDirty = true;
        }
        // Separable Gaussian blur only samples the room render. Klin and its
        // contact pad are composited after the blur with their full detail.
        if (horizontalDirty || Math.abs(lastBlur - state.blur) > .001) {
          blurMaterial.uniforms.image.value = backgroundTarget.texture;
          blurMaterial.uniforms.stepUV.value.set(8.0 * state.blur / state.width, 0);
          renderer.setRenderTarget(horizontalTarget); renderer.autoClear = true; renderer.render(postScene, postCamera); renderer.setRenderTarget(null);
          horizontalDirty = false; lastBlur = state.blur;
        }
        blurMaterial.uniforms.image.value = horizontalTarget.texture;
        blurMaterial.uniforms.stepUV.value.set(0, 8.0 * state.blur / state.height);
        renderer.autoClear = true; renderer.render(postScene, postCamera);
        const background = scene.background;
        const worldsVisible = room.worlds.visible, floorVisible = room.floor.visible;
        scene.background = null; room.worlds.visible = false; room.floor.visible = false;
        renderer.autoClear = false; renderer.clearDepth();
        const clip=!state.action&&state.layout.clip;
        if(clip){renderer.setScissor(0,state.height*(1-clip.bottom),state.width,state.height*(clip.bottom-clip.top));renderer.setScissorTest(true);}
        renderer.render(scene, camera);renderer.setScissorTest(false);renderer.autoClear = true;
        scene.background = background; room.worlds.visible = worldsVisible; room.floor.visible = floorVisible;
      } else {
        renderer.setRenderTarget(null); renderer.autoClear = true; renderer.render(scene, camera);
        // A later auxiliary page samples the current, fixed room again.
        backgroundDirty = true;
      }
      if (!readyResolved && nativeReady) { readyResolved = true; host.dataset.world = 'ready'; host.dataset.rendering = 'three-webgl-native'; resolveReady(true); }
    } catch (error) {
      host.dataset.worldError = String(error?.message || error).slice(0, 180);
      if (!readyResolved) { readyResolved = true; host.dataset.world = 'fallback'; resolveReady(false); }
    }
  }
  function tick(now) {
    state.frame = 0;
    if (state.disposed || !state.active || document.hidden) return;
    if((now-state.last)/1000<(state.action?1/60:1/30)*.92){requestFrame();return;}
    const delta = Math.min((now - state.last) / 1000, .05); state.last = now; state.time += delta;
    updatePose(state.time); render();
    if (!state.reduced || state.action) requestFrame();
  }
  function requestFrame() {
    if (!state.frame && !state.disposed && state.active && !document.hidden) state.frame = requestAnimationFrame(tick);
  }
  function resize() {
    if (state.disposed) return;
    const bounds = host.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    state.width = bounds.width; state.height = bounds.height;
    renderer.setSize(bounds.width, bounds.height, false);
    backgroundTarget.setSize(Math.max(96, Math.round(bounds.width * .4)), Math.max(128, Math.round(bounds.height * .4)));
    horizontalTarget.setSize(backgroundTarget.width, backgroundTarget.height); backgroundDirty = true; horizontalDirty = true;
    const aspect = bounds.width / bounds.height;
    room.field.material.uniforms.aspect.value=aspect;
    const vertical = 9.2;
    camera.left = -vertical * aspect / 2; camera.right = vertical * aspect / 2; camera.top = vertical / 2; camera.bottom = -vertical / 2; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    if (state.action?.layout && state.action.to) state.action.to = layoutToWorld(state.action.layout);
    if (!state.action) applyLayout(state.layout);
    updatePose(state.time); render(); requestFrame();
  }
  function setReducedMotion(value) {
    state.reduced = !!value;
    if (state.reduced && state.action) state.action.started = performance.now() - state.action.duration;
    requestFrame();
  }
  function setActive(value) {
    const next=!!value;
    if(state.disposed||state.active===next)return;
    state.active=next;host.dataset.active=String(next);
    if(!next){if(state.frame)cancelAnimationFrame(state.frame);state.frame=0;return;}
    state.last=performance.now();resize();requestFrame();
  }
  const onVisibility = () => {
    if (document.hidden) { if (state.frame) cancelAnimationFrame(state.frame); state.frame = 0; }
    else { state.last = performance.now(); requestFrame(); }
  };
  const onPointer = event => {
    if (state.reduced) return;
    const rect = host.getBoundingClientRect(); pointer.x = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -.9, .9); pointer.y = clamp((event.clientY - rect.top) / rect.height * 2 - 1, -.9, .9);
  };
  const onPointerLeave = () => { pointer.x = pointer.y = 0; };
  const onContextLost = event => {
    event.preventDefault(); host.dataset.world = 'fallback'; host.dataset.worldError = 'WebGL context lost';
    host.dispatchEvent(new CustomEvent('klinworlderror', { detail: { reason: 'context-lost' } }));
    if (state.frame) cancelAnimationFrame(state.frame); state.frame = 0;
  };
  const onContextRestored = () => { host.dataset.world = nativeReady ? 'ready' : 'loading'; if(nativeReady)host.dispatchEvent(new CustomEvent('klinworldready')); requestFrame(); };
  const observer = new ResizeObserver(resize); observer.observe(host);
  document.addEventListener('visibilitychange', onVisibility);
  host.parentElement?.addEventListener('pointermove', onPointer, { passive: true });
  host.parentElement?.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('webglcontextlost', onContextLost, false); canvas.addEventListener('webglcontextrestored', onContextRestored, false);
  applyLayout(state.layout); resize(); requestFrame();
  host.dataset.model = 'loading-native';
  Promise.all([loadNativeKlinStage('juvenile'),loadNativeKlinStage('adult'),loadNativeKlinStage('juvenile'),loadNativeKlinStage('adult'),room.field.ready]).then(([juvenile,adult,secondJuvenile,secondAdult])=>{
    if(state.disposed)return;
    nativeModels.primary={juvenile,adult};nativeModels.secondary={juvenile:secondJuvenile,adult:secondAdult};
    for(const model of Object.values(nativeModels.primary))rig.root.add(model.root);
    for(const model of Object.values(nativeModels.secondary))otherRig.root.add(model.root);
    awakeningField.setModels(nativeModels.primary);
    nativeReady=true;if(state.page==='landing'&&!state.appearanceShown){state.appearanceStarted=state.time;state.appearanceShown=true;}host.dataset.model='blender-09-07';backgroundDirty=true;updatePose(state.time);render();requestFrame();
  }).catch(error=>{
    if(state.disposed)return;
    host.dataset.model='native-load-failed';host.dataset.world='fallback';host.dataset.worldError=String(error?.message||error).slice(0,180);
    if(!readyResolved){readyResolved=true;resolveReady(false);}
    dispose();
  });
  function dispose() {
    if (state.disposed) return;
    state.disposed = true; stopAction(); awakeningField.dispose(); host.parentElement?.style.removeProperty('--klin-appearance-dim'); if (state.frame) cancelAnimationFrame(state.frame);
    observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility);
    host.parentElement?.removeEventListener('pointermove', onPointer); host.parentElement?.removeEventListener('pointerleave', onPointerLeave);
    canvas.removeEventListener('webglcontextlost', onContextLost); canvas.removeEventListener('webglcontextrestored', onContextRestored);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); for (const material of [].concat(object.material || [])) { materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); } });
    for (const geometry of geometries) geometry.dispose(); for (const texture of textures) texture.dispose(); for (const material of materials) material.dispose();
    postQuad.geometry.dispose(); blurMaterial.dispose(); backgroundTarget.dispose(); horizontalTarget.dispose(); renderer.dispose(); canvas.remove();
    if (!readyResolved) { readyResolved = true; resolveReady(false); }
  }
  return { supported: true, ready, canvas, setPage, setStage, setLayout, setConversationMode, setCardPreview, setParticipants, setPortalState, setLoungeState, setRealmState, transition, grow, signContract, interact, setReducedMotion, setActive, resize, dispose,
    // Read-only diagnostics help the host report actual rendering and growth.
    get status() { return { page: state.page, stage: state.stage, growth: state.growth, action: state.action?.kind || 'idle', rendering: host.dataset.world, world: state.mode, cameraX: state.sceneX,participants:state.participants.map(x=>x.id),portal:state.portalState,lounge:{...state.lounge,visible:state.mode==='porch'&&state.layout.lounge!==false},environment:'reference-scene',realm:{...state.realm},selectedMetal:state.selectedMetal,evolutionPhase:host.dataset.evolutionPhase,appearancePhase:host.dataset.appearancePhase,contractPhase:state.contractPhase,lightCurrent:host.dataset.lightCurrent,particleSamples:awakeningField.sampleCount,model:host.dataset.model,nativeReady,conversation:state.conversation,transitionPhase:state.transitionPhase }; },
  };
}
