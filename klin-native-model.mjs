import * as THREE from './vendor/three/three.module.js';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';

// Direct exports of the user's frozen 09-07 blend, with intact native topology.
// Every source groom follows its own source mesh. Browser strands are a sampled
// approximation of Cycles Hair Curves, shaded by the same scene lights as skin.
const SOURCE = Object.freeze({
  juvenile: {
    mesh: new URL('./assets/klin-native-20261016-0907/juvenile.glb', import.meta.url),
    hair: new URL('./assets/klin-native-20261016-0907/juvenile-hair.bin', import.meta.url),
  },
  adult: {
    mesh: new URL('./assets/klin-native-20261016-0907/adult.glb', import.meta.url),
    hair: new URL('./assets/klin-native-20261016-0907/adult-hair.bin', import.meta.url),
  },
});
const MANIFEST = new URL('./assets/klin-native-20261016-0907/native-model-manifest.json', import.meta.url);
const sourceCache = new Map();
const HEIGHT = 2.72;
const SOURCE_SHA = '0b7982122901a94d3e6e9a769bc470c50c386f2751b33c4131009f520d604d6c';
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
    ]).then(([gltf, bytes, manifest]) => {
      const values = new Float32Array(bytes), groups = new Map();
      for (const groom of manifest.stages[stage].grooms) {
        const geometry = new THREE.BufferGeometry();
        const data = new THREE.InterleavedBuffer(values.subarray(groom.offset * 6, (groom.offset + groom.count) * 6), 6);
        geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(data, 3, 0));
        geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(data, 3, 3));
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        if (!groups.has(groom.mesh)) groups.set(groom.mesh, []);
        groups.get(groom.mesh).push({ geometry, name: groom.name, undercoat: groom.undercoat });
      }
      return { mesh: gltf.scene, hairGroups: groups };
    }).catch(error => { sourceCache.delete(stage); throw error; });
    sourceCache.set(stage, loading);
  }
  return sourceCache.get(stage);
}

function localPivot(mesh, label, point) {
  const parent = mesh.parent;
  mesh.geometry.computeBoundingBox();
  const center = point || mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
  const pivot = new THREE.Group();
  pivot.name = label; pivot.position.copy(center).add(mesh.position);
  parent.add(pivot); pivot.add(mesh); mesh.position.sub(center);
  return pivot;
}

/** Independent instance, +Z front, Y=0 feet, canonical mesh height 2.72.
 * The source has no armature. This adapter preserves all native vertices and
 * uses modest shoulder/tail pivots, synchronizing their native groom strands.
 * setPose is layered inside root; world owns the root's position and scale.
 */
