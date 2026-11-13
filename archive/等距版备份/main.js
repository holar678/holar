// 界面与表现层:场景、HUD、面板、弹窗、动效、音效。所有坐标按 375 宽的设计稿,再整体缩放到屏幕。
import P from './platform.js';
import * as L from './logic.js';
import * as A from './art.js';
const { G, DEF, PERKS, ROWS, COLS, MAXN, ARENA } = L;
const ctx = P.canvas.getContext('2d');
const W = 375; let H = 667, LAY = null, DT = 0;
const GOLD = '#ffc94a', DIM = '#9d99c2', TXT = '#f4f1ff';
const ui = { sel: null, modal: null, toast: null, hits: [], t: 0, dark: .35, pops: [], coins: [], rings: [], money: 60, inc: 0, feed: [], speed: 1, cust: [], spawn: 0, gap: .3, endT: 0, peek: null, best: 0, pendingRival: null, lastAr: null };
const pick = a => a[Math.random() * a.length | 0];

// ---------- 基础绘制 ----------
const font = (px, b) => `${b ? 'bold ' : ''}${px}px "PingFang SC","Microsoft YaHei",sans-serif`;
function txt(s, x, y, px, col = TXT, al = 'left', b = false) { ctx.font = font(px, b); ctx.fillStyle = col; ctx.textAlign = al; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
function wrap(s, maxW, px) { ctx.font = font(px); const out = []; let line = ''; for (const ch of s) { if (ctx.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch; } if (line) out.push(line); return out; }
const hit = (x, y, w, h, fn) => ui.hits.push({ x, y, w, h, fn });
const toast = t => { ui.toast = { t, life: 1.5 }; };
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
const BTN = { pri: ['#ffa64d', '#f07a2a', '#a44d12', '#2a1300'], ad: ['#4fc98a', '#2f9c66', '#1c6a43', '#06281a'], sec: ['#4d4980', '#3b3766', '#262343', TXT] };
function btn(x, y, w, h, label, kind, fn, dis) {
  const [c1, c2, c3, ct] = BTN[kind]; ctx.globalAlpha = dis ? .4 : 1;
  A.rr(ctx, x, y + 3, w, h, 11); ctx.fillStyle = c3; ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); A.rr(ctx, x, y, w, h, 11); ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.16)'; A.rr(ctx, x + 2, y + 2, w - 4, h * .42, 9); ctx.fill();
  txt(label, x + w / 2, y + h / 2 + 1, h > 40 ? 15 : 13, ct, 'center', true); ctx.globalAlpha = 1; hit(x, y, w, h + 3, fn);
}

// ---------- 音效(合成音,不需要音频文件) ----------
let ac = null, lastCoin = 0;
function tone(f, d = .08, type = 'sine', v = .07, slide = 0, delay = 0) {
  if (!ac) return; try {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + delay; o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slide) o.frequency.linearRampToValueAtTime(f + slide, t0 + d);
    g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + d); o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + d + .02);
  } catch (e) { }
}
const sfx = {
  tap: () => tone(520, .04, 'triangle', .04), place: () => tone(260, .09, 'triangle', .08, 120), bad: () => tone(180, .12, 'square', .04, -60),
  merge: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .12, 'triangle', .07, 0, i * .06)),
  coin: () => { if (ui.t - lastCoin < .05) return; lastCoin = ui.t; tone(1100 + Math.random() * 500, .07, 'sine', .05, 300); },
  open: () => [392, 523, 659].forEach((f, i) => tone(f, .14, 'triangle', .07, 0, i * .08)),
  ok: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .18, 'triangle', .07, 0, i * .08)),
  fail: () => [392, 330, 262].forEach((f, i) => tone(f, .22, 'sawtooth', .04, 0, i * .14)),
};

