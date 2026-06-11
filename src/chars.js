// Shared anime-style character anatomy: round heads with real eyes and brows,
// tapered limbs pivoted at hip/shoulder, and archetype builders used by the
// player (protagonist), city NPCs (man / woman / kid / elder) and interiors.
import * as THREE from 'three';

export const mat = (color) => new THREE.MeshLambertMaterial({ color });

export const SKIN_TONES = [0xe8b88a, 0xd8a070, 0xc08858, 0xa87048];

// head: skull sphere + white eyes with pupils + brows (+ optional cheek marks)
export function buildHead(skinMat, opts = {}) {
  const g = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.82, 14, 12), skinMat);
  skull.scale.y = 1.05;
  g.add(skull);
  const white = mat(0xffffff), black = mat(0x222226);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), white);
    eye.position.set(sx * 0.3, 0.06, 0.66);
    eye.scale.set(1, 1.3, 0.45);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), black);
    pupil.position.set(sx * 0.3, 0.05, 0.78);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.06), black);
    brow.position.set(sx * 0.3, 0.36, 0.72);
    brow.rotation.z = sx * -0.12;
    g.add(eye, pupil, brow);
  }
  if (opts.cheeks) {
    for (const sx of [-1, 1]) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.06), mat(0xb06030));
      mark.position.set(sx * 0.52, -0.18, 0.6);
      mark.rotation.z = sx * 0.5;
      g.add(mark);
    }
  }
  return g;
}

// tapered limb group pivoted at the top: [upper, lower?, end] cylinders/boxes
export function buildLeg(pantsMat, shoeMat, len = 2.5) {
  const g = new THREE.Group();
  const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.27, len * 0.55, 8), pantsMat);
  thigh.position.y = -len * 0.28;
  const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, len * 0.45, 8), pantsMat);
  calf.position.y = -len * 0.74;
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.95), shoeMat);
  shoe.position.set(0, -len + 0.12, 0.18);
  g.add(thigh, calf, shoe);
  return g;
}
export function buildArm(sleeveMat, handMat, len = 2.1) {
  const g = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, len * 0.55, 8), sleeveMat);
  upper.position.y = -len * 0.28;
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, len * 0.42, 8), sleeveMat);
  lower.position.y = -len * 0.72;
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 7), handMat);
  hand.position.y = -len + 0.05;
  g.add(upper, lower, hand);
  return g;
}

// torso: tapered chest box + hips, pivot at base
export function buildTorso(topMat, hipMat, w = 1.9, h = 2.3) {
  const g = new THREE.Group();
  const chest = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.72, w * 0.55), topMat);
  chest.position.y = h * 0.62;
  const waist = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, h * 0.4, w * 0.5), hipMat ?? topMat);
  waist.position.y = h * 0.18;
  g.add(chest, waist);
  return g;
}

// ---------- the protagonist ----------
export function buildProtagonist() {
  const g = new THREE.Group();
  const skin = mat(0xe8b88a);
  const jacket = mat(0x2356c8);
  const sleeve = mat(0xf2f2f0);
  const glove = mat(0x2e8a4a);
  const jeans = mat(0x3a5a9a);
  const shoe = mat(0x303038);
  const capRed = mat(0xd83838);
  const capWhite = mat(0xf5f5f0);
  const hair = mat(0x1a1a1a);

  const legL = buildLeg(jeans, shoe);
  legL.position.set(-0.5, 2.5, 0);
  const legR = buildLeg(jeans, shoe);
  legR.position.set(0.5, 2.5, 0);

  const torso = buildTorso(jacket, jeans);
  torso.position.y = 2.45;
  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 0.08), sleeve);
  zip.position.set(0, 3.9, 0.56);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.32, 1.1), sleeve);
  collar.position.y = 4.78;

  const armL = buildArm(sleeve, glove);
  armL.position.set(-1.15, 4.65, 0);
  armL.rotation.z = 0.1;
  const armR = buildArm(sleeve, glove);
  armR.position.set(1.15, 4.65, 0);
  armR.rotation.z = -0.1;

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.5, 8), skin);
  neck.position.y = 5.05;

  const head = buildHead(skin, { cheeks: true });
  head.position.y = 5.95;
  // spiky black hair poking out under the cap
  for (const [x, z, ry] of [[-0.55, -0.5, 0.7], [0.55, -0.5, -0.7], [0, -0.75, 0], [-0.75, 0.1, 1.4], [0.75, 0.1, -1.4]]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.75, 5), hair);
    spike.position.set(x, 6.05, z);
    spike.rotation.set(z < 0 ? -1.25 : -0.4, ry, x * -0.7);
    head.add(spike.clone());
    spike.position.y = 0.1; spike.position.x = x; spike.position.z = z;
  }
  const capDome = new THREE.Mesh(new THREE.SphereGeometry(0.88, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), capRed);
  capDome.position.y = 6.45;
  capDome.scale.y = 0.78;
  const capPanel = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 0.14), capWhite);
  capPanel.position.set(0, 6.62, 0.78);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 14, 1, false, -Math.PI / 2, Math.PI), capRed);
  brim.position.set(0, 6.5, 0.55);
  brim.scale.z = 1.5;

  const pack = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 0.6), glove);
  pack.position.set(0, 3.8, -0.85);
  for (const sx of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.3, 0.1), mat(0x1f5a32));
    strap.position.set(sx * 0.55, 4.2, 0.56);
    g.add(strap);
  }

  g.add(legL, legR, torso, zip, collar, armL, armR, neck, head, capDome, capPanel, brim, pack);
  g.traverse((m) => { m.castShadow = true; });
  g.userData = { legL, legR, armL, armR, torso, tintParts: [torso.children[0], capDome, brim] };
  return g;
}

