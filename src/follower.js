// Your lead Pokémon walks behind you (HGSS style) and emotes based on
// friendship, weather and time. Walking together slowly raises friendship.
import * as THREE from 'three';
import { sprFront } from './data.js';
import { heightAt } from './world.js';

const loader = new THREE.TextureLoader();

function emoteSprite(text) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  g.font = '44px serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 32, 36);
  const t = new THREE.CanvasTexture(cv);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
}

export class Follower {
  constructor(scene) {
    this.scene = scene;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: true }));
    this.sprite.visible = false;
    scene.add(this.sprite);
    this.emote = emoteSprite('♥');
    this.emote.scale.set(3, 3, 1);
    this.emote.visible = false;
    scene.add(this.emote);
    this.monKey = null;
    this.t = 0;
    this.emoteT = 0;
    this.nextEmote = 6;
    this.walkAccum = 0;
  }

  setMon(mon) {
    const key = mon ? `${mon.id}_${mon.shiny ? 1 : 0}` : null;
    if (key === this.monKey) { this.mon = mon; return; }
    this.monKey = key;
    this.mon = mon;
    if (!mon) { this.sprite.visible = false; return; }
    const tex = loader.load(sprFront(mon.id, mon.shiny));
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite.material.map = tex;
    this.sprite.material.needsUpdate = true;
    const sc = 5.5;
    this.sprite.scale.set(sc, sc, 1);
    this.sprite.visible = true;
  }

  update(dt, player, atmosphere, moved) {
    if (!this.mon || !this.sprite.visible) return;
    this.t += dt;
    // trail 6 units behind the player's heading
    const tx = player.pos.x - Math.sin(player.heading) * 6;
    const tz = player.pos.z - Math.cos(player.heading) * 6;
    const dx = tx - this.sprite.position.x, dz = tz - this.sprite.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 60) this.sprite.position.set(tx, 0, tz); // teleported — catch up
    else if (dist > 1.2) {
      const sp = Math.min(dist * 3.2, 34) * dt;
      this.sprite.position.x += (dx / dist) * sp;
      this.sprite.position.z += (dz / dist) * sp;
    }
    this.sprite.position.y = heightAt(this.sprite.position.x, this.sprite.position.z)
      + 2.6 + Math.sin(this.t * 3) * 0.35;

    // walking together builds friendship: +1 per ~180m
    if (moved) {
      this.walkAccum += dt * 13;
      if (this.walkAccum > 180) {
        this.walkAccum = 0;
        this.mon.friend = Math.min(255, (this.mon.friend ?? 70) + 1);
      }
    }

    // emotes
    if (this.emote.visible) {
      this.emoteT -= dt;
      this.emote.position.set(this.sprite.position.x, this.sprite.position.y + 4.2, this.sprite.position.z);
      if (this.emoteT <= 0) this.emote.visible = false;
    } else if ((this.nextEmote -= dt) <= 0) {
      this.nextEmote = 7 + Math.random() * 9;
      const f = this.mon.friend ?? 70;
      let sym = null;
      const w = atmosphere.weather;
      if (w === 'rain') sym = Math.random() < 0.5 ? '☔' : null;
      else if (w === 'snow') sym = Math.random() < 0.5 ? '❄' : null;
      else if (w === 'sandstorm') sym = '😖';
      if (!sym) {
        if (atmosphere.isNight() && Math.random() < 0.3) sym = '💤';
        else if (f >= 200) sym = '♥';
        else if (f >= 130) sym = Math.random() < 0.5 ? '♪' : '♥';
        else if (f < 60) sym = '…';
      }
      if (sym) {
        this.swapEmote(sym);
        this.emote.visible = true;
        this.emoteT = 1.8;
      }
    }
  }

  swapEmote(text) {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d');
    g.font = '44px serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 32, 36);
    this.emote.material.map = new THREE.CanvasTexture(cv);
    this.emote.material.needsUpdate = true;
  }
}
