// 随机操作压力测试:在模拟的微信环境里乱点几千下,看游戏会不会出错、卡死,或者出现不合理的状态(钱变成负数、两个摊位叠在一格等)。
// 用法(在放着 night-market-game 的文件夹里运行):
//   node tools/monkey_test.mjs                 依次测五种屏幕,每种跑 3 个随机种子
//   node tools/monkey_test.mjs 375 812 80 7    只测一种:屏幕宽 高、胶囊按钮底边、随机种子(出问题时用同样的参数能复现)
//   末尾再加 play 是「会玩」模式:大部分操作是正常进货、摆摊、开张、点弹窗按钮,用来覆盖通关、无尽、破产这些后期流程
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

if (process.argv.length < 6) {
  const screens = [[375, 812, 80], [360, 640, 56], [414, 896, 88], [768, 1024, 60], [1024, 768, 60]]; let bad = 0;
  const jobs = []; for (const sc of screens) for (const seed of [1, 2, 3]) jobs.push([...sc, seed]);
  for (const sc of screens.slice(0, 3)) for (const seed of [11, 12, 13, 14]) jobs.push([...sc, seed, 'play']);
  for (const job of jobs) {
    const sc = job; const r = spawnSync(process.execPath, [process.argv[1], ...job.map(String)], { encoding: 'utf8' });
    process.stdout.write(r.stdout); if (r.status) { bad++; process.stdout.write(r.stderr.split('\n').slice(0, 6).join('\n') + '\n'); }
  }
  console.log(bad ? `有 ${bad} 组没通过` : `全部 ${jobs.length} 组通过`); process.exit(bad ? 1 : 0);
}

