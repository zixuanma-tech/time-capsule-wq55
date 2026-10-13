/* ============================================================
   无穹55 · 小窝 — 公共脚本
   数据存 localStorage（wq55_ 前缀），后续可无缝换成后端 API
   ============================================================ */
const WQ = {
  prefix: 'wq55_',

  /* ---- 存储 ---- */
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(this.prefix + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  },
  set(key, val) {
    try {
      // 同步层钩子（js/api.js）：可对数据盖时间戳并推送服务器；无同步层时无感
      if (typeof this.onWrite === 'function') {
        try { const r = this.onWrite(key, val); if (r !== undefined && r !== null) val = r; } catch (e) {}
      }
      localStorage.setItem(this.prefix + key, JSON.stringify(val));
      return true;
    } catch (e) {
      toast('💾 存储空间满了，试试清理一些旧照片～', 'warn');
      return false;
    }
  },
  /* 静默写入：同步层拉取合并落盘用，不再触发 onWrite（避免回环推送） */
  setQuiet(key, val) {
    try { localStorage.setItem(this.prefix + key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  },

  /* 只在首次写入种子数据（用 v2 前缀：功能更新后新板块也能补种子，但绝不覆盖用户数据） */
  seed(key, data) {
    const flag = this.prefix + 'seed2_' + key;
    if (!localStorage.getItem(flag)) {
      if (localStorage.getItem(this.prefix + key) === null) this.set(key, data);
      localStorage.setItem(flag, '1');
    }
  },
  resetAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith(this.prefix))
      .forEach(k => localStorage.removeItem(k));
  },

  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  fmt(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
  },
  /* 距离下一个 MM-DD 还有几天（生日/纪念日用） */
  daysUntil(mmdd) {
    const [m, d] = mmdd.split('-').map(Number);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    let t = new Date(now.getFullYear(), m - 1, d);
    if (t < now) t = new Date(now.getFullYear() + 1, m - 1, d);
    return Math.round((t - now) / 86400000);
  },
  /* 距离 YYYY-MM-DD 的天数（活动倒计时用，过期返回负数） */
  daysToDate(ymd) {
    const t = new Date(ymd + 'T00:00:00');
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((t - now) / 86400000);
  },
  avatarOf(name, emoji) {
    const pool = ['🐧','🐯','🐼','🦊','🐰','🐸','🐙','🦄','🐨','🐷','🐵','🐔','🦁','🐮'];
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return emoji || pool[h % pool.length];
  },
  pastelOf(seed) {
    const cs = [
      ['#FFE9DD','#F2703F'], ['#E0F5F1','#1E9C8D'], ['#FFF3D6','#C08A00'],
      ['#FFE9EF','#E05C7E'], ['#EFECFF','#7A6BE0'], ['#E4F6FF','#1D8FC4'],
    ];
    let h = 0;
    for (const ch of String(seed)) h = (h * 33 + ch.codePointAt(0)) >>> 0;
    const [bg, fg] = cs[h % cs.length];
    return `background:${bg};color:${fg}`;
  }
};

/* ---- toast ---- */
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ---- 身份：我是谁（本地昵称，纯前端版不设密码） ---- */
function getMe() { return WQ.get('me', null); }
function ensureMe(autoOpen) {
  const me = getMe();
  if (me) return me;
  if (autoOpen !== false) openNameModal();
  return null;
}
function openNameModal() {
  let mask = document.getElementById('nameModal');
  if (!mask) {
    mask = document.createElement('div');
    mask.id = 'nameModal'; mask.className = 'modal-mask';
    mask.innerHTML = `
      <div class="modal">
        <h3>🙋 先告诉小窝你是谁～</h3>
        <div class="field">
          <label>你的昵称（真名或外号都行）</label>
          <input class="input" id="nameInput" maxlength="12" placeholder="比如：奶龙爱好者">
        </div>
        <div class="m-actions">
          <button class="btn" id="nameOk">进入小窝 🏠</button>
        </div>
      </div>`;
    document.body.appendChild(mask);
    mask.querySelector('#nameOk').onclick = () => {
      const v = mask.querySelector('#nameInput').value.trim();
      if (!v) { toast('昵称不能为空哦'); return; }
      WQ.set('me', { name: v, ts: Date.now() });
      mask.classList.remove('show');
      toast(`欢迎回家，${v}！(๑•̀ㅂ•́)و✧`);
      renderMe();
      emojiBurst(['🏠', '🎉', '🐲']);
    };
    mask.addEventListener('keydown', e => { if (e.key === 'Enter') mask.querySelector('#nameOk').click(); });
  }
  mask.classList.add('show');
  setTimeout(() => mask.querySelector('#nameInput')?.focus(), 60);
}
function renderMe() {
  const btn = document.getElementById('navMe');
  if (!btn) return;
  const me = getMe();
  if (me) {
    btn.innerHTML = `<span class="avatar">${WQ.avatarOf(me.name)}</span>${WQ.esc(me.name)}`;
    btn.onclick = openNameModal; // 点头像可改名
    btn.title = '点我可以改昵称';
  } else {
    btn.innerHTML = `<span class="avatar">👻</span>我是谁？`;
    btn.onclick = openNameModal;
  }
}

