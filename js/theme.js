/* ============================================================
   无穹55 · 小窝 — 个性化（主题色 × 界面明暗 × 壁纸 × 透明度）
   独立模块：在 <head> 里引入（common.js 之前），先于页面渲染应用。

   设计（参考 Telegram / Discord 的做法）：
   - 主题色（accent）：只管强调色，珊瑚橙/湖水青/樱花粉/葡萄紫/薄荷绿
   - 界面明暗（mode）：浅色 / 深色 / 跟随壁纸（默认）——深色壁纸自动整套切深色，
     自定义图片通过 canvas 采样亮度自动判断
   - 两者可任意组合，如「葡萄紫 × 深色」
   数据存 localStorage(wq55_theme)。
   ============================================================ */
(function () {
  const KEY = 'wq55_theme';
  const DEFAULTS = { accent: 'coral', mode: 'auto', hero: 'theme', heroImg: '', wall: 'none', wallImg: '', dim: 0, alpha: 1, glass: false };
  const ACCENTS = [
    ['coral',  '#FF8A5C', '🍊 珊瑚橙'],
    ['teal',   '#2FB3A3', '🌊 湖水青'],
    ['pink',   '#F27B9D', '🌸 樱花粉'],
    ['violet', '#8B7CF0', '💜 葡萄紫'],
    ['mint',   '#2EB67D', '🌿 薄荷绿'],
    ['geek',   '#00E676', '🟢 极客黑客（终端绿+等宽字体）'],
  ];
  const MODES = [
    ['auto',  '✨ 跟随壁纸'],
    ['light', '☀️ 浅色'],
    ['dark',  '🌙 深色'],
  ];
  const WALLS = {
    g1: ['蓝天清晨', 'linear-gradient(180deg,#BEE3F8 0%,#FFF6E5 100%)', 'light'],
    g2: ['薄暮晚霞', 'linear-gradient(135deg,#C3B6F7 0%,#FBC2EB 55%,#FFDDE1 100%)', 'light'],
    g3: ['抹茶奶昔', 'linear-gradient(135deg,#C8E6C9 0%,#F5EEDC 100%)', 'light'],
    g4: ['深空夜幕', 'linear-gradient(160deg,#2B3A67 0%,#1F2C4D 100%)', 'dark'],
    mx: ['矩阵代码雨', '', 'dark'],
  };

  function load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { saved = {}; }
    const t = Object.assign({}, DEFAULTS, saved);
    // 旧版本迁移：preset -> accent + mode
    if (saved.preset) {
      if (saved.preset === 'dark') { t.accent = 'coral'; t.mode = 'dark'; }
      else t.accent = saved.preset;
    }
    return t;
  }
  function save(t) {
    try { localStorage.setItem(KEY, JSON.stringify(t)); }
    catch (e) { toastSafe('存储空间不足，壁纸可能太大啦'); }
  }
  function toastSafe(msg) {
    const el = document.querySelector('.toast');
    if (el) { el.textContent = msg; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2400); }
  }

  /* ---------- 壁纸亮度检测：采样 16×16 像素求平均亮度 ---------- */
  const brightCache = {};
  function wallpaperIsDark(src) {
    if (!src) return null;
    if (brightCache[src] !== undefined) return brightCache[src];
    return new Promise(resolve => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => {
        try {
          const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16;
          const cx = cv.getContext('2d');
          cx.drawImage(im, 0, 0, 16, 16);
          const d = cx.getImageData(0, 0, 16, 16).data;
          let lum = 0;
          for (let i = 0; i < d.length; i += 4) lum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const dark = (lum / (d.length / 4) / 255) < 0.42;
          brightCache[src] = dark;
          resolve(dark);
        } catch (e) { resolve(null); }
      };
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  /* ---------- 首页横幅：跟随主题色 / 全班名字云 / 自定义照片 ---------- */
  function decorateHero(t) {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    hero.dataset.heromode = t.hero;
    hero.style.backgroundImage = (t.hero === 'photo' && t.heroImg) ? 'url("' + t.heroImg + '")' : '';

    // 遮罩：照片模式保文字可读；深色模式压暗渐变
    const isPhoto = t.hero === 'photo' && t.heroImg;
    const isDark = document.documentElement.dataset.mode === 'dark';
    let scrim = hero.querySelector('.hero-scrim');
    if (isPhoto || isDark) {
      if (!scrim) { scrim = document.createElement('div'); scrim.className = 'hero-scrim'; hero.prepend(scrim); }
      scrim.className = 'hero-scrim ' + (isPhoto ? 'photo' : 'dark');
    } else if (scrim) scrim.remove();

    // 名字云：名字来自成员墙，新人上墙自动出现
    let layer = hero.querySelector('.hero-names');
    if (t.hero === 'names') {
      if (!layer) { layer = document.createElement('div'); layer.className = 'hero-names'; hero.prepend(layer); }
      let names = [];
      try { names = JSON.parse(localStorage.getItem('wq55_members') || '[]').map(m => m.name); } catch (e) {}
      if (!names.length) names = ['无穹55', '我们的小窝', '常回来看看'];
      layer.innerHTML = names.map(nm => {
        let h = 0;
        for (const ch of nm) h = (h * 33 + ch.codePointAt(0)) >>> 0;
        const safe = String(nm).replace(/[<>&"']/g, '');
        const size = 13 + (h % 15);                    // 13~27px
        const left = 2 + ((h >> 4) % 90);              // 2%~92%
        const top = 4 + ((h >> 8) % 82);               // 4%~86%
        const rot = ((h >> 12) % 22) - 11;             // ±11°
        const op = (10 + ((h >> 16) % 13)) / 100;      // 0.10~0.22
        return `<span style="left:${left}%;top:${top}%;font-size:${size}px;transform:rotate(${rot}deg);opacity:${op}">${safe}</span>`;
      }).join('');
    } else if (layer) layer.remove();
  }

  /* ---------- 矩阵雨画布（壁纸"矩阵代码雨"，零依赖 canvas 实现） ---------- */
  let matrixRAF = null, matrixCv = null;
  function startMatrix() {
    if (matrixRAF) return;
    matrixCv = document.createElement('canvas');
    matrixCv.id = 'matrix-layer';
    matrixCv.className = 'matrix-layer';
    document.body.prepend(matrixCv);
    const ctx = matrixCv.getContext('2d');
    const fs = 16;
    const chars = 'アカサタナハマヤラワエオ01<>/{}[]$#*+=;:.'.split('');
    let drops = [];
    const fit = () => {
      matrixCv.width = innerWidth; matrixCv.height = innerHeight;
      drops = Array(Math.ceil(innerWidth / fs)).fill(0).map(() => Math.random() * -60);
    };
    fit();
    let last = 0;
    const draw = t => {
      matrixRAF = requestAnimationFrame(draw);
      if (t - last < 50) return;                 // ~20fps：效果够、耗电低
      last = t;
      ctx.fillStyle = 'rgba(7,11,12,.14)';
      ctx.fillRect(0, 0, matrixCv.width, matrixCv.height);
      ctx.font = fs + 'px monospace';
      drops.forEach((y, i) => {
        ctx.fillStyle = Math.random() < .07 ? '#C8FFE3' : 'rgba(0,230,118,.8)';
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * fs, y * fs);
        drops[i] = (y * fs > matrixCv.height && Math.random() > .975) ? 0 : y + 1;
      });
    };
    matrixRAF = requestAnimationFrame(draw);
    window.addEventListener('resize', fit);
    matrixCv._fit = fit;
  }
  function stopMatrix() {
    if (matrixRAF) cancelAnimationFrame(matrixRAF);
    matrixRAF = null;
    if (matrixCv) { matrixCv._fit && window.removeEventListener('resize', matrixCv._fit); matrixCv.remove(); matrixCv = null; }
  }

  function apply() {
    const t = load();
    document.documentElement.dataset.accent = t.accent;
    let wall = document.getElementById('wall-layer');
    let dim = document.getElementById('dim-layer');
    if (document.body) {
      if (!wall) { wall = document.createElement('div'); wall.id = 'wall-layer'; wall.className = 'wall-layer'; document.body.prepend(wall); }
      if (!dim) { dim = document.createElement('div'); dim.id = 'dim-layer'; dim.className = 'dim-layer'; document.body.prepend(dim); }
      if (t.wall === 'mx') {
        wall.style.display = 'none';
        if (!document.hidden) startMatrix();
      } else {
        stopMatrix();
        if (t.wall === 'none') { wall.style.display = 'none'; }
        else {
          wall.style.display = 'block';
          const img = t.wall === 'custom' ? t.wallImg : (WALLS[t.wall] ? WALLS[t.wall][1] : '');
          wall.style.background = img + ' center/cover no-repeat fixed';
        }
      }
      // 扫描线：极客主题点睛
      let scan = document.getElementById('scan-layer');
      if (t.accent === 'geek') {
        if (!scan) { scan = document.createElement('div'); scan.id = 'scan-layer'; scan.className = 'scan-layer'; document.body.prepend(scan); }
      } else if (scan) scan.remove();
      // logo 变终端提示符
      const ico = document.querySelector('.logo-ico');
      if (ico) ico.textContent = t.accent === 'geek' ? '>_' : '🏠';
    }
    const r = document.documentElement.style;
    r.setProperty('--card-alpha', t.alpha);
    r.setProperty('--glass', t.glass ? 'blur(14px)' : 'none');
    r.setProperty('--dim', t.dim);

    /* 明暗判定 */
    const setMode = dark => { document.documentElement.dataset.mode = dark ? 'dark' : 'light'; };
    let p;
    if (t.accent === 'geek') p = Promise.resolve(true);          // 极客风自带深色
    else if (t.mode === 'dark') p = Promise.resolve(true);
    else if (t.mode === 'light') p = Promise.resolve(false);
    else if (t.wall === 'none') p = Promise.resolve(false);
    else if (t.wall === 'mx') p = Promise.resolve(true);
    else if (t.wall === 'custom') p = wallpaperIsDark(t.wallImg).then(d => d === true);
    else p = Promise.resolve(WALLS[t.wall][2] === 'dark');
    // 先按已知信息立即设置，异步检测结果回来后再修正（避免闪烁）
    setMode(t.accent === 'geek' || t.mode === 'dark' || (t.mode === 'auto' && (t.wall === 'g4' || t.wall === 'mx')));
    p.then(dark => { setMode(dark); decorateHero(load()); });
    decorateHero(t);
  }

  /* ---------- ⚙️ 个性化面板 ---------- */
  function openSettings() {
    const t = load();
    document.getElementById('navGear')?.blur();
    const mask = document.createElement('div');
    mask.className = 'modal-mask show';
    mask.innerHTML = `
    <div class="modal" style="width:min(520px,94vw)">
      <h3>🎨 个性化我的小窝</h3>

      <div class="set-row"><b>主题色（强调色）</b><div class="chips" id="setAccents">
        ${ACCENTS.map(a => `<span class="swatch ${t.accent === a[0] ? 'on' : ''}" data-a="${a[0]}" title="${a[2]}" style="background:${a[1]}"></span>`).join('')}
      </div></div>

      <div class="set-row"><b>界面明暗</b><div class="chips" id="setModes">
        ${MODES.map(m => `<span class="chip ${t.mode === m[0] ? 'on' : ''}" data-m="${m[0]}">${m[1]}</span>`).join('')}
        <span class="small muted" style="align-self:center">深色壁纸会自动切换整套深色界面</span>
      </div></div>

      <div class="set-row"><b>🏠 首页横幅（就是顶部那个大banner）</b><div class="chips" id="setHeros">
        <span class="chip ${t.hero === 'theme' ? 'on' : ''}" data-h="theme">🌈 跟随主题色</span>
        <span class="chip ${t.hero === 'names' ? 'on' : ''}" data-h="names">🧑‍🤝‍🧑 全班名字云</span>
        <span class="chip ${t.hero === 'photo' ? 'on' : ''}" data-h="photo">🖼️ 自定义照片</span>
      </div>
      <div id="setHeroBox" style="display:${t.hero === 'photo' ? 'block' : 'none'};margin-top:10px">
        <label class="img-pick">📤 上传横幅照片
          <input type="file" id="setHeroFile" accept="image/*" hidden>
        </label>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input class="input" id="setHeroUrl" placeholder="或粘贴图片链接 https://…" value="${t.heroImg && !t.heroImg.startsWith('data:') ? t.heroImg : ''}">
          <button class="btn sm ghost" id="setHeroUrlBtn">应用链接</button>
        </div>
        <div class="small muted" style="margin-top:6px">名字云的名字来自「同学们」成员墙，新同学上墙会自动飘进横幅里</div>
      </div></div>

      <div class="set-row"><b>壁纸</b><div id="setWalls" style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="wall-opt ${t.wall === 'none' ? 'on' : ''}" data-w="none" style="background:var(--bg-2);color:var(--ink-2);text-shadow:none">默认奶油</span>
        ${Object.entries(WALLS).map(([k, v]) => `<span class="wall-opt ${t.wall === k ? 'on' : ''}" data-w="${k}" style="background:${v[1] || '#0B3A26'}">${v[0]}</span>`).join('')}
        <span class="wall-opt ${t.wall === 'custom' ? 'on' : ''}" data-w="custom" style="background:var(--primary-soft);color:var(--primary-2);text-shadow:none">🖼️ 自定义</span>
      </div>
      <div id="setCustomBox" style="display:${t.wall === 'custom' ? 'block' : 'none'};margin-top:10px">
        <label class="img-pick">📤 上传本地图片
          <input type="file" id="setWallFile" accept="image/*" hidden>
        </label>
        <div style="display:flex;gap:8px;margin-top:8px">
          <input class="input" id="setWallUrl" placeholder="或粘贴图片链接 https://…" value="${t.wallImg && !t.wallImg.startsWith('data:') ? t.wallImg : ''}">
          <button class="btn sm ghost" id="setWallUrlBtn">应用链接</button>
        </div>
        <div class="small muted" style="margin-top:6px">上传的壁纸只存在这台浏览器里；明暗设为"跟随壁纸"时会自动判断图片深浅</div>
      </div></div>

      <div class="set-row"><b>卡片不透明度 <span class="range-val" id="setAlphaVal">${Math.round(t.alpha * 100)}%</span></b>
        <input type="range" id="setAlpha" min="55" max="100" value="${Math.round(t.alpha * 100)}">
      </div>
      <div class="set-row"><b>壁纸遮罩浓度 <span class="range-val" id="setDimVal">${Math.round(t.dim * 100)}%</span></b>
        <input type="range" id="setDim" min="0" max="60" value="${Math.round(t.dim * 100)}">
        <div class="small muted" style="margin-top:4px">壁纸太花看不清字时，加深一点遮罩（Telegram 同款思路）</div>
      </div>
      <div class="set-row">
        <label class="switch"><input type="checkbox" id="setGlass" ${t.glass ? 'checked' : ''}><span class="track"></span>毛玻璃效果（配合透明度食用更佳）</label>
      </div>

      <div class="set-row"><b>🔗 数据互通（后端服务器，班委配置）</b>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input class="input" id="setServerUrl" placeholder="如 http://127.0.0.1:8090（留空=纯本地模式）" value="${(window.WQSync && WQSync.getServer()) || ''}" style="flex:1;min-width:200px">
          <button class="btn sm ghost" id="setServerSave">保存并连接</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <button class="btn sm teal" id="setServerUpload">⬆️ 全量上传本机数据</button>
          <button class="btn sm ghost" id="setServerPull">⬇️ 立即同步</button>
          <span class="small muted" id="setServerStat" style="align-self:center"></span>
        </div>
        <div class="small muted" style="margin-top:6px">填上班级服务器的 PocketBase 地址，全班看到的就是同一份数据（动态/照片/提问箱…）；不填则和现在一样各玩各的。本地开发填 http://127.0.0.1:8090</div>
      </div>

      <div class="m-actions" style="justify-content:space-between">
        <button class="btn ghost sm" id="setReset">恢复默认</button>
        <button class="btn" id="setDone">完成 ✨</button>
      </div>
    </div>`;
    document.body.appendChild(mask);

    const upd = (patch) => { const nt = Object.assign(load(), patch); save(nt); apply(); return nt; };
    mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
    mask.querySelector('#setDone').onclick = () => { mask.remove(); if (window.emojiBurst) emojiBurst(['🎨', '✨', '🏠']); };

    mask.querySelectorAll('#setAccents .swatch').forEach(s => s.onclick = () => {
      mask.querySelectorAll('#setAccents .swatch').forEach(x => x.classList.toggle('on', x === s));
      upd({ accent: s.dataset.a });
    });
    mask.querySelectorAll('#setModes .chip').forEach(c => c.onclick = () => {
      mask.querySelectorAll('#setModes .chip').forEach(x => x.classList.toggle('on', x === c));
      upd({ mode: c.dataset.m });
    });
    const heroBox = mask.querySelector('#setHeroBox');
    mask.querySelectorAll('#setHeros .chip').forEach(c => c.onclick = () => {
      mask.querySelectorAll('#setHeros .chip').forEach(x => x.classList.toggle('on', x === c));
      heroBox.style.display = c.dataset.h === 'photo' ? 'block' : 'none';
      upd({ hero: c.dataset.h });
    });
    mask.querySelector('#setHeroUrlBtn').onclick = () => {
      const u = mask.querySelector('#setHeroUrl').value.trim();
      if (!/^https?:\/\//.test(u)) { toastSafe('链接要以 http(s):// 开头哦'); return; }
      upd({ hero: 'photo', heroImg: u }); toastSafe('横幅照片已应用 🖼️');
    };
    mask.querySelector('#setHeroFile').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        const fn = window.compressImage || null;
        if (!fn) { toastSafe('页面还没加载完，稍后再试'); return; }
        const dataUrl = await fn(f, 1600, .75);
        upd({ hero: 'photo', heroImg: dataUrl });
        toastSafe('横幅照片已应用 🖼️');
      } catch (err) { toastSafe('这张图读不出来，换一张试试？'); }
    });
    const wallBox = mask.querySelector('#setCustomBox');
    mask.querySelectorAll('#setWalls .wall-opt').forEach(w => w.onclick = () => {
      mask.querySelectorAll('#setWalls .wall-opt').forEach(x => x.classList.toggle('on', x === w));
      wallBox.style.display = w.dataset.w === 'custom' ? 'block' : 'none';
      upd({ wall: w.dataset.w });
    });
    mask.querySelector('#setAlpha').oninput = e => {
      mask.querySelector('#setAlphaVal').textContent = e.target.value + '%';
      upd({ alpha: e.target.value / 100 });
    };
    mask.querySelector('#setDim').oninput = e => {
      mask.querySelector('#setDimVal').textContent = e.target.value + '%';
      upd({ dim: e.target.value / 100 });
    };
    mask.querySelector('#setGlass').onchange = e => upd({ glass: e.target.checked });
    mask.querySelector('#setWallUrlBtn').onclick = () => {
      const u = mask.querySelector('#setWallUrl').value.trim();
      if (!/^https?:\/\//.test(u)) { toastSafe('链接要以 http(s):// 开头哦'); return; }
      upd({ wall: 'custom', wallImg: u }); toastSafe('壁纸已应用 🖼️');
    };
    mask.querySelector('#setWallFile').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        const fn = window.compressImage || null;
        if (!fn) { toastSafe('页面还没加载完，稍后再试'); return; }
        const dataUrl = await fn(f, 1600, .75);
        upd({ wall: 'custom', wallImg: dataUrl });
        toastSafe('壁纸已应用 🖼️');
      } catch (err) { toastSafe('这张图读不出来，换一张试试？'); }
    });
    mask.querySelector('#setReset').onclick = () => {
      localStorage.removeItem(KEY);
      mask.remove(); apply(); toastSafe('已恢复默认装扮');
    };

    /* 数据互通服务器 */
    const syncStat = mask.querySelector('#setServerStat');
    mask.querySelector('#setServerSave').onclick = async () => {
      if (!window.WQSync) { toastSafe('同步组件未加载'); return; }
      const u = WQSync.setServer(mask.querySelector('#setServerUrl').value);
      if (!u) { toastSafe('已切回纯本地模式'); return; }
      syncStat.textContent = '连接中…';
      try {
        const changed = await WQSync.pull();
        syncStat.textContent = '✅ 已连接，更新 ' + changed.length + ' 个板块';
        toastSafe('数据互通已开启 🎉');
      } catch (e) { syncStat.textContent = '⚠️ 连不上服务器'; }
    };
    mask.querySelector('#setServerUpload').onclick = async () => {
      if (!window.WQSync || !WQSync.getServer()) { toastSafe('先填服务器地址并保存'); return; }
      syncStat.textContent = '上传中…';
      try {
        const n = await WQSync.uploadAll();
        syncStat.textContent = '✅ 已排队上传 ' + n + ' 条记录';
        toastSafe('本机数据已上传到服务器 ⬆️');
      } catch (e) { syncStat.textContent = '⚠️ 上传失败'; }
    };
    mask.querySelector('#setServerPull').onclick = async () => {
      if (!window.WQSync || !WQSync.getServer()) { toastSafe('先填服务器地址并保存'); return; }
      syncStat.textContent = '同步中…';
      try {
        const changed = await WQSync.pull();
        syncStat.textContent = '✅ 更新了 ' + changed.length + ' 个板块';
        toastSafe('同步完成 ⬇️');
      } catch (e) { syncStat.textContent = '⚠️ 同步失败'; }
    };
  }

  /* 立即应用（head 阶段：设置 CSS 变量；body 就绪后补壁纸层） */
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.addEventListener('click', e => {
      if (e.target.closest('#navGear')) openSettings();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopMatrix();
      else if (load().wall === 'mx') startMatrix();
    });
  });
})();
