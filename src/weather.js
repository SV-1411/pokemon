// Day/night clock + per-biome weather with particle effects. Weather and time
// feed three systems: the renderer (sun, fog, lamps), the spawner (type
// weights), and the battle engine (rain/sun damage modifiers).
import * as THREE from 'three';

const WEATHER_TABLE = {
  himalaya: [['snow', .5], ['clear', .5]],
  desert: [['clear', .55], ['sandstorm', .25], ['sun', .2]],
  jungle: [['rain', .45], ['clear', .4], ['fog', .15]],
  coast: [['clear', .6], ['rain', .3], ['sun', .1]],
  plains: [['clear', .6], ['rain', .2], ['sun', .2]],
  forest: [['clear', .55], ['rain', .3], ['fog', .15]],
  hills: [['clear', .6], ['rain', .2], ['fog', .2]],
  city: [['clear', .7], ['rain', .3]],
  ocean: [['clear', .7], ['rain', .3]],
};
const ICONS = { clear: '☀', sun: '🌞', rain: '🌧', snow: '❄', sandstorm: '🌪', fog: '🌫' };

export class Atmosphere {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.time = 9;                 // game hours; 1 game hour = 1 real minute
    this.weather = 'clear';
    this.nextRoll = 0;
    this.day = 1;

    // particle pool, recycled around the player
    const N = 1600;
    this.pN = N;
    this.pPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.pPos[i * 3] = (Math.random() - 0.5) * 120;
      this.pPos[i * 3 + 1] = Math.random() * 60;
      this.pPos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.pMat = new THREE.PointsMaterial({
      color: 0xaaccee, size: 0.9, transparent: true, opacity: 0.8, depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.pMat);
    this.points.visible = false;
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  isNight() { return this.time < 5.5 || this.time > 18.5; }

  roll(biome) {
    const table = WEATHER_TABLE[biome] ?? WEATHER_TABLE.plains;
    let r = Math.random();
    for (const [w, p] of table) { r -= p; if (r <= 0) return w; }
    return 'clear';
  }

  update(dt, px, pz, biome) {
    this.time += dt / 60; // 1 real second = 1 game minute
    if (this.time >= 24) { this.time -= 24; this.day++; }
    this.nextRoll -= dt;
    if (this.nextRoll <= 0 || biome !== this.lastBiome) {
      this.lastBiome = biome;
      this.nextRoll = 75 + Math.random() * 60;
      const w = this.roll(biome);
      if (w !== this.weather) this.weather = w;
      this.applyWeatherVisuals();
    }

    // sun path: rises 6:00, sets 18:00, peak 62°
    const elev = Math.sin(((this.time - 6) / 12) * Math.PI) * 62;
    const azim = 180 + ((this.time - 12) / 12) * 140;
    const day = this.world.setSun(Math.max(-8, elev), azim);
    this.world.placeSunShadow(px, pz);
    this.world.tick(dt);

    // fog: weather + time of day
    const dayCol = new THREE.Color(0x9fc3e8), nightCol = new THREE.Color(0x0a1230);
    let col = dayCol.clone().lerp(nightCol, 1 - day), near = 260, far = 780;
    if (this.weather === 'rain') { col.lerp(new THREE.Color(0x6a7a88), 0.6); near = 130; far = 460; }
    if (this.weather === 'fog') { col.lerp(new THREE.Color(0xb8c0c8), 0.7); near = 40; far = 220; }
    if (this.weather === 'snow') { col.lerp(new THREE.Color(0xd8e0ea), 0.5); near = 150; far = 520; }
    if (this.weather === 'sandstorm') { col.lerp(new THREE.Color(0xc8a868), 0.75); near = 55; far = 250; }
    this.world.setFog(col, near, far);

    this.tickParticles(dt, px, pz);
  }

  applyWeatherVisuals() {
    const w = this.weather;
    this.points.visible = ['rain', 'snow', 'sandstorm'].includes(w);
    if (w === 'rain') { this.pMat.color.set(0x9fc4ee); this.pMat.size = 0.7; this.pMat.opacity = 0.65; }
    if (w === 'snow') { this.pMat.color.set(0xffffff); this.pMat.size = 1.1; this.pMat.opacity = 0.95; }
    if (w === 'sandstorm') { this.pMat.color.set(0xd8b070); this.pMat.size = 1.3; this.pMat.opacity = 0.7; }
  }

  tickParticles(dt, px, pz) {
    if (!this.points.visible) return;
    this.points.position.set(px, 0, pz);
    const fall = this.weather === 'rain' ? 55 : this.weather === 'snow' ? 7 : 2;
    const windX = this.weather === 'sandstorm' ? 48 : this.weather === 'snow' ? 2.5 : 4;
    for (let i = 0; i < this.pN; i++) {
      this.pPos[i * 3] += windX * dt + (this.weather === 'snow' ? Math.sin(i + this.time * 60) * 0.06 : 0);
      this.pPos[i * 3 + 1] -= fall * dt;
      if (this.pPos[i * 3 + 1] < 0) this.pPos[i * 3 + 1] += 60;
      if (this.pPos[i * 3] > 60) this.pPos[i * 3] -= 120;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  // spawn-pool weight multiplier for a pokemon type right now
  typeMult(type) {
    let m = 1;
    if (this.isNight()) {
      m *= { ghost: 3, dark: 2.5, fairy: 1.4, psychic: 1.3, normal: 0.6, flying: 0.5 }[type] ?? 1;
    }
    m *= ({
      rain: { water: 2.5, electric: 1.6, fire: 0.3, ground: 0.7 },
      sun: { fire: 2.2, grass: 1.5, water: 0.5 },
      snow: { ice: 2.5 },
      sandstorm: { ground: 2.2, rock: 2, steel: 1.5 },
      fog: { ghost: 1.8, psychic: 1.4 },
    }[this.weather] ?? {})[type] ?? 1;
    return m;
  }

  // what the battle engine needs to know
  battleWeather() {
    return ['rain', 'sun', 'snow', 'sandstorm'].includes(this.weather) ? this.weather : null;
  }

  label() {
    const hh = String(Math.floor(this.time)).padStart(2, '0');
    const mm = String(Math.floor((this.time % 1) * 60)).padStart(2, '0');
    return `${this.isNight() ? '🌙' : ICONS[this.weather] ?? '☀'} ${hh}:${mm} · ${this.weather.toUpperCase()}${this.isNight() ? ' · NIGHT' : ''}`;
  }
}