export async function loadNativeKlinStage(requestedStage = 'juvenile') {
  const stage = requestedStage === 'adult' ? 'adult' : 'juvenile';
  const source = await getSource(stage);
  const root = new THREE.Group(); root.name = `klin-native-${stage}-09-07`;
  const normalized = new THREE.Group(); normalized.name = 'native-coordinate-normalization';
  const model = source.mesh.clone(true);
  const parts = { eyes: [], arms: [], feet: [], body: null, tail: null, armPivots: [] };
  const meshes = [], eyeMeshes = [];
  model.traverse(object => { if (object.isMesh) meshes.push(object); });
  for (const object of meshes) {
    object.castShadow = true; object.receiveShadow = true;
    object.material = Array.isArray(object.material)
      ? object.material.map(material => material.clone()) : object.material.clone();
    if (!/Eye_/i.test(object.name)) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        // Native dense fleece hides the blush substrate; sampled web fibers need
        // a pale base. No emissive fill: the scene now determines all shading.
        material.color.set('#eee4df'); material.roughness = .94; material.metalness = 0;
        material.emissive?.set(0x000000); material.emissiveIntensity = 0;
      }
    }
    object.userData.nativeKlin = true;
    if (/Eye_/i.test(object.name)) eyeMeshes.push(object);
    else if (/Arm_/i.test(object.name)) parts.arms.push(object);
    else if (/Tail/i.test(object.name)) parts.tail = object;
    else if (/Body/i.test(object.name)) parts.body = object;
  }
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const nativeHeight = bounds.max.y - bounds.min.y, scale = HEIGHT / nativeHeight;
  for (const mesh of meshes) {
    for (const groom of source.hairGroups.get(mesh.name) || []) {
      const filament = new THREE.LineSegments(groom.geometry, new THREE.MeshStandardMaterial({
        color: '#f7f1ed', roughness: .96, metalness: 0,
        transparent: true, opacity: groom.undercoat ? .24 : .32, depthWrite: false,
      }));
      filament.name = groom.name; filament.frustumCulled = false; filament.renderOrder = 1;
      // Native mesh and groom positions both use source coordinates. The mesh
      // transform is identity in these exports; keeping groom as child makes all
      // later shoulder/tail movement affect body and fur together.
      mesh.add(filament);
    }
  }
  eyeMeshes.forEach((mesh, index) => parts.eyes.push(localPivot(mesh, `native-eye-pivot-${index}`)));
  for (const mesh of parts.arms) {
    const box = mesh.geometry.boundingBox || (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox);
    const c = box.getCenter(new THREE.Vector3()), raised = /Raised/.test(mesh.name);
    const shoulder = new THREE.Vector3(raised ? box.min.x + .10 : box.max.x - .06,
      raised ? box.min.y + .10 : box.max.y - .12, c.z);
    const pivot = localPivot(mesh, `native-shoulder-${raised ? 'raised' : 'lowered'}`, shoulder);
    pivot.userData.raised = raised; pivot.userData.restPosition = pivot.position.clone(); parts.armPivots.push(pivot);
  }
  let tailPivot;
  if (parts.tail) tailPivot = localPivot(parts.tail, 'native-tail-pivot');
  // Whole-creature breathing stays very small. The body's feet are integrated
  // topology, so a skeleton or independent foot motion would be fabricated.
  const posture = new THREE.Group(); posture.name = 'native-soft-posture';
  posture.position.set(center.x, bounds.min.y + nativeHeight * .43, center.z);
  model.position.sub(posture.position); posture.add(model); normalized.add(posture);
  normalized.scale.setScalar(scale);
  normalized.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  root.add(normalized);
  root.userData.nativeKlinStage = stage; root.userData.sourceVersion = '09-07';
  root.userData.sourceBlendSha256 = SOURCE_SHA;
  root.userData.geometryPolicy = 'Native mesh, no decimation; sampled grouped native hair paths.';
  root.userData.posePolicy = 'No source skeleton; small shoulder and tail pivots, shared-groom transforms.';
  const postureOrigin = posture.position.clone();
  return { root, height: HEIGHT, nativeHeight, sourceStage: stage, parts,
    setPose({ time = 0, breath, lean = 0, pitch = 0, yaw = 0, offer = 0, waveLeft = 0, waveRight = 0, lift = 0, reduced = false } = {}) {
      const t = Number.isFinite(time) ? time : 0;
      const idle = reduced ? 0 : 1;
      const breathing = THREE.MathUtils.clamp(breath ?? Math.sin(t * 1.45) * .0055 * idle, -.015, .015);
      const presenting = THREE.MathUtils.clamp(offer, 0, 1);
      posture.scale.set(1 - breathing * .28, 1 + breathing, 1 + breathing * .12);
      posture.rotation.set(THREE.MathUtils.clamp(pitch, -.15, .15) + presenting * .035,
        THREE.MathUtils.clamp(yaw, -.16, .16), THREE.MathUtils.clamp(lean, -.14, .14) + Math.sin(t * .66) * .008 * idle);
      posture.position.copy(postureOrigin); posture.position.y += THREE.MathUtils.clamp(lift, -.04, .08) / scale;
      for (const pivot of parts.armPivots) {
        const raised = pivot.userData.raised;
        const wave = THREE.MathUtils.clamp(raised ? waveRight : waveLeft, 0, 1);
        const drift = Math.sin(t * 1.2 + (raised ? .7 : 2.4)) * .025 * idle;
        pivot.position.copy(pivot.userData.restPosition);
        pivot.position.z += presenting * (raised ? .72 : .68);
        pivot.position.x += presenting * (raised ? -.32 : .15);
        pivot.position.y += presenting * (raised ? -.06 : .02);
        // Lower the source raised mitten toward the other hand for an offer.
        // Both hands meet below the eyes; the original mesh and groom stay together.
        pivot.rotation.set(presenting * (raised ? .45 : -.75) + drift * .6,
          presenting * (raised ? -.35 : .10),
          drift + presenting * (raised ? -1.55 : .55) + wave * (raised ? Math.sin(t * 4.2) * .16 : -.45));
      }
      if (tailPivot) tailPivot.rotation.set(Math.sin(t * .83 + .8) * .035 * idle, Math.sin(t * .71) * .045 * idle, 0);
    },
    getOfferAnchor() {
      root.updateMatrixWorld(true);
      const anchor = new THREE.Vector3();
      for (const arm of parts.arms) {
        arm.geometry.computeBoundingBox();
        const hand = arm.geometry.boundingBox.getCenter(new THREE.Vector3());
        arm.localToWorld(hand); root.worldToLocal(hand); anchor.add(hand);
      }
      if (parts.arms.length) anchor.multiplyScalar(1 / parts.arms.length);
      else anchor.set(0, HEIGHT * .47, HEIGHT * .36);
      // Hold the card just in front of the chest; the unrigged source hands
      // have broad side attachments, so the card must not intersect its fleece.
      anchor.z = Math.max(anchor.z, HEIGHT * .41);
      return anchor;
    },
    setBlink(value = 1) { parts.eyes.forEach(eye => { eye.scale.y = THREE.MathUtils.clamp(value, .06, 1); }); },
    dispose() {
      root.traverse(object => {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material?.dispose());
      });
      root.removeFromParent();
    },
  };
}
export function preloadNativeKlin() { return Promise.all(['juvenile', 'adult'].map(getSource)); }
