import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';

// v16 adult: original continuous skinned mesh plus sampled native CURVES paths.
// This replacement package contains the adult only. Web hair uses lit lines,
// not the offline Cycles renderer; both skin and hair follow the same skeleton.
const SOURCE = Object.freeze({
  adult: {
    mesh: new URL('./assets/klin-native-v16-20261022/adult.glb?v=convex-oval-paws-face-v16', import.meta.url),
    hair: new URL('./assets/klin-native-v16-20261022/adult-hair.bin?v=convex-oval-paws-face-v16', import.meta.url),
  },
});
const MANIFEST = new URL('./assets/klin-native-v16-20261022/native-model-manifest.json?v=convex-oval-paws-face-v16', import.meta.url);
const sourceCache = new Map();
const HEIGHT = 2.72;
let manifestPromise;
const fetchChecked = async url => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Native Klin asset failed: ${response.status}`);
  return response;
};
async function getSource(stage) {
  if (!sourceCache.has(stage)) {
    manifestPromise ||= fetchChecked(MANIFEST).then(response => response.json());
    const loading = Promise.all([
      new GLTFLoader().loadAsync(SOURCE[stage].mesh.href),
      fetchChecked(SOURCE[stage].hair).then(response => response.arrayBuffer()),
      manifestPromise,
    ]).then(async ([gltf, bytes, manifest]) => {
      const metadata = manifest.stages[stage];
      const skinValues = metadata.hairSkinFile ? new Float32Array(await fetchChecked(new URL(metadata.hairSkinFile + '?v=convex-oval-paws-face-v16', MANIFEST)).then(response => response.arrayBuffer())) : null;
      const values = new Float32Array(bytes), groups = new Map();
      if (values.length % 6 || (skinValues && skinValues.length !== values.length / 6 * 8)) throw new Error('Klin hair buffer stride mismatch');
      for (const groom of metadata.grooms) {
        if (!Number.isSafeInteger(groom.offset) || !Number.isSafeInteger(groom.count) || groom.offset < 0 || groom.count < 0 || groom.count % 2 || (groom.offset + groom.count) * 6 > values.length) throw new Error('Klin groom range invalid');
        const geometry = new THREE.BufferGeometry();
        const data = new THREE.InterleavedBuffer(values.subarray(groom.offset * 6, (groom.offset + groom.count) * 6), 6);
        geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(data, 3, 0));
        geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(data, 3, 3));
        if (skinValues) {
          const weights = new THREE.InterleavedBuffer(skinValues.subarray(groom.offset * 8, (groom.offset + groom.count) * 8), 8);
          geometry.setAttribute('skinIndex', new THREE.InterleavedBufferAttribute(weights, 4, 0));
          geometry.setAttribute('skinWeight', new THREE.InterleavedBufferAttribute(weights, 4, 4));
        }
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        if (!groups.has(groom.mesh)) groups.set(groom.mesh, []);
        groups.get(groom.mesh).push({ geometry, name: groom.name, undercoat: groom.undercoat });
      }
      return { mesh: gltf.scene, hairGroups: groups, metadata, manifest };
    }).catch(error => { sourceCache.delete(stage); throw error; });
    sourceCache.set(stage, loading);
  }
  return sourceCache.get(stage);
}

// Clone the full hierarchy first, then remap skeleton references to its bones.
// Mesh geometry stays cached; every instance owns its bones, materials and GPU
// bone textures. The same bone-remapping mechanism is used by SkeletonUtils.
function cloneSkeletonHierarchy(source) {
  const clone = source.clone(true), lookup = new Map();
  const pair = (a, b) => { lookup.set(a, b); a.children.forEach((child, i) => pair(child, b.children[i])); };
  pair(source, clone);
  source.traverse(original => {
    if (!original.isSkinnedMesh) return;
    const mesh = lookup.get(original);
    mesh.skeleton = original.skeleton.clone();
    mesh.skeleton.bones = original.skeleton.bones.map(bone => {
      const copied = lookup.get(bone);
      if (!copied) throw new Error('Klin skeleton bone is outside the cloned model');
      return copied;
    });
    mesh.bindMatrix.copy(original.bindMatrix);
    mesh.bindMatrixInverse.copy(original.bindMatrixInverse);
  });
  return clone;
}

// This local Three build tests isSkinnedMesh for shader skinning/bone updates,
// and isLineSegments for GL_LINES. Keep isMesh false so the native line data is
// never submitted as triangles. Attached binding matches Three.SkinnedMesh.
class SkinnedLineSegments extends THREE.LineSegments {
  constructor(geometry, material, emitter) {
    super(geometry, material);
    this.isSkinnedMesh = true;
    this.skeleton = emitter.skeleton;
    this.bindMatrix = emitter.bindMatrix.clone();
    this.bindMatrixInverse = emitter.bindMatrixInverse.clone();
    this.bindMode = emitter.bindMode;
    this.frustumCulled = false;
  }
  updateMatrixWorld(force) {
    super.updateMatrixWorld(force);
    this.bindMatrixInverse.copy(this.bindMode === 'detached' ? this.bindMatrix : this.matrixWorld).invert();
  }
}

const canonicalBoneName = bone => bone.userData.name || bone.name;
const clamp = THREE.MathUtils.clamp;

async function loadRiggedAdultStage() {
  const source = await getSource('adult');
  if (source.metadata.poseType !== 'rigged-v16' || !source.metadata.hairSkinFile) throw new Error('The v16 adapter requires its matching adult manifest and hair skin data');
  const root = new THREE.Group(); root.name = 'klin-native-adult-v16';
  const normalized = new THREE.Group(); normalized.name = 'native-coordinate-normalization';
  const model = cloneSkeletonHierarchy(source.mesh), meshes = [];
  model.traverse(object => { if (object.isMesh) meshes.push(object); });
  const body = meshes.find(mesh => /OneContinuousBody/.test(mesh.name));
  if (!body?.isSkinnedMesh) throw new Error('v16 continuous body or skeleton is missing');
  const names = body.skeleton.bones.map(canonicalBoneName);
  if (JSON.stringify(names) !== JSON.stringify(source.metadata.skinJointNames)) throw new Error('v16 hair joint order does not match the GLB skeleton');
  const bones = new Map(body.skeleton.bones.map(bone => [canonicalBoneName(bone), bone]));
  for (const name of ['upper_arm.L', 'upper_arm.R', 'forearm.L', 'forearm.R', 'hand.L', 'hand.R', 'eye.L', 'eye.R', 'tail_root']) {
    if (!bones.has(name)) throw new Error('v16 pose bone missing: ' + name);
  }
  // All three mesh skins refer to the same original armature. The GLTF loader
  // can materialize independent Skeleton objects; consolidate the cloned body
  // skeleton so their GPU matrix textures and matching hair update together.
  for (const mesh of meshes) {
    if (mesh.isSkinnedMesh && JSON.stringify(mesh.skeleton.bones.map(canonicalBoneName)) === JSON.stringify(names)) mesh.skeleton = body.skeleton;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(material => material.clone()) : mesh.material.clone();
    const isEye = /InsetEye/.test(mesh.name);
    if (!isEye) {
      for (const material of [].concat(mesh.material)) {
        // Use the existing Demo's pale substrate for its sampled strand LOD.
        // Eye material remains the exported v16 polished shallow-eye material.
        material.color.set('#eee4df'); material.roughness = .94; material.metalness = 0;
        material.emissive?.set(0); material.emissiveIntensity = 0;
      }
    }
    mesh.userData.nativeKlin = true;
  }
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model), center = bounds.getCenter(new THREE.Vector3());
  const nativeHeight = bounds.max.y - bounds.min.y, scale = HEIGHT / nativeHeight;
  if (!(nativeHeight > 0 && Number.isFinite(nativeHeight))) throw new Error('v16 model bounds invalid');
  const hairObjects = [];
  for (const mesh of meshes) {
    for (const groom of source.hairGroups.get(mesh.userData.name || mesh.name) || []) {
      if (!groom.geometry.getAttribute('skinIndex') || !mesh.isSkinnedMesh) throw new Error('v16 hair has no matching skin binding');
      const hair = new SkinnedLineSegments(groom.geometry, new THREE.MeshStandardMaterial({
        color: '#f7f1ed', roughness: .96, metalness: 0,
        transparent: true, opacity: groom.undercoat ? .24 : .32, depthWrite: false,
      }), mesh);
      hair.name = groom.name; hair.renderOrder = 1;
      hair.userData.nativeKlin = true; hair.userData.nativeHairSkin = true;
      mesh.add(hair); hairObjects.push(hair);
    }
  }
  if (!hairObjects.length) throw new Error('v16 native groom is missing');
  const rest = new Map([...bones].map(([name, bone]) => [name, {
    position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone(),
  }]));
  const parts = {
    body, eyes: ['eye.L', 'eye.R'].map(name => bones.get(name)),
    arms: ['hand.L', 'hand.R'].map(name => bones.get(name)),
    armPivots: ['upper_arm.L', 'upper_arm.R'].map(name => bones.get(name)),
    feet: ['foot.L', 'foot.R'].map(name => bones.get(name)), tail: bones.get('tail_root'), hair: hairObjects,
  };
  const posture = new THREE.Group(); posture.name = 'native-soft-posture';
  posture.position.set(center.x, bounds.min.y + nativeHeight * .43, center.z);
  model.position.sub(posture.position); posture.add(model); normalized.add(posture);
  normalized.scale.setScalar(scale);
  normalized.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  root.add(normalized);
  root.userData.nativeKlinStage = 'adult'; root.userData.sourceVersion = 'convex-oval-paws-face-v16';
  root.userData.sourceBlendSha256 = source.metadata.sourceBlendSha256;
  root.userData.geometryPolicy = 'Original v16 continuous skinned mesh; no decimation. Native CURVES paths sampled into lit web line segments.';
  root.userData.posePolicy = '23-bone v16 armature; skin and strand roots share normalized native weights.';
  const postureOrigin = posture.position.clone(), delta = new THREE.Quaternion(), parent = new THREE.Quaternion();
  const modelQ = new THREE.Quaternion(), euler = new THREE.Euler(), unit = new THREE.Vector3();
  let blink = 1, disposed = false;
  // Rest bone roll differs per limb. Convert small model-space rotations into
  // the actual parent's frame instead of treating every bone as world aligned.
  function rotateBone(name, x, y, z) {
    const bone = bones.get(name);
    if (!bone) return;
    root.updateMatrixWorld(true);
    model.getWorldQuaternion(modelQ); bone.parent.getWorldQuaternion(parent);
    parent.premultiply(modelQ.invert());
    delta.setFromEuler(euler.set(x, y, z));
    delta.premultiply(parent.clone().invert()).multiply(parent);
    bone.quaternion.premultiply(delta);
  }
  // Eye bones point out of the face; their local Y is depth. Find the local
  // axis corresponding to model vertical, then blink around the native center.
  root.updateMatrixWorld(true);
  const eyeVerticalAxes = parts.eyes.map(bone => {
    model.getWorldQuaternion(modelQ); bone.getWorldQuaternion(parent);
    unit.set(0, 1, 0).applyQuaternion(modelQ).applyQuaternion(parent.invert());
    const values = [Math.abs(unit.x), Math.abs(unit.y), Math.abs(unit.z)];
    return ['x', 'y', 'z'][values.indexOf(Math.max(...values))];
  });
  function applyBlink() {
    parts.eyes.forEach((bone, i) => {
      bone.scale.copy(rest.get(canonicalBoneName(bone)).scale);
      bone.scale[eyeVerticalAxes[i]] *= blink;
    });
  }
  const frontAnchor = (bounds.max.z - center.z) * scale + .10;
  const result = { root, height: HEIGHT, nativeHeight, sourceStage: 'adult', parts,
    setPose({ time = 0, breath, lean = 0, pitch = 0, yaw = 0, offer = 0, waveLeft = 0, waveRight = 0, lift = 0, reduced = false } = {}) {
      if (disposed) return;
      const t = Number.isFinite(time) ? time : 0, idle = reduced ? 0 : 1;
      const breathing = clamp(breath ?? Math.sin(t * 1.45) * .0055 * idle, -.015, .015), presenting = clamp(offer, 0, 1);
      posture.scale.set(1 - breathing * .28, 1 + breathing, 1 + breathing * .12);
      posture.rotation.set(clamp(pitch, -.15, .15) + presenting * .035, clamp(yaw, -.16, .16), clamp(lean, -.14, .14) + Math.sin(t * .66) * .008 * idle);
      posture.position.copy(postureOrigin); posture.position.y += clamp(lift, -.04, .08) / scale;
      for (const [name, bone] of bones) {
        const r = rest.get(name); bone.position.copy(r.position); bone.quaternion.copy(r.quaternion); bone.scale.copy(r.scale);
      }
      const raisedWave = clamp(waveRight, 0, 1) * Math.sin(t * 4.2) * .16;
      const loweredWave = clamp(waveLeft, 0, 1) * .30;
      const raisedDrift = Math.sin(t * 1.2 + .7) * .025 * idle, loweredDrift = Math.sin(t * 1.2 + 2.4) * .025 * idle;
      // Gentle native-arm gesture only; never translate detached mitten meshes
      // or stretch the short reference limbs to manufacture a different pose.
      rotateBone('upper_arm.L', presenting * .12, -presenting * .75, -presenting * .40 + raisedDrift);
      rotateBone('forearm.L', 0, -presenting * .30, raisedWave + raisedDrift * .6);
      rotateBone('upper_arm.R', -presenting * .18, presenting * .65, -presenting * .32 - loweredWave + loweredDrift);
      rotateBone('forearm.R', 0, presenting * .25, loweredDrift * .6);
      rotateBone('tail_root', Math.sin(t * .83 + .8) * .025 * idle, Math.sin(t * .71) * .035 * idle, 0);
      applyBlink(); root.updateMatrixWorld(true); body.skeleton.update();
    },
    setBlink(value = 1) { blink = clamp(value, .06, 1); applyBlink(); },
    getOfferAnchor() {
      root.updateMatrixWorld(true);
      const anchor = new THREE.Vector3(), hand = new THREE.Vector3();
      for (const bone of parts.arms) { bone.getWorldPosition(hand); root.worldToLocal(hand); anchor.add(hand); }
      anchor.multiplyScalar(.5); anchor.z = Math.max(anchor.z, frontAnchor);
      return anchor;
    },
    dispose() {
      if (disposed) return; disposed = true;
      const materials = new Set(); root.traverse(object => { for (const material of [].concat(object.material || [])) materials.add(material); });
      for (const material of materials) material.dispose();
      body.skeleton.dispose(); root.removeFromParent();
    },
  };
  result.setPose({ reduced: true });
  return result;
}

// The legacy Demo calls this with both stage names. Every call gets its own
// adult instance, including an omitted argument; no unavailable age is fetched.
export async function loadNativeKlinStage(_requestedStage = 'adult') { return loadRiggedAdultStage(); }
export function preloadNativeKlin() { return getSource('adult'); }
