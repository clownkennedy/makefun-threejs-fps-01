// The HUD: every DOM element the game shows, updated from the sim.
// The sim never touches document directly; main.js calls these methods.
import { PALETTE, css } from './palette.js';
import { ARENA, BLOCKS, SITES } from './world.js';
import { WEAPONS, ARMOR_PRICE } from './weapons.js';

function el(id) { return document.getElementById(id); }

export function createHud() {
  const minimap = el('minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;
  let bannerTimer = null;
  let hitTimer = null;

  function setText(id, text) {
    const n = el(id);
    if (n) n.textContent = text;
  }

  return {
    setHealth(hp, armor) {
      setText('health-num', String(Math.ceil(hp)));
      const hf = el('health-fill');
      if (hf) hf.style.width = Math.max(0, hp) + '%';
      const af = el('armor-fill');
      if (af) af.style.width = Math.max(0, armor) + '%';
    },
    setMoney(m) {
      setText('money-value', '$' + m);
      setText('buy-money', '$' + m);
    },
    setAmmo(mag, reserve, name, grenades) {
      setText('ammo-mag', String(mag));
      setText('ammo-reserve', '/ ' + reserve);
      setText('weapon-name', name);
      setText('grenade-count', '◉ ×' + grenades);
      const ammo = el('ammo');
      if (ammo) ammo.classList.toggle('empty', mag === 0);
    },
    setTimer(text, urgent) {
      setText('timer-value', text);
      const t = el('timer-value');
      if (t) t.classList.toggle('urgent', !!urgent);
    },
    setScore(ember, ash) {
      setText('score-ember', String(ember));
      setText('score-ash', String(ash));
    },
    setRound(n) { setText('round-label', 'ROUND ' + n); },
    setCrosshairGap(px) {
      const c = el('crosshair');
      if (c) c.style.setProperty('--gap', px + 'px');
    },
    hitmarker() {
      const h = el('hitmarker');
      if (!h) return;
      h.classList.add('on');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => h.classList.remove('on'), 120);
    },
    damageFlash() {
      const v = el('damage-vignette');
      if (!v) return;
      v.classList.add('on');
      setTimeout(() => v.classList.remove('on'), 180);
    },
    banner(title, sub, ms) {
      const b = el('round-banner');
      if (!b) return;
      b.innerHTML = '';
      const t = document.createElement('b');
      t.textContent = title;
      const s = document.createElement('span');
      s.textContent = sub || '';
      b.appendChild(t);
      b.appendChild(s);
      b.classList.add('on');
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => b.classList.remove('on'), ms || 2400);
    },
    bombBanner(text) {
      const b = el('bomb-banner');
      if (!b) return;
      if (text) {
        b.textContent = text;
        b.hidden = false;
      } else {
        b.hidden = true;
      }
    },
    plantBar(progress) {
      const bar = el('plant-bar');
      if (!bar) return;
      if (progress === null || progress === undefined) {
        bar.hidden = true;
        return;
      }
      bar.hidden = false;
      const f = el('plant-fill');
      if (f) f.style.width = Math.round(progress * 100) + '%';
    },
    killfeed(killer, victim, weaponName, headshot) {
      const feed = el('killfeed');
      if (!feed) return;
      const row = document.createElement('div');
      row.className = 'feed-row';
      const k = document.createElement('b');
      k.textContent = killer;
      const sep = document.createElement('span');
      sep.textContent = headshot ? ' ☠ ' + weaponName + ' ' : ' ' + weaponName + ' ';
      const v = document.createElement('b');
      v.textContent = victim;
      row.appendChild(k);
      row.appendChild(sep);
      row.appendChild(v);
      feed.prepend(row);
      while (feed.children.length > 5) feed.removeChild(feed.lastChild);
      setTimeout(() => { if (row.parentNode) row.parentNode.removeChild(row); }, 6000);
    },
    drawMinimap(player, bots) {
      if (!mctx || !minimap) return;
      const W = minimap.width;
      const H = minimap.height;
      const sx = (x) => ((x + ARENA.halfX) / (ARENA.halfX * 2)) * W;
      const sz = (z) => ((z + ARENA.halfZ) / (ARENA.halfZ * 2)) * H;
      mctx.fillStyle = 'rgba(16,20,26,0.85)';
      mctx.fillRect(0, 0, W, H);
      mctx.fillStyle = 'rgba(255,255,255,0.10)';
      for (const b of BLOCKS) {
        mctx.fillRect(sx(b.x0), sz(b.z0), sx(b.x1) - sx(b.x0), sz(b.z1) - sz(b.z0));
      }
      for (const site of SITES) {
        mctx.beginPath();
        mctx.arc(sx(site.x), sz(site.z), 7, 0, Math.PI * 2);
        mctx.fillStyle = css(site.color);
        mctx.fill();
        mctx.fillStyle = '#10141a';
        mctx.font = 'bold 9px sans-serif';
        mctx.textAlign = 'center';
        mctx.textBaseline = 'middle';
        mctx.fillText(site.name, sx(site.x), sz(site.z));
      }
      // Player arrow, pointing along the view yaw.
      const px = sx(player.pos.x);
      const pz = sz(player.pos.z);
      mctx.save();
      mctx.translate(px, pz);
      mctx.rotate(-player.yaw);
      mctx.fillStyle = css(PALETTE.accent);
      mctx.beginPath();
      mctx.moveTo(0, -7);
      mctx.lineTo(5, 6);
      mctx.lineTo(-5, 6);
      mctx.closePath();
      mctx.fill();
      mctx.restore();
      for (const bot of bots) {
        if (!bot.alive) continue;
        mctx.beginPath();
        mctx.arc(sx(bot.pos.x), sz(bot.pos.z), 3.5, 0, Math.PI * 2);
        mctx.fillStyle = css(PALETTE.danger);
        mctx.fill();
      }
    },
    showBuyMenu(onBuy) {
      const menu = el('buy-menu');
      if (!menu) return;
      const items = el('buy-items');
      if (items) {
        items.innerHTML = '';
        Object.values(WEAPONS).forEach((w, i) => {
          const row = document.createElement('button');
          row.className = 'buy-row';
          row.type = 'button';
          const key = document.createElement('kbd');
          key.textContent = String(i + 1);
          const name = document.createElement('b');
          name.textContent = w.name;
          const desc = document.createElement('span');
          desc.textContent = w.kind + ' · ' + w.damage + ' dmg · ' + w.mag + '/' + w.reserve;
          const price = document.createElement('em');
          price.textContent = w.price === 0 ? 'OWNED' : '$' + w.price;
          row.appendChild(key);
          row.appendChild(name);
          row.appendChild(desc);
          row.appendChild(price);
          row.addEventListener('click', () => onBuy('weapon', w.id));
          items.appendChild(row);
        });
        const armorRow = document.createElement('button');
        armorRow.className = 'buy-row';
        armorRow.type = 'button';
        const aKey = document.createElement('kbd');
        aKey.textContent = 'A';
        const aName = document.createElement('b');
        aName.textContent = 'Armor';
        const aDesc = document.createElement('span');
        aDesc.textContent = 'absorbs half the damage · 50 armor';
        const aPrice = document.createElement('em');
        aPrice.textContent = '$' + ARMOR_PRICE;
        armorRow.appendChild(aKey);
        armorRow.appendChild(aName);
        armorRow.appendChild(aDesc);
        armorRow.appendChild(aPrice);
        armorRow.addEventListener('click', () => onBuy('armor'));
        items.appendChild(armorRow);
      }
      menu.hidden = false;
    },
    hideBuyMenu() {
      const menu = el('buy-menu');
      if (menu) menu.hidden = true;
    },
    showScoreboard(rows) {
      const board = el('scoreboard');
      const body = el('scoreboard-body');
      if (!board || !body) return;
      body.innerHTML = '';
      for (const r of rows) {
        const tr = document.createElement('tr');
        for (const cell of [r.name, r.team, String(r.kills), String(r.deaths), '$' + r.money]) {
          const td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        }
        body.appendChild(tr);
      }
      board.hidden = false;
    },
    hideScoreboard() {
      const board = el('scoreboard');
      if (board) board.hidden = true;
    },
    overlay(show, title, copy) {
      const ov = el('overlay');
      if (!ov) return;
      if (title) setText('overlay-title', title);
      if (copy) setText('overlay-copy', copy);
      ov.hidden = !show;
    },
    setPlaying(playing) {
      const play = el('play');
      if (play) play.textContent = playing ? 'Click to resume' : 'Click to play';
    },
  };
}
