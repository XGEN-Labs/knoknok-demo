import * as THREE from './vendor/three/three.module.js';

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = x => (x = clamp(x), x * x * (3 - 2 * x));
const random = seed => () => ((seed = Math.imul(1664525, seed) + 1013904223 >>> 0) / 4294967296);

// Surface samples are derived once from the two supplied native meshes. They
// are an independent render effect: no vertex, source buffer or groom changes.
export function sampleNativeSurface(root, count = 1760, seed = 24019) {
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

// A localized iridescent light wash preserves the native silhouette and eyes.
// Large orbiting bokeh shares its palette; the room never receives a flash.
// Resting and reduced-motion poses retain their original material.
export function awakeningEnvelope(progress, reduced = false) {
  if (progress == null || reduced) return { radiance: 0, scatter: 0, glow: 0, morph: progress == null ? 0 : 1 };
  const t = clamp(progress);
  const gather = smooth(t / .25);
  const radiance = smooth((t - .10) / .22) * (1 - smooth((t - .61) / .24));
  return {
    radiance,
    scatter: Math.sin(clamp((t - .08) / .72) * Math.PI) * .18,
    glow: gather * (1 - smooth((t - .73) / .22)),
    morph: smooth((t - .35) / .24),
  };
}

export function createAwakeningField() {
  const group = new THREE.Group(); group.name = 'klin-native-echo-currents'; group.visible = false;
  const count = 1760, rng = random(42199), geometry = new THREE.BufferGeometry();
  const empty = new Float32Array(count * 3), seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) seeds.set([rng(), rng(), rng(), rng()], i * 4);
  geometry.setAttribute('position', new THREE.BufferAttribute(empty, 3));
  geometry.setAttribute('adultPosition', new THREE.BufferAttribute(empty.slice(), 3));
  geometry.setAttribute('echoSeed', new THREE.BufferAttribute(seeds, 4));
  const uniforms = {
    time: { value: 0 }, morph: { value: 0 }, scatter: { value: 0 }, strength: { value: 0 },
    recognition: { value: 0 }, pulse: { value: 0 }, evolving: { value: 0 }, reduced: { value: 0 },
    pixelRatio: { value: 1 }, radiance: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false,
    depthTest: false, blending: THREE.NormalBlending, toneMapped: false,
    vertexShader: `attribute vec3 adultPosition;attribute vec4 echoSeed;
      uniform float time;uniform float morph;uniform float scatter;uniform float strength;uniform float recognition;
      uniform float pulse;uniform float evolving;uniform float reduced;uniform float pixelRatio;
      varying vec3 echoColor;varying float echoOpacity;varying float bokeh;
      void main(){
        vec3 body=mix(position*.78,adultPosition,morph);
        float t=time*(1.-reduced),angle=echoSeed.x*6.2831853+t*(.20+echoSeed.w*.30);
        vec3 direction=vec3(cos(angle),sin(angle*.7+echoSeed.z*4.)*.45,sin(angle));
        float orbit=(.055+.12*(1.-recognition)+pulse*.12)*(1.-evolving);
        vec3 p=body+direction*(orbit+scatter*(.12+echoSeed.y*.70));
        p.y+=sin(t*.85+echoSeed.z*6.28)*(.025+scatter*.12)*(1.-reduced);
        // The visible current lives close to the body, away from the text lane.
        float dust=step(.945,echoSeed.w);
        p+=dust*vec3(cos(angle)*(.25+scatter*.45),sin(angle*.6)*.28,sin(angle)*.18)*mix(1.,.15,evolving);
        vec2 contour=normalize(body.xy-vec2(0.,1.3)+vec2(.001));
        p.xy+=contour*(.10+dust*.24)*(1.-evolving);
        // A few deliberate light beads trace the outside of the native form.
        // Their elliptical lane never crosses the eyes or the central face.
        float lightBead=step(.989,echoSeed.w);
        float beadAngle=echoSeed.x*6.2831853+t*.72+pulse*.70;
        float radiusX=mix(1.08,1.39,morph)*(1.+pulse*.08);
        float radiusY=mix(.91,1.15,morph);
        vec3 beadPosition=vec3(cos(beadAngle)*radiusX,mix(1.08,1.36,morph)+sin(beadAngle)*radiusY,.35+sin(beadAngle)*.16);
        p=mix(p,beadPosition,lightBead*(1.-evolving));
        vec3 lilac=vec3(.40,.30,.85),pearl=vec3(.95,.86,.70),blue=vec3(.30,.55,.95),peach=vec3(1.,.50,.28);
        echoColor=mix(mix(lilac,blue,echoSeed.y),mix(pearl,peach,echoSeed.y),smoothstep(.53,.91,echoSeed.z));
        // Adjacent clusters share broad travelling color fields. Random color
        // per grain would mix into pale powder instead of layered light.
        // Linear equivalents of #5485ff, #9876f5, #ffad84 and #ffe0a8.
        // These remain colored against a bright cloud scene, without a white
        // additive flash. Most of the body stays cool; warm patches travel.
        vec3 growthBlue=vec3(.08866,.23455,1.),growthLilac=vec3(.314,.1812,.9131);
        vec3 growthPeach=vec3(1.,.4179,.2307),growthPearl=vec3(1.,.7454,.3916);
        vec3 beadColor=mix(mix(growthBlue,growthLilac,echoSeed.y),mix(growthPeach,growthPearl,echoSeed.y),step(.58,echoSeed.z));
        echoColor=mix(echoColor,beadColor,lightBead*(1.-evolving));
        float wash=.5+.5*sin(body.y*2.4+body.x*2.1+t*.72);
        float cool=.5+.5*sin(body.x*2.6+body.y*2.0-t*.51);
        float warmth=smoothstep(.55,.98,.5+.5*sin(body.y*2.0+body.x*4.5+t*.58))*.72;
        vec3 luminous=mix(mix(growthBlue,growthLilac,cool),mix(growthPearl,growthPeach,wash),warmth);
        echoColor=mix(echoColor,luminous,evolving);
        float naturalVisible=max(max(1.-step(.25,echoSeed.x),dust*.88),lightBead);
        float flicker=.78+.22*sin(t*(.8+echoSeed.x)+echoSeed.z*12.);
        float core=1.-.76*(1.-smoothstep(.27,.52,abs(body.x)))*step(.70,body.y)*(1.-step(2.04,body.y));
        // During growth, a small subset becomes large overlapping light
        // clusters. Rendering every surface sample as fine dust looks noisy.
        float clusterVisible=1.-step(.30,echoSeed.x);
        float naturalOpacity=naturalVisible*.68*core;
        naturalOpacity=mix(naturalOpacity,.20+pulse*.62,lightBead);
        // The light wash belongs to the actual mesh. Keep the surface current
        // translucent so its native fleece and luminous eyes remain readable.
        echoOpacity=strength*mix(naturalOpacity,clusterVisible*.19,evolving)*flicker;
        bokeh=max(max(dust,lightBead),evolving);
        float fineSize=mix(2.1+echoSeed.y*2.,10.+echoSeed.y*13.,evolving);
        float cloudSize=mix(11.+echoSeed.y*12.,30.+echoSeed.y*20.,evolving);
        float pointSize=mix(fineSize,cloudSize,dust);
        pointSize=mix(pointSize,mix(5.+echoSeed.y*4.,10.+echoSeed.y*10.,pulse),lightBead*(1.-evolving));
        gl_PointSize=pointSize*pixelRatio*(.78+evolving*.30+pulse*.08);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `varying vec3 echoColor;varying float echoOpacity;varying float bokeh;
      void main(){vec2 p=gl_PointCoord*2.-1.;float d=dot(p,p);if(d>1.)discard;
        float soft=exp(-d*mix(3.8,2.8,bokeh))*(1.-smoothstep(.65,1.,d));
        float skirt=exp(-d*1.5)*(1.-smoothstep(.20,1.,d))*.20*bokeh;
        float alpha=echoOpacity*(soft+skirt)*mix(1.,.82,bokeh);if(alpha<.003)discard;
        gl_FragColor=vec4(echoColor,alpha);
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geometry, material); points.frustumCulled = false; points.renderOrder = 2; group.add(points);
  // Sparse additive lenses sit outside the silhouette. Unlike opaque surface
  // stamps, their bright centers and long skirts read as emitted light while
  // leaving the character's face and material unobscured.
  const lensCount = 64, lensGeometry = new THREE.BufferGeometry(), lensSeeds = new Float32Array(lensCount * 4);
  for (let i = 0; i < lensCount; i++) lensSeeds.set([rng(), rng(), rng(), rng()], i * 4);
  lensGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lensCount * 3), 3));
  lensGeometry.setAttribute('lensSeed', new THREE.BufferAttribute(lensSeeds, 4));
  const lensMaterial = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false,
    depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `attribute vec4 lensSeed;
      uniform float time;uniform float morph;uniform float strength;uniform float evolving;uniform float reduced;uniform float pixelRatio;
      varying vec3 lensColor;varying float lensOpacity;
      void main(){
        float t=time*(1.-reduced),angle=lensSeed.x*6.2831853+t*(.36+lensSeed.w*.32);
        float rx=mix(1.18,1.52,morph)+lensSeed.y*.30;
        float ry=mix(.94,1.18,morph)+lensSeed.z*.22;
        vec3 p=vec3(cos(angle)*rx,mix(1.10,1.40,morph)+sin(angle)*ry,.48+sin(angle)*.25);
        // The lower current arcs around the feet, not across the eyes.
        float lower=step(.69,lensSeed.w);
        vec3 footArc=vec3(cos(angle)*(1.45+lensSeed.y*.35),.18+sin(angle)*.22+lensSeed.z*.28,.72+sin(angle)*.28);
        p=mix(p,footArc,lower);
        vec3 cool=mix(vec3(.20,.50,1.65),vec3(.95,.35,1.45),lensSeed.y);
        vec3 warm=mix(vec3(1.60,.62,.22),vec3(1.55,1.20,.50),lensSeed.y);
        lensColor=mix(cool,warm,step(.56,lensSeed.z));
        float flicker=.72+.28*sin(t*(1.1+lensSeed.y)+lensSeed.z*9.);
        lensOpacity=evolving*strength*(.26+lensSeed.z*.19)*flicker*(1.-reduced);
        gl_PointSize=(22.+lensSeed.y*38.)*pixelRatio*(.76+strength*.30);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader: `varying vec3 lensColor;varying float lensOpacity;
      void main(){vec2 p=gl_PointCoord*2.-1.;float d=dot(p,p);if(d>1.)discard;
        float edge=1.-smoothstep(.48,1.,d);
        float core=exp(-d*18.);
        float halo=exp(-d*4.0)*.42;
        float skirt=exp(-d*1.4)*.10;
        float alpha=lensOpacity*(core+halo+skirt)*edge;if(alpha<.001)discard;
        gl_FragColor=vec4(lensColor,alpha);
        #include <colorspace_fragment>
      }`,
  });
  const lenses = new THREE.Points(lensGeometry, lensMaterial);
  lenses.name = 'klin-growth-orbit-lenses'; lenses.frustumCulled = false; lenses.renderOrder = 3; group.add(lenses);
  const patched = new Set();
  function setModels(models) {
    if (!models?.juvenile || !models?.adult) return;
    geometry.setAttribute('position', new THREE.BufferAttribute(sampleNativeSurface(models.juvenile.root, count, 24019), 3));
    geometry.setAttribute('adultPosition', new THREE.BufferAttribute(sampleNativeSurface(models.adult.root, count, 24019), 3));
    for (const model of Object.values(models)) model.root.traverse(object => {
      for (const mat of [].concat(object.material || [])) {
        if (patched.has(mat)) continue;
        patched.add(mat);
        const previous = mat.onBeforeCompile, isEye = /eye/i.test(object.name);
        mat.onBeforeCompile = shader => {
          previous?.(shader);
          shader.uniforms.echoRadiance = uniforms.radiance;
          shader.uniforms.echoTime = uniforms.time;
          shader.vertexShader = 'varying vec3 echoWorld;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
            'echoWorld=(modelMatrix*vec4(transformed,1.)).xyz;\n#include <project_vertex>');
          shader.fragmentShader = 'uniform float echoRadiance;uniform float echoTime;varying vec3 echoWorld;\n' + shader.fragmentShader;
          // Preserve the actual native surface and eyes. Moving iridescence is
          // light layered onto that surface, never grain that deletes it.
          shader.fragmentShader = shader.fragmentShader.replace('#include <tonemapping_fragment>', `${isEye ? `
            vec3 eyeLight=mix(vec3(.25,1.05,1.55),vec3(1.6,1.1,.50),.5+.5*sin(echoTime+echoWorld.x*3.));
            gl_FragColor.rgb=mix(gl_FragColor.rgb,eyeLight,echoRadiance*.82);
          ` : `
            vec3 q=echoWorld*2.5;
            float flow=.5+.5*sin(q.y*2.1+q.x*2.8-echoTime*1.8);
            float warmth=smoothstep(.30,.85,.5+.5*sin(q.x*2.4-q.y*1.6+echoTime*1.4));
            vec3 cold=mix(vec3(.08,.45,2.6),vec3(.85,.13,2.0),flow);
            vec3 warm=mix(vec3(2.5,.40,.13),vec3(2.2,1.55,.35),flow);
            vec3 livingLight=mix(cold,warm,warmth*.85);
            float ripple=.88+.12*sin(q.z*3.+q.y*4.-echoTime*2.);
            gl_FragColor.rgb=mix(gl_FragColor.rgb,livingLight*ripple,echoRadiance*.92);
          `}
          #include <tonemapping_fragment>`);
        };
        mat.customProgramCacheKey = () => `klin-living-iridescence-v2-${isEye ? 'eye' : 'fleece'}`;
        mat.needsUpdate = true;
      }
    });
    geometry.computeBoundingSphere();
  }
  function update({ time = 0, position, scale = 1, yaw = 0, growth = 0, progress = null,
    recognition = 1, conversation = false, thinking = false, pulse = 0, reduced = false, pixelRatio = 1 } = {}) {
    const envelope = awakeningEnvelope(progress, reduced), growing = progress != null;
    group.visible = (growing || conversation) && patched.size > 0;
    if (position) group.position.copy(position);
    group.scale.setScalar(scale); group.rotation.y = yaw;
    uniforms.time.value = reduced ? 0 : time;
    uniforms.reduced.value = reduced ? 1 : 0;
    uniforms.morph.value = growing ? envelope.morph : clamp(growth);
    uniforms.scatter.value = envelope.scatter;
    uniforms.strength.value = reduced ? .34 : growing ? envelope.glow : .62 + (thinking ? .12 : 0) + pulse * .30;
    uniforms.recognition.value = clamp(recognition);
    uniforms.pulse.value = reduced ? 0 : clamp(pulse);
    uniforms.evolving.value = growing && !reduced ? 1 : 0;
    uniforms.radiance.value = envelope.radiance;
    uniforms.pixelRatio.value = pixelRatio;
  }
  return { group, setModels, update, uniforms, get sampleCount() { return patched.size ? count : 0; } };
}
