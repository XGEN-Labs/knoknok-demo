import * as THREE from './vendor/three/three.module.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => (x = clamp(x), x * x * (3 - 2 * x));
const random = seed => () => ((seed = Math.imul(1664525, seed) + 1013904223 >>> 0) / 4294967296);

// Surface samples are derived once from the two supplied native meshes. They
// are an independent render effect: no vertex, source buffer or groom changes.
export function sampleNativeSurface(root, count = 7200, seed = 24019) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), parts = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  let total = 0;
  root.traverse(mesh => {
    if (!mesh.isMesh || /eye/i.test(mesh.name) || !mesh.geometry?.attributes.position) return;
    const p = mesh.geometry.attributes.position, indices = mesh.geometry.index;
    const faces = Math.floor((indices?.count || p.count) / 3), areas = new Float64Array(faces);
    const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld);
    let area = 0;
    for (let face = 0; face < faces; face++) {
      const index = face * 3;
      a.fromBufferAttribute(p, indices ? indices.getX(index) : index).applyMatrix4(matrix);
      b.fromBufferAttribute(p, indices ? indices.getX(index + 1) : index + 1).applyMatrix4(matrix);
      c.fromBufferAttribute(p, indices ? indices.getX(index + 2) : index + 2).applyMatrix4(matrix);
      area += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * .5;
      areas[face] = area;
    }
    if (area > 0) { total += area; parts.push({ p, indices, areas, matrix, area, end: total }); }
  });
  const positions = new Float32Array(count * 3), rng = random(seed);
  if (!total) return positions;
  for (let i = 0; i < count; i++) {
    const target = rng() * total, part = parts.find(p => p.end >= target) || parts.at(-1);
    const faceTarget = rng() * part.area;
    let lo = 0, hi = part.areas.length - 1;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (part.areas[mid] < faceTarget) lo = mid + 1; else hi = mid; }
    const face = lo * 3, { p, indices, matrix } = part;
    a.fromBufferAttribute(p, indices ? indices.getX(face) : face).applyMatrix4(matrix);
    b.fromBufferAttribute(p, indices ? indices.getX(face + 1) : face + 1).applyMatrix4(matrix);
    c.fromBufferAttribute(p, indices ? indices.getX(face + 2) : face + 2).applyMatrix4(matrix);
    const u = Math.sqrt(rng()), v = rng();
    a.multiplyScalar(1 - u).addScaledVector(b, u * (1 - v)).addScaledVector(c, u * v);
    positions.set([a.x, a.y, a.z], i * 3);
  }
  return positions;
}

// Fine white surface grains become the actual native outline, briefly loosen,
// and gather into the next native shape. The effect has no light wash or halo.
export function awakeningEnvelope(progress, reduced = false, appearance = false) {
  if (progress == null || reduced) return { scatter: 0, strength: 0, morph: 0, juvenile: 1, adult: 1 };
  const t = clamp(Number.isFinite(progress) ? progress : 0);
  if (appearance) return {
    scatter: (1 - smooth(t / .58)) * .90,
    strength: smooth(t / .12) * (1 - smooth((t - .72) / .28)),
    morph: 0,
    juvenile: smooth((t - .48) / .38), adult: 1,
  };
  return {
    scatter: Math.sin(smooth((t - .16) / .52) * Math.PI) * .60,
    strength: smooth((t - .03) / .20) * (1 - smooth((t - .68) / .20)),
    morph: smooth((t - .32) / .30),
    juvenile: 1 - smooth((t - .06) / .22),
    adult: smooth((t - .60) / .20),
  };
}