// ---------- 布局(等距 2.5D) ----------
// 世界坐标:X 横穿街道(第 0、1 列在街道远侧,第 2、3 列在近侧,街道夹在中间),Y 沿街从街口到街尾,单位是「格」。
// 屏幕上 X 轴指向右下、Y 轴指向左下,所以整条街从右上斜向左下。
const SW = .8;                                    // 街道宽度(格)
const wx = c => c < 2 ? c : c + SW;               // 列号 → 世界坐标 X
function layout() {
  H = P.h / P.scale; const top = P.safeTop / P.scale, hudH = 78, panelH = 206, sceneY = top + hudH, sceneH = H - sceneY - panelH;
  // 镜头只框住「已经用到的街道」:刚开局只有两三排,格子就画得大;街道越扩越长,镜头平滑拉远。
  // rows 是要显示的排数(比最远的已解锁或已摆摊的那一排多一排,好看到可以扩的地),ui.rows 是它的平滑过渡值
  let far = 0; for (const key of G.S.unlocked) far = Math.max(far, +key.split(',')[1]); for (const s of G.S.stalls) far = Math.max(far, s.r);
  const rows = Math.min(ROWS, Math.max(3, far + 2));
  if (ui.rows == null) ui.rows = rows; ui.rows += (rows - ui.rows) * Math.min(1, DT * 4); if (Math.abs(rows - ui.rows) < .01) ui.rows = rows;
  const span = COLS + SW + ui.rows, tw = Math.min(96, (W - 8) / (span / 2)), th = tw / 2, head = tw * 1.4, contentH = head + span * th / 2 + 12;
  const oy = sceneY + Math.max(0, (sceneH - contentH) / 2) + head, ox = (W - span * tw / 2) / 2 + ui.rows * tw / 2, k = P.dpr * P.scale;
  P.shot = { y: Math.round(Math.max(0, oy - head - 8) * k), h: Math.round(W * .8 * k) };   // 分享卡片的截图区域(5:4)
  LAY = { top, panelY: H - panelH, panelH, tw, th, ox, oy, rows };
}
const iso = (X, Y) => [LAY.ox + (X - Y) * LAY.tw / 2, LAY.oy + (X + Y) * LAY.th / 2];
const center = (c, r) => iso(wx(c) + .5, r + .5);
// 地块在屏幕上的外接矩形(有摊位时把摊位的高度也算进去),给新手引导的高亮框用
const plotRect = (c, r) => { const [x, y] = center(c, r), up = L.stallAt(c, r) ? LAY.tw * 1.25 : 8; return { x: x - LAY.tw / 2, y: y - LAY.th / 2 - up, w: LAY.tw, h: LAY.th + up }; };
// 屏幕坐标 → 地块。摊位比地块高,会挡住后面的格子,所以先从最靠前的摊位开始,看点没点在它身上
function pickPlot(x, y) {
  const l = LAY, ss = G.S.stalls.slice().sort((a, b) => (wx(b.c) + b.r) - (wx(a.c) + a.r));
  for (const s of ss) { const [cx, cy] = center(s.c, s.r); if (Math.abs(x - cx) < l.tw * .34 && y > cy - l.tw * 1.2 && y < cy + l.th * .45) return [s.c, s.r]; }
  const a = (x - l.ox) / (l.tw / 2), b = (y - l.oy) / (l.th / 2), X = (a + b) / 2, Y = (b - a) / 2, r = Math.floor(Y);
  if (r < 0 || r >= l.rows || X < 0) return null;
  if (X < 2) return [Math.floor(X), r];
  if (X >= 2 + SW && X < COLS + SW) return [Math.floor(X - SW), r];
  return null;
}
function poly(pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
const area = (X0, X1, Y0, Y1) => poly([iso(X0, Y0), iso(X1, Y0), iso(X1, Y1), iso(X0, Y1)]);

// ---------- 白天操作 ----------
function burst(c, r, col) { const [x, y] = center(c, r); ui.rings.push({ x, y, t: 0, col }); }
function tapPlot(c, r) {
  const S = G.S; if (S.phase !== 'day' || ui.peek) return;
  if (!S.unlocked.has(c + ',' + r)) {
    const res = L.unlock(c, r); if (res === 'far') return;
    if (res === 'nomoney') { sfx.bad(); return toast('钱不够'); }
    sfx.place(); burst(c, r, '120,255,170'); return;
  }
  const at = L.stallAt(c, r), sel = ui.sel;
  if (sel && sel.kind === 'shop') {
    const res = L.buyPlace(sel.i, c, r);
    if (res === 'nomoney') { sfx.bad(); return toast('钱不够'); }
    if (res === 'occupied') { sfx.bad(); return toast('这里已有摊位。同名一级摊位才能叠放升级'); }
    if (res === 'merged') { sfx.merge(); burst(c, r, '255,215,90'); at.bounce = 1; toast('升级!'); }
    if (res === 'placed') { sfx.place(); L.stallAt(c, r).bounce = 1; }
    ui.sel = null; P.vibrate(); return;
  }
  if (sel && sel.kind === 'stall') {
    if (at === sel.s) { ui.sel = null; return sfx.tap(); }
    const res = L.moveStall(sel.s, c, r);
    if (res === 'max') { sfx.bad(); return toast('已是最高级'); }
    if (res === 'merged') { sfx.merge(); burst(c, r, '255,215,90'); at.bounce = 1; toast('升级!'); } else { sfx.place(); sel.s.bounce = 1; }
    ui.sel = null; P.vibrate(); return;
  }
  if (at) { ui.sel = { kind: 'stall', s: at }; sfx.tap(); }
}
function tapCard(i) { const o = G.S.shop[i]; if (o.sold) return; ui.sel = ui.sel && ui.sel.kind === 'shop' && ui.sel.i === i ? null : { kind: 'shop', i }; sfx.tap(); }
function watchAd(cb) {
  const done = () => { cb(); persist(); };
  if (P.hasAd) return P.showRewardedAd(done, () => toast('广告暂时加载不出来'));
  ui.modal = { title: '模拟广告', lines: ['正式版这里播放激励视频', '看完后发放奖励'], buttons: [], timer: 1.6, onDone: done };
}

// ---------- 存档:只存主线白天的状态,擂台不存 ----------
// 引导没走完不存档,下次进来重新引导
function persist() { const S = G.S; if (ui.tut || S.arena || S.phase !== 'day') return; P.store.set('run', JSON.stringify(Object.assign({}, S, { unlocked: [...S.unlocked] }))); }
function loadRun() {
  try { const d = JSON.parse(P.store.get('run')); if (d && d.phase === 'day' && Array.isArray(d.stalls)) { d.unlocked = new Set(d.unlocked); L.restore(d); return true; } } catch (e) { }
  return false;
}

// ---------- 好友擂台 ----------
function resetUi() { Object.assign(ui, { sel: null, modal: null, cust: [], coins: [], pops: [], feed: [], inc: 0, peek: null, money: G.S.money }); }
function enterArena(rival, skipIntro) {
  L.enterArena(rival); resetUi(); if (skipIntro) return; sfx.open();
  ui.modal = rival
    ? { title: '好友向你下了战书', small: true, lines: [`TA 的夜市一晚赚了 ¥${rival.score}`, `同样的规则:预算 ¥${ARENA.budget},客流 ${ARENA.cust} 人,只营业一晚`, '营业额超过 TA 就算赢。可以先点右上的「擂主」看 TA 怎么摆'], buttons: [{ label: '应战', kind: 'pri', fn: () => { ui.modal = null; } }] }
    : { title: '⚔ 擂台赛', small: true, lines: [`预算 ¥${ARENA.budget},客流 ${ARENA.cust} 人,只营业一晚`, `可以免费换货 ${ARENA.refresh} 次,地块可以花钱扩`, '摆出最高营业额,再发给好友来挑战'], buttons: [{ label: '开始', kind: 'pri', fn: () => { ui.modal = null; } }] };
}
function leaveArena() { L.exitArena(); resetUi(); }
function togglePeek() { const S = G.S; if (ui.peek) { S.stalls = ui.peek; ui.peek = null; } else { ui.peek = S.stalls; S.stalls = S.rival.stalls; ui.sel = null; } sfx.tap(); }
function share(title, payload) {
  drawAll(false);   // 先画一帧不带弹窗的干净画面,用作分享卡片的截图
  if (P.share({ title, query: 'ar=' + payload }) === 'copied') toast('挑战链接已复制,发给好友即可');
}
function arenaSettle(r) {
  const S = G.S, score = r.inc, rival = S.rival, isBest = score > ui.best, payload = L.encodeArena(score);
  if (isBest) { ui.best = score; P.store.set('arenaBest', String(score)); }
  const again = { label: rival && !r.ok ? '再战一局' : '再来一局', kind: 'sec', fn: () => enterArena(rival, true) }, back = { label: '回到主线', kind: 'sec', fn: leaveArena };
  if (!rival) {
    sfx.ok(); ui.modal = { title: `擂台成绩 ¥${score}`, tone: 'ok', lines: [isBest ? '刷新了个人最高!' : `个人最高 ¥${ui.best}`], buttons: [{ label: '⚔ 发给好友来挑战', kind: 'pri', fn: () => share(`我的夜市一晚赚了 ¥${score},敢来打擂吗?`, payload) }, again, back] };
  } else if (r.ok) {
    sfx.ok(); ui.modal = { title: '打赢擂主!', tone: 'ok', lines: [`你 ¥${score}  :  擂主 ¥${rival.score}`], buttons: [{ label: '⚔ 把战果发回去', kind: 'pri', fn: () => share(`你的擂台被我打下来了:¥${score},不服再战`, payload) }, again, back] };
  } else {
    sfx.fail(); ui.modal = {
      title: '差一点', tone: 'bad', lines: [`你 ¥${score}  :  擂主 ¥${rival.score}`, `还差 ¥${rival.score - score + 1}`],
      buttons: (r.encore ? [] : [{ label: '▶ 看广告加场:再来 6 位顾客', kind: 'ad', fn: () => watchAd(() => { ui.modal = null; L.encore(); ui.gap = .4; ui.spawn = .2; ui.endT = 0; }) }]).concat([again, back])
    };
  }
}
function goNight() {
  const S = G.S; if (!S.stalls.some(s => L.isFront(s.c) && !DEF[s.id].sup)) { sfx.bad(); return toast('至少要有一个靠街的售卖摊位'); }
  L.startNight(); ui.sel = null; ui.inc = 0; ui.spawn = .3; ui.gap = Math.max(.15, 5 / G.N.queue.length); ui.feed = []; ui.endT = 0; sfx.open();
}

// ---------- 夜晚 ----------
function feed(s) { ui.feed.unshift({ s, life: 3 }); if (ui.feed.length > 3) ui.feed.pop(); }
function onSale(c, s, amt, f) {
  const [px, py] = center(s.c, s.r), tw = LAY.tw, d = DEF[s.id]; s.bounce = 1;
  const special = f.thirsty || c.rich || f.last;
  ui.pops.push({ x: px, y: py - tw * 1.05, t: 0, s: '+¥' + amt, c: f.thirsty ? '#8fdcff' : c.rich ? '#fff0a0' : GOLD, big: special });
  const n = Math.min(4, 1 + Math.floor(amt / 15));
  for (let i = 0; i < n; i++) ui.coins.push({ x0: px, y0: py - tw * .3, t: -i * .05, d: .45 + Math.random() * .2, cx: (Math.random() - .5) * 90 });
  if (f.thirsty) feed(`口渴连击 ×2 · ${d.n} +¥${amt}`); else if (c.rich) feed(`土豪消费 ×3 · ${d.n} +¥${amt}`);
  else if (f.last) feed(`临走再买 · ${d.n} +¥${amt}`); else if (s.id === 'ring') feed('有人玩了套圈,心情大好');
  sfx.coin();
}
function updateNight(dt) {
  const N = G.N; if (G.S.phase !== 'night') return;
  const sdt = dt * ui.speed; ui.spawn -= sdt;
  if (N.queue.length && ui.spawn <= 0) {
    ui.spawn = ui.gap; const c = L.newCust(N.queue.pop());
    // 顾客在街道中间走:X 落在街道范围内,Y 从街口外一格走到街尾外一格
    Object.assign(c, { X: 2 + SW * (.5 + (Math.random() - .5) * .5), Y: -1, dir: 1, next: 0, seed: Math.random() * 9, shirt: pick(A.SHIRTS), hair: pick(A.HAIRS), skin: pick(A.SKINS) });
    ui.cust.push(c);
  }
  const sp = 2.8, end = LAY.rows + 1;   // 每秒走几格;走到街尾外一格离场
  for (const c of ui.cust) {
    c.Y += c.dir * sp * sdt;
    while (c.next >= 0 && c.next < ROWS && (c.dir > 0 ? c.Y >= c.next + .5 : c.Y <= c.next + .5)) { L.visit(c, c.next, onSale); c.next += c.dir; }
    if (c.dir > 0 && c.Y > end) { if (L.wantsBack(c)) { c.ret = true; c.dir = -1; c.next = LAY.rows - 1; } else c.done = true; }
    else if (c.dir < 0 && c.Y < -1) c.done = true;
  }
  ui.cust = ui.cust.filter(c => !c.done);
  if (!N.queue.length && !ui.cust.length && !ui.coins.length) { ui.endT += dt; if (ui.endT > .5) { ui.endT = 0; showSettle(L.finishNight()); } }
}
function showSettle(r) {
  if (G.S.arena) return arenaSettle(r);
  if (r.ok) {
    sfx.ok(); const base = r.inc + r.tip, extra = Math.round(base * .5);
    ui.modal = {
      title: '今晚达标!', tone: 'ok', lines: [`营业额 ¥${r.inc} / 目标 ¥${r.T}`].concat(r.tip ? [`小费 +¥${r.tip}`] : []),
      buttons: [{ label: `收摊  +¥${base}`, kind: 'pri', fn: () => afterSettle(true, base) }, { label: `▶ 看广告多得 50%  +¥${base + extra}`, kind: 'ad', fn: () => watchAd(() => afterSettle(true, base + extra)) }]
    };
  } else {
    sfx.fail();
    ui.modal = {
      title: '没达标', tone: 'bad', lines: [`营业额 ¥${r.inc},还差 ¥${r.T - r.inc}`],
      buttons: (r.encore ? [] : [{ label: '▶ 看广告加场:再来 6 位顾客', kind: 'ad', fn: () => watchAd(() => { ui.modal = null; L.encore(); ui.gap = .4; ui.spawn = .2; ui.endT = 0; }) }])
        .concat([{ label: '认了(失去一颗心)', kind: 'sec', fn: () => afterSettle(false, r.inc) }])
    };
  }
}
function afterSettle(ok, gain) {
  const res = L.settle(ok, gain); ui.modal = null; ui.cust = [];
  if (res === 'win') { sfx.ok(); ui.modal = { title: '🏆 夜市之王', tone: 'ok', lines: [`你撑过了 ${MAXN} 个夜晚`, `手握 ¥${G.S.money}`], buttons: [{ label: '再来一局', kind: 'pri', fn: restart }] }; }
  else if (res === 'perk') perkModal();
  else if (res === 'over') ui.modal = {
    title: '交不起摊位费', tone: 'bad', lines: [`止步第 ${G.S.night} 晚`],
    buttons: (G.S.revived ? [] : [{ label: '▶ 看广告续租一晚', kind: 'ad', fn: () => watchAd(() => { ui.modal = null; L.revive(); }) }]).concat([{ label: '重新开始', kind: 'sec', fn: restart }])
  };
}
function perkModal() {
  ui.modal = { title: '选一条经营秘诀', perks: L.perkChoices().map(p => ({ p, fn: () => { L.takePerk(p); ui.modal = null; sfx.merge(); } })), buttons: [{ label: '▶ 看广告换一批', kind: 'ad', fn: () => watchAd(perkModal) }] };
}
function restart() { if (G.S.arena) L.exitArena(); L.newGame(); resetUi(); }
function helpModal() {
  ui.modal = {
    title: '怎么玩', small: true, lines: ['顾客从街口走到街尾,路过靠街的摊位时可能消费', '每晚营业额达到目标才算过关,共 10 晚', '点卡片选货,再点地块摆放;同名同级叠放升级', '里排放支援摊,加成覆盖同侧周围一圈', '顺序很重要:先烤串后奶茶,奶茶翻倍'],
    buttons: [{ label: '知道了', kind: 'pri', fn: () => { ui.modal = null; } }].concat(G.S.arena ? [] : [{ label: '重新开始主线', kind: 'sec', fn: restart }])
  };
}
function perkListModal() {
  const own = PERKS.filter(p => L.perk(p.k)); if (!own.length) return helpModal();
  ui.modal = { title: '已有的经营秘诀', small: true, lines: own.map(p => `${p.e} ${p.n}${L.perk(p.k) > 1 ? ' ×' + L.perk(p.k) : ''}:${p.d}`), buttons: [{ label: '知道了', kind: 'pri', fn: () => { ui.modal = null; } }] };
}

// ---------- 绘制:场景(等距 2.5D) ----------
function drawScene() {
  const l = LAY, S = G.S, d = ui.dark, day = S.phase === 'day', sel = ui.sel, pulse = .5 + .5 * Math.sin(ui.t * 5), XE = COLS + SW, RN = l.rows, RE = ui.rows + 1.3;
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, mix([92, 62, 110], [24, 20, 48], d)); bg.addColorStop(.5, mix([58, 44, 86], [16, 14, 34], d)); bg.addColorStop(1, mix([34, 28, 58], [10, 9, 22], d));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // 地面:一整块场地,中间是街道
  area(-.3, XE + .3, -1.3, RE); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
  area(2, 2 + SW, -1.3, RE); ctx.fillStyle = mix([56, 50, 84], [28, 26, 48], d); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.07)'; for (let Y = -1.1; Y < RE - .3; Y += .6) { area(2 + SW / 2 - .03, 2 + SW / 2 + .03, Y, Y + .3); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1.5;
  for (const X of [2, 2 + SW]) { const a = iso(X, -1.3), b = iso(X, RE); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  // 地块
  const range = sel && sel.kind === 'stall' && DEF[sel.s.id].sup ? sel.s : null;
  for (let r = 0; r < RN; r++) for (let c = 0; c < COLS; c++) {
    const X = wx(c), open = S.unlocked.has(c + ',' + r), at = L.stallAt(c, r), [cx, cy] = center(c, r);
    area(X + .05, X + .95, r + .05, r + .95);
    if (open) {
      ctx.fillStyle = L.isFront(c) ? 'rgba(255,214,160,.11)' : 'rgba(255,255,255,.055)'; ctx.fill();
      if (range && L.inRange(range, c, r)) { ctx.fillStyle = `rgba(${A.AURA[range.id]},${.2 + .12 * pulse})`; ctx.fill(); }
      if (sel && sel.kind === 'shop' && day) {
        const id = S.shop[sel.i].id;
        if (!at) { ctx.strokeStyle = `rgba(120,255,170,${.35 + .4 * pulse})`; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]); }
        else if (at.id === id && at.lvl === 1) { ctx.strokeStyle = `rgba(255,215,90,${.5 + .5 * pulse})`; ctx.lineWidth = 2.5; ctx.stroke(); }
      }
      if (sel && sel.kind === 'stall' && sel.s === at) { ctx.strokeStyle = `rgba(255,215,90,${.6 + .4 * pulse})`; ctx.lineWidth = 2.5; ctx.stroke(); }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      if (day && L.canUnlock(c, r)) txt('+¥' + L.unlockCost(), cx, cy, 10, S.money >= L.unlockCost() ? '#b9f5cf' : DIM, 'center');
    }
  }
  if (day) ui.hits.push({ at: pickPlot, fn: v => tapPlot(v[0], v[1]) });
  // 街口牌楼:两根柱子加一块横幅,横幅顺着地面的方向斜过去
  const g0 = iso(2, -.75), g1 = iso(2 + SW, -.75), gh = l.tw * .72;
  ctx.strokeStyle = '#6b3a2a'; ctx.lineWidth = 3; for (const g of [g0, g1]) { ctx.beginPath(); ctx.moveTo(g[0], g[1]); ctx.lineTo(g[0], g[1] - gh); ctx.stroke(); }
  poly([[g0[0] - 2, g0[1] - gh - 3], [g1[0] + 2, g1[1] - gh - 1], [g1[0] + 2, g1[1] - gh + 15], [g0[0] - 2, g0[1] - gh + 13]]); ctx.fillStyle = '#b8322a'; ctx.fill();
  ctx.save(); ctx.transform(1, .5, 0, 1, (g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2 - gh + 6); txt('夜市', 0, 0, 10, '#ffe6a0', 'center', true); ctx.restore();
  A.glow(ctx, (g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2 - gh + 6, 40, '255,120,70', .12 + .2 * d);
  // 摊位和顾客按远近排好序一起画,近的盖住远的
  const items = S.stalls.map(s => ({ z: wx(s.c) + s.r + 1, s })).concat(ui.cust.map(c => ({ z: c.X + c.Y, c }))).sort((a, b) => a.z - b.z);
  for (const it of items) {
    if (it.s) {
      const s = it.s, [cx, cy] = center(s.c, s.r); if (s.bounce) s.bounce = Math.max(0, s.bounce - DT * 5);
      A.drawStall(ctx, cx, cy, l.tw, s, DEF[s.id], d, ui.t, s.c >= 2);
    } else {
      // 顾客身高约为摊位高度的一半;在街口、街尾淡入淡出
      const c = it.c, [x, y] = iso(c.X, c.Y), k = l.tw / 68;
      ctx.globalAlpha = Math.max(0, Math.min(1, (c.Y + 1) / .4, (RN + 1 - c.Y) / .4));
      ctx.save(); ctx.translate(x, y); ctx.scale(k, k); A.drawPerson(ctx, Object.assign({}, c, { x: 0, y: 0 }), ui.t); ctx.restore(); ctx.globalAlpha = 1;
    }
  }
  // 摊位上的数值标签单独一层,不被前面的棚顶挡住
  for (const s of S.stalls) {
    const [cx, cy] = center(s.c, s.r), def = DEF[s.id];
    if (day) {
      const st = L.statOf(s), bad = !def.sup && !L.isFront(s.c), label = def.sup ? '' : bad ? '不靠街' : `¥${Math.round(st.price)}·${Math.round(st.a * 100)}%`;
      if (label) { ctx.font = font(9, true); const w = ctx.measureText(label).width + 8, ly = cy + l.th * .5 - 9; A.rr(ctx, cx - w / 2, ly, w, 12, 6); ctx.fillStyle = 'rgba(8,6,18,.78)'; ctx.fill(); txt(label, cx, ly + 6.5, 9, bad ? '#ff8a8a' : '#ffe9b0', 'center', true); }
    }
    if (s.lvl > 1) { const bx = cx + l.tw * .17, by = cy - l.tw * (DEF[s.id].sup ? 1.3 : 1.2); A.rr(ctx, bx, by, 22, 12, 6); ctx.fillStyle = s.lvl > 2 ? '#ffc94a' : '#6aa8ff'; ctx.fill(); txt('Lv' + s.lvl, bx + 11, by + 6.5, 9, '#15122b', 'center', true); }
  }
  // 横跨街道的灯串
  const cols = ['255,215,106', '255,142,106', '127,214,255', '182,255,138'];
  for (const Y of [1.5, 3.5, 5.5]) {
    if (Y > RN) continue;
    const a = iso(1.92, Y), b = iso(2.08 + SW, Y), up = l.tw * .7, ax = a[0], ay = a[1] - up, bx = b[0], by = b[1] - up, mx = (ax + bx) / 2, my = (ay + by) / 2 + 12;
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
    for (let i = 1; i <= 4; i++) {
      const u = i / 5, v = 1 - u, x = v * v * ax + 2 * u * v * mx + u * u * bx, y = v * v * ay + 2 * u * v * my + u * u * by, col = cols[(i + Math.round(Y)) % 4], tw = .75 + .25 * Math.sin(ui.t * 3 + i * 1.7 + Y);
      A.glow(ctx, x, y + 2, 9, col, (.18 + .32 * d) * tw); ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(x, y + 2, 2, 0, 7); ctx.fill();
    }
  }
  // 暗角
  const vg = ctx.createRadialGradient(W / 2, H * .45, H * .25, W / 2, H * .45, H * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${.2 + .3 * d})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// ---------- 绘制:顶部 HUD ----------
function drawHUD() {
  const l = LAY, S = G.S, y = l.top, T = L.target(), night = S.phase !== 'day', ar = S.arena;
  txt(ar ? '⚔ 擂台赛' : `第 ${S.night}/${MAXN} 晚`, 12, y + 13, 16, TXT, 'left', true);
  if (ar) txt(S.rival ? '对战好友' : '自由练习', W / 2, y + 13, 12, DIM, 'center');
  else for (let i = 0; i < 3; i++) A.drawHeart(ctx, W / 2 - 20 + i * 20, y + 13, 7, i < S.hearts);
  const ms = '¥ ' + Math.round(ui.money); ctx.font = font(17, true); const mw = ctx.measureText(ms).width;
  txt(ms, W - 12, y + 13, 17, GOLD, 'right', true); A.drawCoin(ctx, W - 12 - mw - 12, y + 13, 7);
  // 目标进度条
  const ref = T || (ar ? ui.best : 0);   // 进度条的满格:主线是目标,擂台是擂主成绩或个人最高
  const bx = 12, by = y + 28, bw = W - 24, bh = 20, k = night && ref ? Math.min(1, ui.inc / ref) : 0;
  const barText = !ar ? (night ? `营业额 ¥${Math.round(ui.inc)} / 目标 ¥${T}` : `今晚目标 ¥${T} · 客流 ${L.custCount() + 2 * L.perk('rich')} 人 · 每人最多买 ${L.capN()} 次`)
    : night ? `营业额 ¥${Math.round(ui.inc)}` + (T ? ` / 擂主 ¥${T}` : ui.best ? ` / 个人最高 ¥${ui.best}` : '')
      : `预算 ¥${ARENA.budget} · 客流 ${ARENA.cust} 人 · ` + (T ? `擂主 ¥${T}` : ui.best ? `个人最高 ¥${ui.best}` : '只营业一晚');
  A.rr(ctx, bx, by, bw, bh, 10); ctx.fillStyle = 'rgba(6,5,14,.75)'; ctx.fill();
  if (k > 0) { ctx.save(); A.rr(ctx, bx, by, bw, bh, 10); ctx.clip(); const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, k >= 1 ? '#49d68a' : '#ff8e4f'); g.addColorStop(1, k >= 1 ? '#c9f27a' : '#ffc94a'); ctx.fillStyle = g; ctx.fillRect(bx, by, bw * k, bh); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(bx, by, bw * k, bh * .4); ctx.restore(); }
  txt(barText, W / 2, by + bh / 2 + .5, 11, night && k > .45 ? '#1a1200' : TXT, 'center', true);
  // 第三行:主线显示经营秘诀和擂台入口;擂台里显示提示和「看擂主摆法」
  const py = y + 62, pill = (x, w, label, fn) => { A.rr(ctx, x, py - 11, w, 22, 11); ctx.fillStyle = 'rgba(255,201,74,.18)'; ctx.fill(); txt(label, x + w / 2, py + .5, 11, GOLD, 'center', true); hit(x, py - 14, w, 28, fn); };
  if (ar) {
    if (S.rival && S.phase === 'day') { txt(ui.peek ? '正在看擂主的摆法' : '想赢?先看看擂主怎么摆', 12, py, 11, DIM); pill(W - 112, 68, ui.peek ? '看我的' : '👀 擂主', togglePeek); }
    else txt(S.rival ? '营业额超过擂主就算赢' : '摆出最高营业额,再发给好友来挑战', 12, py, 11, DIM);
  } else {
    const own = PERKS.filter(p => L.perk(p.k));
    if (own.length) { let x = 12; txt('秘诀', x, py, 11, DIM); x += 30; for (const p of own) { const s = p.e + (L.perk(p.k) > 1 ? '×' + L.perk(p.k) : ''); txt(s, x, py, 13); x += ctx.measureText(s).width + 6; } }
    else txt('每晚达标后,可选一条经营秘诀', 12, py, 11, DIM);
    hit(0, py - 12, W - 116, 24, perkListModal);
    if (S.phase === 'day') pill(W - 106, 62, '⚔ 擂台', () => enterArena(null));
  }
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.arc(W - 22, py, 10, 0, 7); ctx.fill(); txt('?', W - 22, py + .5, 13, TXT, 'center', true); hit(W - 40, py - 14, 40, 28, helpModal);
}

// ---------- 绘制:底部面板 ----------
function drawPanel() {
  const l = LAY, S = G.S, y = l.panelY;
  A.rr(ctx, 0, y, W, l.panelH + 30, 18); ctx.fillStyle = '#1d1a36'; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(18, y, W - 36, 1);
  if (S.phase === 'day') {
    // 说明条
    A.rr(ctx, 10, y + 8, W - 20, 46, 10); ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill();
    if (ui.peek) {   // 正在看擂主的摆法:只能看,不能动
      txt(`擂主的摆法 · 成绩 ¥${S.rival.score}`, 20, y + 22, 14, GOLD, 'left', true); txt('记住 TA 的顺序和支援摊位置,回去摆一个更好的', 20, y + 41, 11, TXT);
      btn(10, y + 100, W - 20, 46, '回到我的夜市', 'pri', togglePeek); return;
    }
    const sel = ui.sel;
    if (sel) {
      const stall = sel.kind === 'stall', id = stall ? sel.s.id : S.shop[sel.i].id, d = DEF[id];
      txt(`${d.e} ${d.n}${stall ? ' Lv' + sel.s.lvl : ''}`, 20, y + 22, 14, GOLD, 'left', true);
      if (!d.sup) txt(`售价 ${d.p} · 吸引 ${Math.round(d.a * 100)}%`, 20 + ctx.measureText(`${d.e} ${d.n}${stall ? ' Lv' + sel.s.lvl : ''}`).width + 10, y + 22, 11, DIM);
      txt(wrap(d.d, stall ? 250 : 335, 11)[0], 20, y + 41, 11, TXT);
      if (stall) btn(W - 96, y + 14, 78, 30, `退货 +¥${L.sellVal(sel.s)}`, 'sec', () => { L.sell(sel.s); ui.sel = null; sfx.place(); });
    } else { txt('点卡片选货,再点地块摆放。点已摆的摊位可以挪动。', 20, y + 22, 11.5, TXT); txt('靠街的摊位才接客;摊位上的数字是「售价·吸引力」', 20, y + 41, 11, DIM); }
    // 进货卡片
    for (let i = 0; i < 4; i++) {
      const o = S.shop[i], d = DEF[o.id], on = sel && sel.kind === 'shop' && sel.i === i, x = 10.5 + i * 90, cy = y + 60 - (on ? 5 : 0), cw = 84, ch = 84, cost = L.costOf(d);
      ctx.globalAlpha = o.sold ? .28 : 1;
      A.rr(ctx, x, cy + 3, cw, ch, 11); ctx.fillStyle = '#14122a'; ctx.fill();
      const g = ctx.createLinearGradient(0, cy, 0, cy + ch); g.addColorStop(0, '#3a3668'); g.addColorStop(1, '#2a2750'); A.rr(ctx, x, cy, cw, ch, 11); ctx.fillStyle = g; ctx.fill();
      ctx.save(); A.rr(ctx, x, cy, cw, ch, 11); ctx.clip(); ctx.fillStyle = d.sup ? '#8d89b8' : A.CAT_COLOR[d.cat]; ctx.fillRect(x, cy, cw, 4); ctx.restore();
      if (on) { A.rr(ctx, x, cy, cw, ch, 11); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(d.e, x + cw / 2, cy + 27);
      txt(d.n, x + cw / 2, cy + 52, 12, TXT, 'center', true);
      A.rr(ctx, x + 18, cy + 62, cw - 36, 16, 8); ctx.fillStyle = 'rgba(6,5,14,.55)'; ctx.fill();
      txt(o.sold ? '已进货' : '¥' + cost, x + cw / 2, cy + 70.5, 11, o.sold ? DIM : S.money >= cost ? GOLD : '#ff8a8a', 'center', true);
      ctx.globalAlpha = 1; hit(x, y + 56, cw, ch + 6, () => tapCard(i));
    }
    // 按钮
    if (S.arena) {
      if (S.refLeft > 0) btn(10, y + 154, 84, 42, `换货 ×${S.refLeft}`, 'sec', () => { L.refresh(); ui.sel = null; sfx.tap(); });
      else btn(10, y + 154, 84, 42, '▶ 换货+4', 'ad', () => watchAd(() => { ui.modal = null; L.addRefresh(4); }));
      btn(100, y + 154, 84, 42, '退出擂台', 'sec', leaveArena);
    } else {
      btn(10, y + 154, 84, 42, `换货 ¥${L.refCost()}`, 'sec', () => { if (L.refresh(false) === 'nomoney') { sfx.bad(); toast('钱不够'); } else { ui.sel = null; sfx.tap(); } });
      btn(100, y + 154, 84, 42, '▶ 免费换', 'ad', () => watchAd(() => { ui.modal = null; L.refresh(true); ui.sel = null; }));
    }
    btn(190, y + 154, 175, 42, '🏮 开张营业', 'pri', goNight);
  } else {
    txt('今晚流水', 20, y + 26, 12, DIM); txt('¥' + Math.round(ui.inc), 20, y + 62, 38, GOLD, 'left', true);
    const left = G.N ? G.N.queue.length + ui.cust.length : 0; txt(left ? `还有 ${left} 位顾客在逛` : '打烊中…', 20, y + 96, 12, DIM);
    ui.feed.forEach((f, i) => { ctx.globalAlpha = Math.min(1, f.life); txt(f.s, W - 16, y + 26 + i * 22, 12, i ? TXT : '#8fdcff', 'right', !i); }); ctx.globalAlpha = 1;
    if (S.phase === 'night') btn(W - 126, y + 154, 116, 42, ui.speed > 1 ? '正常速度' : '加速 ×2', 'sec', () => { ui.speed = ui.speed > 1 ? 1 : 2; sfx.tap(); });
  }
}

// ---------- 绘制:特效、弹窗、提示 ----------
function drawFx() {
  const tx = W / 2, ty = LAY.top + 38;
  for (const c of ui.coins) { c.t += DT; if (c.t < 0) continue; const k = Math.min(1, c.t / c.d), e = k * k * (3 - 2 * k), mx = (c.x0 + tx) / 2 + c.cx, my = Math.min(c.y0, ty) - 30; A.drawCoin(ctx, (1 - e) * (1 - e) * c.x0 + 2 * e * (1 - e) * mx + e * e * tx, (1 - e) * (1 - e) * c.y0 + 2 * e * (1 - e) * my + e * e * ty, 4.5); }
  ui.coins = ui.coins.filter(c => c.t < c.d);
  for (const p of ui.pops) { p.t += DT; const k = p.t / .8; ctx.globalAlpha = Math.max(0, 1 - k * k); const sc = p.big ? 1.25 + .5 * Math.max(0, .15 - p.t) / .15 : 1; ctx.font = font(13 * sc, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,8,20,.8)'; ctx.strokeText(p.s, p.x, p.y - k * 26); ctx.fillStyle = p.c; ctx.fillText(p.s, p.x, p.y - k * 26); }
  ctx.globalAlpha = 1; ui.pops = ui.pops.filter(p => p.t < .8);
  for (const r of ui.rings) { r.t += DT; const k = r.t / .45; ctx.strokeStyle = `rgba(${r.col},${1 - k})`; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.arc(r.x, r.y, 12 + 34 * k, 0, 7); ctx.stroke(); A.glow(ctx, r.x, r.y, 40, r.col, .35 * (1 - k)); }
  ui.rings = ui.rings.filter(r => r.t < .45);
}
function drawModal() {
  const m = ui.modal; if (!m) return;
  if (m.timer != null) { m.timer -= DT; if (m.timer <= 0) { const cb = m.onDone; ui.modal = null; cb(); return drawModal(); } }
  m.a = Math.min(1, (m.a || 0) + DT * 7);
  ctx.fillStyle = `rgba(5,4,12,${.74 * m.a})`; ctx.fillRect(0, 0, W, H); ui.hits.length = 0; hit(0, 0, W, H, () => { });
  const w = 319, x = (W - w) / 2, lh = m.small ? 0 : 24, lines = m.small ? m.lines.flatMap(s => wrap(s, w - 48, 12.5)) : m.lines || [];
  const hLines = m.small ? lines.length * 21 : lines.length * lh, hPerks = (m.perks || []).length * 66, hBtn = m.buttons.length * 54;
  const h = 62 + hLines + hPerks + hBtn + (m.timer != null ? 26 : 8), y = (H - h) / 2, e = 1 - Math.pow(1 - m.a, 3);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(.86 + .14 * e, .86 + .14 * e); ctx.translate(-W / 2, -H / 2); ctx.globalAlpha = m.a;
  A.rr(ctx, x, y + 5, w, h, 18); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#34305f'); g.addColorStop(1, '#232044'); A.rr(ctx, x, y, w, h, 18); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = m.tone === 'ok' ? 'rgba(255,201,74,.7)' : m.tone === 'bad' ? 'rgba(255,110,110,.55)' : 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5; ctx.stroke();
  if (m.tone === 'ok') A.glow(ctx, W / 2, y + 10, 120, '255,201,74', .22);
  txt(m.title, W / 2, y + 34, 20, m.tone === 'ok' ? GOLD : m.tone === 'bad' ? '#ff9c9c' : TXT, 'center', true);
  let cy = y + 66;
  for (const s of lines) { txt(s, m.small ? x + 24 : W / 2, cy, m.small ? 12.5 : 14, '#d6d2f0', m.small ? 'left' : 'center'); cy += m.small ? 21 : lh; }
  if (m.timer != null) { A.rr(ctx, x + 40, cy, w - 80, 8, 4); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill(); A.rr(ctx, x + 40, cy, (w - 80) * (1 - m.timer / 1.6), 8, 4); ctx.fillStyle = '#4fc98a'; ctx.fill(); }
  for (const pk of m.perks || []) {
    A.rr(ctx, x + 16, cy, w - 32, 58, 12); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,201,74,.35)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(pk.p.e, x + 44, cy + 30);
    txt(pk.p.n + (L.perk(pk.p.k) ? `(已有 ${L.perk(pk.p.k)})` : ''), x + 72, cy + 20, 14, GOLD, 'left', true); txt(pk.p.d, x + 72, cy + 40, 11.5, '#d6d2f0');
    hit(x + 16, cy, w - 32, 58, pk.fn); cy += 66;
  }
  cy += 4; for (const b of m.buttons) { btn(x + 20, cy, w - 40, 44, b.label, b.kind, b.fn); cy += 54; }
  ctx.restore();
}
function drawToast() {
  const t = ui.toast; if (!t) return; t.life -= DT; if (t.life <= 0) { ui.toast = null; return; }
  ctx.globalAlpha = Math.min(1, t.life * 3); ctx.font = font(13, true); const w = ctx.measureText(t.t).width + 28;
  A.rr(ctx, W / 2 - w / 2, H * .42, w, 34, 17); ctx.fillStyle = 'rgba(8,6,18,.88)'; ctx.fill(); txt(t.t, W / 2, H * .42 + 17.5, 13, TXT, 'center', true); ctx.globalAlpha = 1;
}

// ---------- 新手引导:带着玩家摆出「烤串 → 奶茶 + 灯牌」并打完第一晚 ----------
const cardRect = i => ({ x: 10.5 + i * 90, y: LAY.panelY + 56, w: 84, h: 92 });
const selIs = i => ui.sel && ui.sel.kind === 'shop' && ui.sel.i === i;
const TUT = [
  { any: true, msg: () => ui.pendingRival ? '好友向你下了战书!\n先花一分钟学会摆摊,马上就去应战。' : '欢迎来到夜市!\n顾客会从街口走到街尾,路过靠街的摊位就可能掏钱。' },
  { msg: '先进货。点这张烤串。', rect: () => cardRect(0), done: () => selIs(0) },
  { msg: '摆在靠街的这一格。\n只有靠街的摊位才接客。', cell: [1, 0], rect: () => plotRect(1, 0), done: () => L.stallAt(1, 0) },
  { msg: '再进一杯奶茶。', rect: () => cardRect(1), done: () => selIs(1) },
  { msg: '摆在烤串的下一格。\n顾客吃完烤串会口渴,奶茶收入翻倍。', cell: [1, 1], rect: () => plotRect(1, 1), done: () => L.stallAt(1, 1) },
  { msg: '这是灯牌,它不卖东西,\n但能让周围的摊位更吸引人。', rect: () => cardRect(2), done: () => selIs(2) },
  { msg: '支援摊放在里排就行。', cell: [0, 0], rect: () => plotRect(0, 0), done: () => L.stallAt(0, 0) },
  { msg: '准备好了,开张营业!', rect: () => ({ x: 190, y: LAY.panelY + 154, w: 175, h: 45 }), done: () => G.S.phase !== 'day' },
  { passive: true, msg: '顾客来了!蓝色的「口渴连击」\n就是烤串配奶茶的效果。', done: () => G.S.phase === 'day' && !ui.modal },
  { any: true, msg: '同名同级的摊位叠在一起会升级。\n摊位的顺序和搭配,就是这门生意的全部学问。祝生意兴隆!' },
];
function startTut() { ui.tut = { step: 0, skip: null }; G.S.shop = ['kebab', 'tea', 'lamp', 'candy'].map(id => ({ id, sold: false })); }
function endTut() { ui.tut = null; P.store.set('tut', '1'); persist(); }
function nextTut() { ui.tut.step++; ui.tut.skip = null; if (ui.tut.step >= TUT.length) endTut(); }
function drawTut() {
  const t = ui.tut; if (!t || ui.modal) return; const st = TUT[t.step];
  if (st.passive && G.S.phase !== 'night') return;
  const msg = typeof st.msg === 'function' ? st.msg() : st.msg, lines = msg.split('\n').reduce((a, s) => a.concat(wrap(s, 262, 13.5)), []);
  const bw = 300, bh = 24 + lines.length * 21 + (st.any ? 22 : 0), bx = (W - bw) / 2, r = st.rect && st.rect(); let by;
  if (r) {
    // 四块遮罩围出一个亮着的目标区域
    const x0 = r.x - 4, y0 = r.y - 4, x1 = r.x + r.w + 4, y1 = r.y + r.h + 4, pulse = .5 + .5 * Math.sin(ui.t * 6), below = r.y + r.h / 2 < H / 2, bob = Math.sin(ui.t * 6) * 4;
    ctx.fillStyle = 'rgba(5,4,12,.68)'; ctx.fillRect(0, 0, W, y0); ctx.fillRect(0, y1, W, H - y1); ctx.fillRect(0, y0, x0, y1 - y0); ctx.fillRect(x1, y0, W - x1, y1 - y0);
    A.rr(ctx, x0, y0, x1 - x0, y1 - y0, 12); ctx.strokeStyle = `rgba(255,201,74,${.6 + .4 * pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.fillText(below ? '👆' : '👇', r.x + r.w / 2, below ? y1 + 20 + bob : y0 - 20 - bob);
    by = below ? y1 + 42 : y0 - 42 - bh;
  } else if (st.passive) by = LAY.panelY - bh - 14;   // 夜晚的提示贴在面板上方,不挡街道
  else { ctx.fillStyle = 'rgba(5,4,12,.68)'; ctx.fillRect(0, 0, W, H); by = H * .36; }
  A.rr(ctx, bx, by + 4, bw, bh, 14); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
  A.rr(ctx, bx, by, bw, bh, 14); ctx.fillStyle = '#fff6e2'; ctx.fill(); ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 2; ctx.stroke();
  lines.forEach((s, i) => txt(s, bx + 18, by + 23 + i * 21, 13.5, '#3a2410', 'left', true));
  if (st.any) txt('点任意位置继续', W / 2, by + bh - 15, 11, '#a08660', 'center');
  if (!st.passive) { txt('跳过', bx + bw - 14, by + 14, 11, '#a08660', 'right'); t.skip = { x: bx + bw - 52, y: by - 4, w: 56, h: 30 }; }
}
// 引导期间的点击:只放行「跳过」、任意处继续、或亮着的目标区域。返回 true 表示这次点击已被引导消化
function tutTap(x, y) {
  const t = ui.tut; if (!t || ui.modal) return false; const st = TUT[t.step], inR = r => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  if (st.passive) return false;
  if (inR(t.skip)) { endTut(); sfx.tap(); return true; }
  if (st.any) { nextTut(); sfx.tap(); return true; }
  if (!inR(st.rect())) return true;
  // 目标是地块时直接落到那一格:等距视角下高亮框的四角其实属于相邻的格子,不能交给普通的点击判定
  if (st.cell) { tapPlot(st.cell[0], st.cell[1]); return true; }
  return false;
}

// ---------- 主循环 ----------
let last = 0;
function frame() { tick(); requestAnimationFrame(frame); }
// 推进一帧。dt 只在调试时传入(页面在后台时浏览器不触发动画帧,用它手动推进)
function tick(dt) {
  const now = Date.now(); DT = dt || Math.min(.05, (now - last) / 1000 || 0); last = now; ui.t += DT;
  const S = G.S; layout(); updateNight(DT);
  ui.dark += ((S.phase === 'day' ? .35 : 1) - ui.dark) * Math.min(1, DT * 2.5);
  ui.money += (S.money - ui.money) * Math.min(1, DT * 10); if (Math.abs(S.money - ui.money) < .6) ui.money = S.money;
  if (G.N) { ui.inc += (G.N.income - ui.inc) * Math.min(1, DT * 12); if (Math.abs(G.N.income - ui.inc) < .6) ui.inc = G.N.income; }
  for (const f of ui.feed) f.life -= DT; ui.feed = ui.feed.filter(f => f.life > 0);
  // 好友战书:等回到白天、没有弹窗时再进擂台,不打断正在进行的夜晚
  if (ui.tut) { const st = TUT[ui.tut.step]; if (st.done && st.done()) nextTut(); }
  if (ui.pendingRival && S.phase === 'day' && !ui.modal && !ui.tut) { const r = ui.pendingRival; ui.pendingRival = null; enterArena(r); }
  drawAll(true);
}
function drawAll(overlay) {
  const k = P.dpr * P.scale; ctx.setTransform(k, 0, 0, k, 0, 0); ui.hits.length = 0;
  drawScene(); drawHUD(); drawPanel(); drawFx(); if (overlay) { drawTut(); drawModal(); drawToast(); }
}
P.onTap((px, py) => {
  if (!ac) ac = P.createAudio(); if (ac && ac.state === 'suspended' && ac.resume) ac.resume();
  const x = px / P.scale, y = py / P.scale;
  if (tutTap(x, y)) return;
  // 点击区域有两种:普通的矩形;或者带 at 函数的(场景用它把屏幕坐标换算成地块)
  for (let i = ui.hits.length - 1; i >= 0; i--) {
    const h = ui.hits[i], v = h.at ? h.at(x, y) : x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h;
    if (v) { h.fn(v); break; }
  }
  persist();
});
A.loadImages(P); ui.best = +P.store.get('arenaBest') || 0;
const hadSave = loadRun(); if (!hadSave) L.newGame();
ui.money = G.S.money;
if (!hadSave && P.store.get('tut') !== '1') startTut();   // 第一次玩:走新手引导
P.initShare(() => ({ title: '夜市一条街:来我的夜市逛逛' }));
P.onChallenge(str => { if (str === ui.lastAr) return; ui.lastAr = str; const r = L.decodeArena(str); if (r) ui.pendingRival = r; });
if (!P.isWx) window.__game = { L, ui, G, P, tapPlot, tapCard, goNight, enterArena, leaveArena, togglePeek, tick, center, pickPlot }; // 仅浏览器调试用
requestAnimationFrame(frame);
