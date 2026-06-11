// Animated Pokémon for the 3D world: decodes the official Showdown animated
// GIF sprites (PokéAPI sprite repo) into per-frame textures via the WebCodecs
// ImageDecoder, so overworld Pokémon breathe, bounce and flap like creatures
// instead of standing as stills. Falls back to the static sprite when a
// species has no animated set or the browser lacks ImageDecoder.
import * as THREE from 'three';
import { sprFront } from './data.js';

const SHOWDOWN = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown';
export const showdownUrl = (id, { back = false, shiny = false } = {}) =>
  `${SHOWDOWN}${back ? '/back' : ''}${shiny ? '/shiny' : ''}/${id}.gif`;

const texLoader = new THREE.TextureLoader();
const cache = new Map(); // key -> Promise<{frames:[{tex,dur}], aspect} | {static:tex, aspect}>

function staticEntry(id, shiny) {
  return new Promise((resolve) => {
    const tex = texLoader.load(sprFront(id, shiny), (t) => {
      resolve({ static: t, aspect: t.image.width / t.image.height });
    }, undefined, () => resolve({ static: tex, aspect: 1 }));
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
  });
}

async function decodeEntry(id, shiny) {
  if (typeof ImageDecoder === 'undefined') return staticEntry(id, shiny);
  try {
    const resp = await fetch(showdownUrl(id, { shiny }));
    if (!resp.ok) throw new Error('no gif');
    const dec = new ImageDecoder({ data: await resp.arrayBuffer(), type: 'image/gif' });
    await dec.tracks.ready;
    const count = Math.min(dec.tracks.selectedTrack.frameCount, 80);
    const frames = [];
    let aspect = 1;
    for (let i = 0; i < count; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      const bmp = await createImageBitmap(image);
      aspect = bmp.width / bmp.height;
      image.close();
      const tex = new THREE.Texture(bmp);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      frames.push({ tex, dur: Math.max(0.02, (image.duration ?? 60000) / 1e6) });
    }
    dec.close();
    if (!frames.length) throw new Error('empty gif');
    return { frames, aspect };
  } catch {
    return staticEntry(id, shiny);
  }
}

function getEntry(id, shiny) {
  const key = `${id}_${shiny ? 1 : 0}`;
  if (!cache.has(key)) cache.set(key, decodeEntry(id, shiny));
  return cache.get(key);
}

// A THREE.Sprite whose texture cycles through the decoded frames.
// Call update(dt) each tick; setScale() once the aspect is known.
export class AnimMonSprite {
  constructor(id, shiny, baseScale) {
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: true }));
    this.frames = null;
    this.fi = 0;
    this.ft = 0;
    this.baseScale = baseScale;
    this.sprite.scale.set(baseScale, baseScale, 1);
    getEntry(id, shiny).then((entry) => {
      if (this.disposed) return;
      const aspect = entry.aspect || 1;
      // keep height = baseScale, widen by aspect (capped so Onix doesn't fill the screen)
      const w = baseScale * Math.min(1.6, Math.max(0.6, aspect));
      this.sprite.scale.set(w, baseScale, 1);
      if (entry.frames) {
        this.frames = entry.frames;
        this.sprite.material.map = entry.frames[0].tex;
      } else {
        this.sprite.material.map = entry.static;
      }
      this.sprite.material.needsUpdate = true;
    });
  }
  update(dt) {
    if (!this.frames) return;
    this.ft += dt;
    const cur = this.frames[this.fi];
    if (this.ft >= cur.dur) {
      this.ft = 0;
      this.fi = (this.fi + 1) % this.frames.length;
      this.sprite.material.map = this.frames[this.fi].tex;
      this.sprite.material.needsUpdate = true;
    }
  }
  dispose() { this.disposed = true; }
}
