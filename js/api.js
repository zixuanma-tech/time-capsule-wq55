/* ============================================================
   无穹55 · 小窝 — 数据同步层（v2）
   可选后端：PocketBase（wq_records 表：bucket + rid + data）

   设计原则：
   · 本地优先：没有服务器时网站和原来一模一样（localStorage）
   · 记录级同步：按每条记录的 id 比对，后写覆盖（__u 时间戳）
   · 删除同步：删除记录会推送"墓碑"，其他设备拉取后同样删除
   · 断网静默：服务器不可达时不报错、不阻塞，本地照常使用
   注意：me（昵称）和 theme（个性化）永远只在本地，不同步。
   ============================================================ */
(function () {
  const SYNC_KEYS = ['photos', 'messages', 'daily', 'teams', 'xposts', 'honors', 'members', 'askbox', 'birthdays', 'events'];
  const TOMB = '__wq_deleted';

  let serverUrl = (localStorage.getItem('wq55_server') || '').replace(/\/+$/, '');
  let jobQueue = [];
  let pushTimer = null;
  let pulling = false;

  function api(path, opts) {
    return fetch(serverUrl + path, opts).then(r =>
      r.ok ? r.json() : r.json().then(e => Promise.reject(e)));
  }
  function jsonOpts(method, body) {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }

  /* ---------- 写入钩子：WQ.set 时计算差异并排队推送 ---------- */
  WQ.onWrite = function (key, val) {
    if (!serverUrl || !SYNC_KEYS.includes(key) || !Array.isArray(val)) return val;
    try {
      const old = WQ.get(key, []);
      const oldMap = new Map(old.map(r => [String(r.id), r]));
      const seen = new Set();
      const jobs = [];
      const now = Date.now();
      for (const rec of val) {
        const rid = String(rec && rec.id || '');
        if (!rid) continue;
        seen.add(rid);
        const before = oldMap.get(rid);
        if (!before || JSON.stringify(before) !== JSON.stringify(rec)) {
          rec.__u = now;                      // 本地记录盖上同步时间戳（LWW 依据）
          jobs.push({ bucket: key, rid, data: rec });
        }
      }
      for (const rid of oldMap.keys()) {
        if (!seen.has(rid)) jobs.push({ bucket: key, rid, data: { id: rid, [TOMB]: true, __u: now } });
      }
      queue(jobs);
    } catch (e) { /* 同步失败不影响本地写入 */ }
    return val;
  };

  function queue(jobs) {
    if (!jobs.length) return;
    jobQueue.push(...jobs);
    clearTimeout(pushTimer);
    pushTimer = setTimeout(flush, 1500);
  }

  async function flush() {
    if (!serverUrl || !jobQueue.length) return;
    const jobs = jobQueue.splice(0, 100);
    for (const j of jobs) {
      try {
        const q = encodeURIComponent(`(bucket='${j.bucket}' && rid='${j.rid}')`);
        const found = await api(`/api/collections/wq_records/records?filter=${q}&perPage=1&fields=id`);
        const items = found.items || [];
        if (items.length) {
          await api(`/api/collections/wq_records/records/${items[0].id}`, jsonOpts('PATCH', { bucket: j.bucket, rid: j.rid, data: j.data }));
        } else {
          await api('/api/collections/wq_records/records', jsonOpts('POST', { bucket: j.bucket, rid: j.rid, data: j.data }));
        }
      } catch (e) {
        jobQueue.push(j);          // 网络/服务器问题：塞回队列，稍后重试
        clearTimeout(pushTimer);
        pushTimer = setTimeout(flush, 8000);
        return;
      }
    }
    if (jobQueue.length) flush();
  }

  /* ---------- 拉取合并：服务器记录与本地按 id 合并，__u 大者胜 ---------- */
  async function pull() {
    if (!serverUrl || pulling) return [];
    pulling = true;
    const changed = [];
    try {
      for (const key of SYNC_KEYS) {
        const serverRecs = [];
        for (let page = 1; page <= 10; page++) {
          const q = encodeURIComponent(`bucket='${key}'`);
          const res = await api(`/api/collections/wq_records/records?filter=${q}&perPage=200&page=${page}&fields=rid,data`);
          const items = res.items || [];
          serverRecs.push(...items);
          if (items.length < 200) break;
        }
        const local = WQ.get(key, []);
        const map = new Map(local.map(r => [String(r.id), r]));
        let dirty = false;
        const needPush = [];
        for (const sr of serverRecs) {
          const d = sr.data || {};
          if (d[TOMB]) {
            if (map.has(sr.rid)) { map.delete(sr.rid); dirty = true; }
            continue;
          }
          const cur = map.get(sr.rid);
          if (!cur) { map.set(sr.rid, d); dirty = true; continue; }
          if (JSON.stringify(cur) === JSON.stringify(d)) continue;
          const curU = cur.__u || cur.ts || 0;
          const newU = d.__u || d.ts || 0;
          if (newU > curU) { map.set(sr.rid, d); dirty = true; }
          else if (curU > newU) { needPush.push({ bucket: key, rid: sr.rid, data: cur }); }
        }
        if (dirty) { WQ.setQuiet(key, [...map.values()]); changed.push(key); }
        if (needPush.length) queue(needPush);   // 本地更新，反推给服务器
      }
    } catch (e) { /* 服务器不可达：静默 */ }
    pulling = false;
    if (changed.length) {
      try { window.__wqRerender && window.__wqRerender(); } catch (e) {}
    }
    return changed;
  }

  /* ---------- 全量上传（班委初始化服务器用） ---------- */
  async function uploadAll() {
    if (!serverUrl) return 0;
    let n = 0;
    for (const key of SYNC_KEYS) {
      const val = WQ.get(key, []);
      const now = Date.now();
      const jobs = val.filter(r => r && r.id).map(r => (r.__u = r.__u || now, { bucket: key, rid: String(r.id), data: r }));
      queue(jobs);
      n += jobs.length;
    }
    clearTimeout(pushTimer);
    await flush();
    return n;
  }

  /* ---------- 对外接口 ---------- */
  window.WQSync = {
    getServer: () => serverUrl,
    setServer(u) {
      serverUrl = (u || '').trim().replace(/\/+$/, '');
      serverUrl ? localStorage.setItem('wq55_server', serverUrl) : localStorage.removeItem('wq55_server');
      return serverUrl;
    },
    pull,
    uploadAll,
    flush,
    keys: SYNC_KEYS,
  };

  /* 启动即拉取 + 每分钟轮询 + 回到页签时拉取 */
  document.addEventListener('DOMContentLoaded', () => setTimeout(pull, 300));
  setInterval(pull, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
})();