// ---------- villagers: man / woman / kid / elder ----------
const OUTFITS = [0xd88a3a, 0x4a8ad8, 0x9a4ad8, 0x3aa86a, 0xd84a6a, 0xe8c83a, 0x3ac8c8];
export function buildVillagerV2(seed) {
  const kind = seed % 4; // 0 man, 1 woman, 2 kid, 3 elder
  const g = new THREE.Group();
  const skin = mat(SKIN_TONES[seed % SKIN_TONES.length]);
  const outfit = mat(OUTFITS[seed % OUTFITS.length]);
  const outfit2 = mat(OUTFITS[(seed + 3) % OUTFITS.length]);
  const hairM = mat(kind === 3 ? 0xe8e8e8 : 0x1a1a1a);
  const pants = kind === 1 ? outfit : mat(0xe8e0d0);
  const shoe = mat(0x6a4a30);

  const legL = buildLeg(pants, shoe);
  legL.position.set(-0.48, 2.5, 0);
  const legR = buildLeg(pants, shoe);
  legR.position.set(0.48, 2.5, 0);
  const torso = buildTorso(outfit, outfit);
  torso.position.y = 2.45;
  const armL = buildArm(kind === 0 ? outfit : skin, skin);
  armL.position.set(-1.1, 4.6, 0);
  armL.rotation.z = 0.12;
  const armR = buildArm(kind === 0 ? outfit : skin, skin);
  armR.position.set(1.1, 4.6, 0);
  armR.rotation.z = -0.12;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.5, 8), skin);
  neck.position.y = 5.0;
  const head = buildHead(skin);
  head.position.y = 5.9;
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.86, 12, 9, 0, Math.PI * 2, 0, Math.PI / 2), hairM);
  hairCap.position.y = 6.1;
  g.add(legL, legR, torso, armL, armR, neck, head, hairCap);

  if (kind === 1) {
    // long kurti + dupatta over the shoulder, hair bun
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.15, 1.9, 10), outfit);
    skirt.position.y = 1.75;
    const dupatta = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.18), outfit2);
    dupatta.position.set(0.45, 3.6, 0.5);
    dupatta.rotation.z = -0.5;
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), hairM);
    bun.position.set(0, 6.2, -0.75);
    g.add(skirt, dupatta, bun);
  }
  if (kind === 2) g.scale.setScalar(0.62); // kid
  if (kind === 3) {
    g.rotation.x = 0.08; // slight stoop
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 6), mat(0x8a6a42));
    stick.position.set(1.45, 1.7, 0.4);
    g.add(stick);
    const beard = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.25), hairM);
    beard.position.set(0, 5.45, 0.6);
    g.add(beard);
  }
  g.traverse((m) => { m.castShadow = true; });
  g.userData = { legL, legR, armL, armR, torso, hair: hairCap };
  return g;
}