export function createAwakeningField({ count = 7200 } = {}) {
  const group = new THREE.Group(); group.name = 'klin-native-white-grains'; group.visible = false;
  count = Math.max(1, Math.min(12000, Math.round(Number(count) || 7200)));
  const rng = random(42199), geometry = new THREE.BufferGeometry();
  const empty = new Float32Array(count * 3), seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) seeds.set([rng(), rng(), rng(), rng()], i * 4);
  geometry.setAttribute('position', new THREE.BufferAttribute(empty, 3));
  geometry.setAttribute('adultPosition', new THREE.BufferAttribute(empty.slice(), 3));
  geometry.setAttribute('echoSeed', new THREE.BufferAttribute(seeds, 4));
  const uniforms = {
    time: { value: 0 }, morph: { value: 0 }, scatter: { value: 0 }, strength: { value: 0 },
    pixelRatio: { value: 1 }, juvenile: { value: 1 }, adult: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false,
    depthTest: false, blending: THREE.NormalBlending, toneMapped: false,
    vertexShader: `attribute vec3 adultPosition;attribute vec4 echoSeed;
      uniform float time;uniform float morph;uniform float scatter;uniform float strength;uniform float pixelRatio;
      varying float grainOpacity;
      void main(){
        vec3 body=mix(position*.78,adultPosition,morph);
        float angle=echoSeed.x*6.2831853;
        vec3 direction=vec3(cos(angle),echoSeed.z*2.-1.,sin(angle));
        // Small outward curls, attached to each sampled point, preserve the
        // native silhouette. There is no sphere, orbit lane or falling snow.
        vec3 curl=vec3(sin(time*.65+echoSeed.z*9.),cos(time*.48+echoSeed.x*7.),sin(time*.41+echoSeed.y*11.));
        vec3 p=body+scatter*(direction*(.35+echoSeed.y*.72)+curl*.16);
        p.y+=scatter*(echoSeed.w-.5)*.34;
        float flicker=.84+.16*sin(time*(.8+echoSeed.x)+echoSeed.z*12.);
        grainOpacity=strength*(.68+echoSeed.z*.30)*flicker;
        // CSS-pixel grains remain fine on retina screens; no bokeh pass.
        gl_PointSize=(1.0+echoSeed.y*1.10)*pixelRatio;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `varying float grainOpacity;
      void main(){vec2 p=gl_PointCoord*2.-1.;float d=dot(p,p);if(d>1.)discard;
        float alpha=grainOpacity*(1.-smoothstep(.30,1.,d));if(alpha<.004)discard;
        gl_FragColor=vec4(vec3(.98),alpha);
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'native-surface-white-particles'; points.frustumCulled = false; points.renderOrder = 2; group.add(points);
  const patched = new Map();
  let hasModels = false, disposed = false;
  function restoreMaterials() {
    for (const [mat, previous] of patched) {
      mat.onBeforeCompile = previous.compile;
      mat.customProgramCacheKey = previous.cache;
      mat.needsUpdate = true;
    }
    patched.clear();
  }
  function setModels(models) {
    if (disposed || !models?.juvenile || !models?.adult) return;
    restoreMaterials();
    geometry.setAttribute('position', new THREE.BufferAttribute(sampleNativeSurface(models.juvenile.root, count, 24019), 3));
    geometry.setAttribute('adultPosition', new THREE.BufferAttribute(sampleNativeSurface(models.adult.root, count, 24019), 3));
    for (const [stage, model] of Object.entries(models)) model.root.traverse(object => {
      for (const mat of [].concat(object.material || [])) {
        if (patched.has(mat)) continue;
        const previous = { compile: mat.onBeforeCompile, cache: mat.customProgramCacheKey };
        patched.set(mat, previous);
        mat.onBeforeCompile = function(shader, renderer) {
          previous.compile?.call(this, shader, renderer);
          shader.uniforms.nativeSurfaceVisibility = uniforms[stage];
          shader.vertexShader = 'varying vec3 nativeGrainPosition;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
            'nativeGrainPosition=transformed;\n#include <project_vertex>');
          shader.fragmentShader = 'uniform float nativeSurfaceVisibility;varying vec3 nativeGrainPosition;\n' + shader.fragmentShader;
          // Discard small patches of body, eyes and the matching native groom.
          // At visibility 1 the original shader executes with identical pixels.
          shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `
            if(nativeSurfaceVisibility<.9999){
              vec3 cell=floor(nativeGrainPosition*112.);
              float grain=fract(sin(dot(cell,vec3(12.9898,78.233,37.719)))*43758.5453);
              if(nativeSurfaceVisibility<=0.||grain>nativeSurfaceVisibility)discard;
            }
            #include <alphatest_fragment>`);
        };
        mat.customProgramCacheKey = () => `klin-white-grain-dissolve-v1-${stage}-${previous.cache?.call(mat) || ''}`;
        mat.needsUpdate = true;
      }
    });
    geometry.computeBoundingSphere(); hasModels = true;
  }
  function update({ time = 0, position, scale = 1, yaw = 0, growth = 0, progress = null,
    appearance = null, reduced = false, pixelRatio = 1 } = {}) {
    if (disposed) return;
    const appearing = progress == null && appearance != null;
    const envelope = awakeningEnvelope(appearing ? appearance : progress, reduced, appearing);
    group.visible = hasModels && !reduced && (progress != null || appearing) && envelope.strength > 0;
    if (position) group.position.copy(position);
    group.scale.setScalar(scale); group.rotation.y = yaw;
    uniforms.time.value = reduced ? 0 : time;
    uniforms.morph.value = progress != null && !reduced ? envelope.morph : appearing ? 0 : clamp(growth);
    uniforms.scatter.value = envelope.scatter;
    uniforms.strength.value = envelope.strength;
    uniforms.juvenile.value = envelope.juvenile;
    uniforms.adult.value = envelope.adult;
    uniforms.pixelRatio.value = Math.max(1, Math.min(2, pixelRatio));
  }
  function dispose() {
    if (disposed) return;
    disposed = true; uniforms.juvenile.value = uniforms.adult.value = 1;
    restoreMaterials(); group.visible = false; group.remove(points); group.removeFromParent();
    geometry.dispose(); material.dispose(); hasModels = false;
  }
  return { group, setModels, update, dispose, uniforms, get sampleCount() { return hasModels ? count : 0; } };
}