/* ---- 彩蛋：奶龙驾到 ---- */
function confetti(n = 90) {
  const colors = ['#FF8A5C','#FFC94D','#3FB8A8','#FF9EB5','#9B8CFF','#7ADFF5'];
  for (let i = 0; i < n; i++) {
    const b = document.createElement('div');
    b.className = 'confetti-bit';
    const s = 6 + Math.random() * 8;
    b.style.cssText = `left:${Math.random()*100}vw;width:${s}px;height:${s*0.6}px;
      background:${colors[i % colors.length]};
      animation-duration:${2.2 + Math.random()*2}s;animation-delay:${Math.random()*0.6}s`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 5200);
  }
}
function nailongVisits() {
  if (document.querySelector('.nailong')) return;
  const nl = document.createElement('div');
  nl.className = 'nailong';
  nl.textContent = '🐲';
  nl.style.left = (12 + Math.random() * 60) + 'vw';
  nl.style.top = '34vh';
  nl.title = '点我一下试试';
  document.body.appendChild(nl);
  let clicks = 0;
  const quotes = [
    '奶龙：无穹55最有味！',
    '奶龙：谁在叫我？',
    '奶龙：这个班 website 真不错（点头）',
    '奶龙：生日要吃蛋糕，组队要带我！',
  ];
  nl.addEventListener('click', () => {
    confetti(50);
    toast(quotes[clicks++ % quotes.length]);
    if (clicks >= 3) { nl.remove(); toast('奶龙满意地走了 🐲💨'); }
  });
  setTimeout(() => nl.remove(), 15000);
}

/* ---- 导航栏激活态 / 移动端菜单 / Logo 彩蛋 ---- */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page || '';
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.dataset.nav === page) a.classList.add('active');
  });
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) toggle.addEventListener('click', () => links.classList.toggle('open'));

  renderMe();

  // 点 logo 五次 → 奶龙乱入
  const logo = document.querySelector('.logo');
  if (logo) {
    let n = 0, t = 0;
    logo.addEventListener('click', () => {
      const now = Date.now();
      if (now - t > 2500) n = 0;
      t = now;
      if (++n >= 5) { n = 0; nailongVisits(); document.body.classList.add('shake'); setTimeout(()=>document.body.classList.remove('shake'), 500); }
    });
  }
});

/* ---- 图片压缩（上传照片防 localStorage 爆掉） ---- */
function compressImage(file, maxSide = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

/* ---- emoji 迸发引擎（参考 GitHub 合并 PR 的 emoji 雨，零依赖） ---- */
function emojiBurst(emojis, opts = {}) {
  const list = (Array.isArray(emojis) && emojis.length) ? emojis : ['🎉', '✨'];
  const prev = document.getElementById('emoji-canvas');
  if (prev) prev.remove();
  const cv = document.createElement('canvas');
  cv.id = 'emoji-canvas';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const ox = opts.x ?? innerWidth / 2;
  const oy = opts.y ?? innerHeight * 0.75;
  const ps = [];
  for (let i = 0; i < (opts.n ?? 28); i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
    const sp = 6.5 + Math.random() * 8;
    ps.push({
      e: list[i % list.length],
      x: ox + (Math.random() - 0.5) * 60, y: oy,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
      r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.28,
      s: 18 + Math.random() * 18, life: 1,
    });
  }
  let last = null;
  // 兜底：标签页在后台时 requestAnimationFrame 会被暂停，用定时器保证画布终会移除
  const guard = setTimeout(() => cv.remove(), 3500);
  (function frame(t) {
    if (last === null) last = t;
    const steps = Math.min(3, Math.max(1, Math.round((t - last) / 16.7)));
    last = t;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = false;
    for (const p of ps) {
      for (let s = 0; s < steps; s++) { p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.r += p.vr; }
      p.life -= 0.011 * steps;
      if (p.life > 0 && p.y < innerHeight + 60) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.font = p.s + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(p.e, 0, 0);
        ctx.restore();
      }
    }
    if (alive) requestAnimationFrame(frame);
    else { clearTimeout(guard); cv.remove(); }
  })(performance.now());
}

/* ---- lightbox（照片墙 & 动态图片共用） ---- */
function openLightbox(src, cap, isHolder) {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox'; lb.className = 'lightbox';
    lb.addEventListener('click', () => lb.classList.remove('show'));
    document.body.appendChild(lb);
  }
  lb.innerHTML = isHolder
    ? `<div class="lb-holder" style="${src}">${cap}</div><div class="lb-cap">（占位图，等你的真照片～）</div>`
    : `<img src="${src}"><div class="lb-cap">${cap}</div>`;
  lb.classList.add('show');
}