const [SW, SH, CAP, SEED] = process.argv.slice(2, 6).map(Number), PLAY = process.argv[6] === 'play', ACTIONS = PLAY ? 9000 : 4000;
let rs = SEED * 2654435761 >>> 0;                                      // 固定种子的随机数,保证能复现
Math.random = () => { rs = (rs + 0x6D2B79F5) | 0; let t = Math.imul(rs ^ rs >>> 15, rs | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rnd = n => Math.random() * n | 0;

const errors = []; console.error = (...a) => { errors.push(a.map(x => x && x.stack || String(x)).join(' ')); };
const grad = { addColorStop() { } };
const mkCtx = () => new Proxy({}, {
  get(t, k) { if (k in t) return t[k]; if (k === 'measureText') return s => ({ width: String(s).length * 8 }); if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad; if (k === 'createPattern') return () => ({}); return () => { }; },
  set(t, k, v) { t[k] = v; return true; },
});
const store = new Map(); let touchStart, touchEnd, raf;
const audioNode = new Proxy({}, { get: (t, k) => k === 'currentTime' ? 0 : k === 'state' ? 'running' : k === 'frequency' || k === 'gain' ? audioNode : () => audioNode });
if (SEED % 2) store.set('tut', '1');                                   // 一半的种子跳过新手引导,另一半从引导开始乱点
globalThis.__NM_TEST__ = true;
globalThis.wx = {
  createCanvas: () => ({ width: 0, height: 0, getContext: mkCtx, toTempFilePathSync: () => 'tmp/share.png' }),
  getSystemInfoSync: () => ({ windowWidth: SW, windowHeight: SH, pixelRatio: 3, statusBarHeight: 44 }),
  getMenuButtonBoundingClientRect: () => ({ bottom: CAP }),
  onTouchStart: cb => { touchStart = cb; }, onTouchEnd: cb => { touchEnd = cb; },
  createImage: () => { const im = { width: 320, height: 320 }; Object.defineProperty(im, 'src', { set() { setTimeout(() => im.onload && im.onload(), 0); } }); return im; },
  getStorageSync: k => store.has(k) ? store.get(k) : '', setStorageSync: (k, v) => { store.set(k, v); },
  createWebAudioContext: () => audioNode, vibrateShort() { }, showShareMenu() { }, onShareAppMessage() { }, shareAppMessage() { },
  getLaunchOptionsSync: () => ({ query: {} }), onShow() { },
};
globalThis.requestAnimationFrame = cb => { raf = cb; };
let now = 1.7e12; Date.now = () => (now += 16);

await import(pathToFileURL(path.resolve('night-market-game/game.js')).href);
await new Promise(r => setTimeout(r, 30));
const g = globalThis.__game, { ui, G, L, P } = g;
const frames = n => { for (let i = 0; i < n; i++) raf(); };
const tap = (x, y) => { const sx = x * P.scale + P.offX, sy = y * P.scale; touchStart({ touches: [{ clientX: sx, clientY: sy }] }); touchEnd({ changedTouches: [{ clientX: sx, clientY: sy }] }); };
frames(3);

const seen = { nights: 0, arena: 0, daily: 0, modals: new Set(), maxNight: 1, restarts: 0, endless: 0 };
const fail = msg => { throw new Error(msg); };
function check(step) {
  const S = G.S, H = P.h / P.scale;
  if (errors.length) fail('游戏报错:' + errors[0]);
  if (!Number.isFinite(S.money) || S.money < 0) fail('钱不对:' + S.money);
  if (!Number.isInteger(S.hearts) || S.hearts > 3 || S.hearts < 0) fail('生命不对:' + S.hearts);
  if (!(S.night >= 1) || !['day', 'night', 'break', 'settle'].includes(S.phase)) fail('阶段不对:' + S.night + ' ' + S.phase);
  const pos = new Set();
  for (const s of S.stalls) {
    if (!L.DEF[s.id] || !(s.lvl >= 1 && s.lvl <= 4) || !(s.c >= 0 && s.c < L.COLS) || !(s.r >= 0 && s.r < L.ROWS)) fail('摊位数据不对:' + JSON.stringify(s));
    if (pos.has(s.c + ',' + s.r)) fail('两个摊位叠在同一格:' + s.c + ',' + s.r); pos.add(s.c + ',' + s.r);
    if (!ui.peek && !S.unlocked.has(s.c + ',' + s.r)) fail('摊位摆在了没解锁的地上:' + s.c + ',' + s.r);
  }
  if (G.N && !(G.N.income >= 0)) fail('当晚营业额不对:' + G.N.income);
  if (!Number.isFinite(ui.money) || !Number.isFinite(ui.inc)) fail('界面上的数字不对');
  if (ui.modal && !ui.modal.buttons.length && ui.modal.timer == null) fail('弹窗没有任何按钮,会卡死:' + ui.modal.title);
  for (const h of ui.hits) if (!h.at && !(h.x + h.w >= 0 && h.x <= 375 && h.y + h.h >= 0 && h.y <= H)) fail('有按钮画到了屏幕外:' + JSON.stringify({ x: h.x, y: h.y, w: h.w, h: h.h }));
  if (ui.modal) seen.modals.add(ui.modal.title.replace(/[¥\d]+/g, '#'));
  if (S.arena) { if (S.daily) seen.daily++; else seen.arena++; }
  if (S.phase === 'night') seen.nights++;
  if (!S.arena) seen.maxNight = Math.max(seen.maxNight, S.night);
  if (S.endless) seen.endless++;
}
// 「会玩」的一步:有弹窗就点一个按钮(很少点重新开始),白天就进货摆摊,摆得差不多了就开张,夜里就等
function play() {
  const S = G.S, m = ui.modal;
  if (ui.tut && !m) { const st = ui.tut; frames(2); tap(187, 300); if (ui.tut === st && ui.hits.length) { const h = ui.hits[rnd(ui.hits.length)]; if (!h.at) tap(h.x + h.w / 2, h.y + h.h / 2); } return; }
  if (m) {
    if (m.timer != null) return frames(120);
    if (m.perks && Math.random() < .9) return m.perks[rnd(m.perks.length)].fn();
    if (m.grid && Math.random() < .5) return g.stallModal(m.grid[rnd(m.grid.length)].id);
    const bs = m.buttons.filter(b => !/重新开始/.test(b.label) || Math.random() < .04); if (!bs.length) return;
    return bs[rnd(bs.length)].fn();
  }
  if (S.phase === 'break') {   // 中场:一半的时候随手调整一下,然后继续营业
    if (Math.random() < .5 && S.stalls.length) { const s = S.stalls[rnd(S.stalls.length)]; g.tapPlot(s.c, s.r); g.tapPlot(rnd(L.COLS), rnd(L.ROWS)); ui.sel = null; }
    return L.nextWave();
  }
  if (S.phase !== 'day') return frames(150);
  if (ui.peek) return g.togglePeek();
  const r = Math.random();
  if (r < .03) return g.challengeModal(); if (r < .05) return g.codexModal(); if (r < .06 && S.arena) return g.leaveArena();
  const sellers = S.stalls.filter(s => !L.DEF[s.id].sup).length;
  if (r < .16 + (sellers ? .1 : 0) && S.stalls.length) return g.goNight();
  if (r < .22) { const s = S.stalls[rnd(S.stalls.length)]; if (s) { g.tapPlot(s.c, s.r); g.tapPlot(rnd(L.COLS), rnd(L.ROWS)); ui.sel = null; } return; }
  const opts = S.shop.map((o, i) => ({ o, i })).filter(x => !x.o.sold && S.money >= L.costOf(L.DEF[x.o.id]));
  if (!opts.length) { if (Math.random() < .5) L.refresh(false); return; }
  const pickd = opts[rnd(opts.length)], d = L.DEF[pickd.o.id], cols = d.sup ? [0, 3] : [1, 2]; g.tapCard(pickd.i);
  const same = S.stalls.find(s => s.id === pickd.o.id && s.lvl === 1); if (same) return g.tapPlot(same.c, same.r);
  for (let rr = 0; rr < L.ROWS; rr++) for (const c of cols) { if (!S.unlocked.has(c + ',' + rr) && L.canUnlock(c, rr)) g.tapPlot(c, rr); if (S.unlocked.has(c + ',' + rr) && !L.stallAt(c, rr)) return g.tapPlot(c, rr); }
  ui.sel = null;
}
try {
  for (let i = 0; i < ACTIONS; i++) {
    const k = Math.random(), H = P.h / P.scale;
    if (PLAY && Math.random() < .8) play();
    else if (k < .55 && ui.hits.length) { const h = ui.hits[rnd(ui.hits.length)]; if (!h.at) tap(h.x + Math.random() * h.w, h.y + Math.random() * h.h); }
    else if (k < .78) tap(Math.random() * 375, Math.random() * H);
    else frames(1 + rnd(60));
    frames(1 + rnd(3)); check(i);
  }
  const titles = [...seen.modals];
  console.log(`  通过  屏幕 ${SW}x${SH} 种子 ${SEED}${PLAY ? '(会玩)' : ''}:${ACTIONS} 次操作 · 主线最远第 ${seen.maxNight} 晚${seen.endless ? '(进了无尽)' : ''} · 进过擂台 ${seen.arena ? '是' : '否'} · 每日挑战 ${seen.daily ? '是' : '否'} · 见过 ${titles.length} 种弹窗`);
} catch (e) {
  console.log(`  失败  屏幕 ${SW}x${SH} 种子 ${SEED}${PLAY ? ' play' : ''}:${e.message.split('\n')[0]}`); console.error = () => { }; process.stderr.write(String(e.stack).split('\n').slice(0, 5).join('\n') + '\n'); process.exit(1);
}
