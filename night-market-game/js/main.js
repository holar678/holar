// 界面与表现层:场景、HUD、面板、弹窗、动效、音效。所有坐标按 375 宽的设计稿,再整体缩放到屏幕。
import P from './platform.js';
import * as L from './logic.js';
import * as A from './art.js';
const { G, DEF, PERKS, ROWS, COLS, MAXN, ARENA } = L;
const ctx = P.canvas.getContext('2d');
const W = 375; let H = 667, LAY = null, DT = 0;
const GOLD = '#ffc94a', DIM = '#b9a98f', TXT = '#fbf3e2';
// 界面风格:夜市木招牌 + 纸价签。纯色、粗描边、硬投影,不用渐变和高光;颜色取自摊位美术(木头、米白棚布、红棚顶)
const INK = '#2b1a12', PAPER = '#f6e7c8', PAPER_D = '#e6d2a8', WOOD = '#6b4027', WOOD_D = '#3a2216', RED = '#d24a35', GREEN = '#3f9163', WARM = '#c9b79a', BROWN = '#8a6a48';
const ui = { sel: null, modal: null, toast: null, hits: [], t: 0, dark: .35, pops: [], coins: [], rings: [], money: 60, inc: 0, feed: [], speed: 1, cust: [], spawn: 0, gap: .3, endT: 0, peek: null, best: 0, pendingRival: null, lastAr: null };
const pick = a => a[Math.random() * a.length | 0];

// ---------- 基础绘制 ----------
const font = (px, b) => `${b ? 'bold ' : ''}${px}px "PingFang SC","Microsoft YaHei",sans-serif`;
// 文字里可以嵌图标,写成 {名字}:{medal_1}~{medal_3} 奖牌、{perk_<k>} 经营秘诀、{stall_<id>} 摊位、{play} 看广告的三角。
// 有图片画图片,没有就画占位(奖牌和三角用代码画,秘诀和摊位暂时用表情符号)
const tokW = px => px * 1.45;
function drawToken(name, x, y, size, col) {
  if (name === 'play') return A.drawPlay(ctx, x, y, size * .8, col);
  if (name.startsWith('stake_')) {   // 难度:红底圆牌写数字
    ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x, y, size * .45, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = font(size * .5, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = PAPER; ctx.fillText(name.slice(6), x, y + 1); return;
  }
  if (name.startsWith('medal_')) return A.drawMedal(ctx, x, y, size, +name.slice(6));
  if (A.icon(ctx, name, x, y, size)) return;
  const e = name.startsWith('perk_') ? (PERKS.find(p => 'perk_' + p.k === name) || {}).e : name.startsWith('stall_') ? (DEF[name.slice(6)] || {}).e : name.startsWith('owner_') ? (L.OWNERS.find(o => 'owner_' + o.k === name) || {}).e : '';
  if (e) { ctx.font = `${Math.round(size * .8)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(e, x, y); }
}
function txt(s, x, y, px, col = TXT, al = 'left', b = false) {
  s = String(s); ctx.font = font(px, b); ctx.fillStyle = col; ctx.textAlign = al; ctx.textBaseline = 'middle';
  if (s.indexOf('{') < 0) { ctx.fillText(s, x, y); return; }
  const parts = s.split(/\{(\w+)\}/);   // 奇数位是图标名
  let w = 0; parts.forEach((p, i) => { w += i % 2 ? tokW(px) : ctx.measureText(p).width; });
  let cx = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x;
  parts.forEach((p, i) => {
    if (i % 2) { drawToken(p, cx + tokW(px) / 2, y, px * 1.3, col); cx += tokW(px); ctx.font = font(px, b); ctx.fillStyle = col; ctx.textBaseline = 'middle'; }
    else if (p) { ctx.textAlign = 'left'; ctx.fillText(p, cx, y); cx += ctx.measureText(p).width; }
  });
}
function wrap(s, maxW, px) {
  ctx.font = font(px); const out = []; let line = '', lw = 0;
  for (const u of s.match(/\{\w+\}|[\s\S]/gu) || []) {   // 图标整体算一个字,不会被拆到两行
    const uw = u.length > 2 && u[0] === '{' ? tokW(px) : ctx.measureText(u).width;
    if (lw + uw > maxW && line) { out.push(line); line = u; lw = uw; } else { line += u; lw += uw; }
  }
  if (line) out.push(line); return out;
}
const hit = (x, y, w, h, fn) => ui.hits.push({ x, y, w, h, fn });
const toast = (t, life = 1.5) => { ui.toast = { t, life }; };
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
// 一块牌子:硬投影 + 纯色 + 描边。按钮、价签、弹窗都用它。
// 美术交了九宫格底图(ui_*.png)就改用图片,图里自带描边和硬投影,所以图片画到 h + lift 的高度,占住原来投影的位置
const NINE_OF = { [PAPER]: 'ui_paper', '#fff5df': 'ui_paper', [PAPER_D]: 'ui_paper', [WOOD]: 'ui_wood' };
// 角画多大:按钮和木牌(192×96 的图)按高度等比,纸签(192×192)按短边的八分之一,限制在 6~14 之间
const cornerOf = (img, w, h) => img === 'ui_paper' ? Math.max(6, Math.min(14, Math.min(w, h) / 8)) : h / 4;
function plate(x, y, w, h, fill, r = 8, lift = 3, img = NINE_OF[fill]) {
  if (img && A.image(img) && !(img === 'ui_paper' && Math.min(w, h) < 36)) {   // 手撕纸签缩得太小边缘会毛糙:小牌子(顶栏的小按钮、提示条)仍用代码画
    const a = ctx.globalAlpha; if (fill === PAPER_D) ctx.globalAlpha = a * .55;   // 暗一号的纸(没解锁的图鉴格子)用半透明表示
    A.nine(ctx, img, x, y, w, h + lift, cornerOf(img, w, h)); ctx.globalAlpha = a; return;
  }
  A.rr(ctx, x, y + lift, w, h, r); ctx.fillStyle = INK; ctx.fill();
  A.rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
}
const BTN = { pri: [RED, PAPER, 'ui_btn_red'], ad: [GREEN, PAPER, 'ui_btn_green'], sec: [PAPER, INK, 'ui_btn_paper'] };   // 主按钮红底、广告按钮绿底、普通按钮纸底
function btn(x, y, w, h, label, kind, fn, dis) {
  const c = BTN[kind]; ctx.globalAlpha = dis ? .4 : 1;
  plate(x, y, w, h, c[0], 8, 3, c[2]);
  txt(label, x + w / 2, y + h / 2 + 1, h > 40 ? 15 : 13, c[1], 'center', true); ctx.globalAlpha = 1; hit(x, y, w, h + 3, fn);
}
// 支援摊名牌上写的作用,随等级变化
const SUP_INFO = { lamp: n => `吸引+${20 * n}%`, fridge: n => `饮甜+${50 * n}%`, grill: n => `小吃+${40 * n}%`, cat: n => `每单+¥${2 * n}` };

// ---------- 玩家档案(跨局保存):最高纪录、累计过关晚数、音效开关 ----------
const prof = Object.assign({ best: 0, cleared: 0, medal: 0, stake: 1, combos: [], ach: [], wonWith: [], sound: true, streak: 0, lastDay: 0, daily: { day: 0, tries: 0, extra: 0, best: 0, medal: 0 } }, (() => { try { return JSON.parse(P.store.get('prof')) || {}; } catch (e) { return {}; } })());
const saveProf = () => P.store.set('prof', JSON.stringify(prof));
// 成就:结算时拍一张快照,交给 logic.js 里每个成就的判断。新达成的记进档案、加解锁进度,返回要显示的几行字。
// 调用前后要各自记下 prof.cleared,用来判断有没有顺带解锁新摊位
function snapshot(extra) {
  const S = G.S, N = G.N;
  return Object.assign({ inc: N ? N.income : 0, thirst: N ? N.thirst || 0 : 0, lvl3: S.stalls.some(x => x.lvl >= 3), combos: L.activeCombos().length, found: prof.combos.length, pats: L.patternSummary().length,
    win: false, full: false, best: prof.best, wonWith: prof.wonWith.length, medal: prof.medal || 0, streak: prof.streak || 0 }, extra);
}
function grantAch(x) {
  const got = L.ACHS.filter(a => prof.ach.indexOf(a.k) < 0 && a.t(x));
  for (const a of got) { prof.ach.push(a.k); prof.cleared += a.r; }
  return got.map(a => `成就达成「${a.n}」:${a.d},解锁进度 +${a.r}`);
}
// 摊主是否已解锁,以及当前已解锁的名单(用来在档案变化前后对比,看有没有新解锁的)
prof.medal = Math.max(prof.medal || 0, (prof.daily && prof.daily.medal) || 0);   // 老存档没有这一项:用今天的奖牌补上
const ownerOpen = o => !o.need || (prof[o.need.stat] || 0) >= o.need.v;
const openOwners = () => L.OWNERS.filter(ownerOpen).map(o => o.k);
const newOwnerLines = before => L.OWNERS.filter(o => ownerOpen(o) && before.indexOf(o.k) < 0).map(o => `解锁新摊主:{owner_${o.k}}${o.n},重新开始时可以选`);
G.cleared = prof.cleared;
// 每日挑战:每天免费 3 次,看广告可以加次数。today() 是按本地时间算的「第几天」
const FREE_TRIES = 3, MEDAL = ['', '{medal_1}', '{medal_2}', '{medal_3}'];
const today = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };
function dailyState() { const day = today(); if (prof.daily.day !== day) prof.daily = { day, tries: 0, extra: 0, best: 0, medal: 0 }; return prof.daily; }

// ---------- 音效(合成音,不需要音频文件) ----------
let ac = null, lastCoin = 0;
function tone(f, d = .08, type = 'sine', v = .07, slide = 0, delay = 0) {
  if (!ac || !prof.sound) return; try {
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

// ---------- 布局 ----------
function layout() {
  H = P.h / P.scale; const top = P.safeTop / P.scale, hudH = 78, panelH = 220, sceneY = top + hudH, sceneH = H - sceneY - panelH;
  // 每排的高度由剩下的空间决定:小屏上压到最低 40,保证六排都露在面板上方
  const rh = Math.max(40, Math.min(80, Math.floor((sceneH - 30) / ROWS))), gridH = rh * ROWS, gridY = sceneY + 24 + Math.max(0, (sceneH - 30 - gridH) / 2);
  // 地块宽度跟着高度走,小屏上摊位不会又矮又宽;多出来的宽度让给街道
  // 斜侧的摊位更宽,所以地块接近正方形(最宽 76),街道相应收窄
  const cw = Math.max(64, Math.min(76, Math.round(rh * 1.1))), sw = W - 16 - 4 * cw, k = P.dpr * P.scale;
  P.shot = { y: Math.round(Math.max(0, gridY - 34) * k), h: Math.round(W * .8 * k) };   // 分享卡片的截图区域(5:4)
  LAY = { top, panelY: H - panelH, panelH, rh, gridY, gridH, cw, sw, colX: [8, 8 + cw, 8 + 2 * cw + sw, 8 + 3 * cw + sw], streetX: 8 + 2 * cw };
}
const plot = (c, r) => ({ x: LAY.colX[c], y: LAY.gridY + r * LAY.rh, w: LAY.cw, h: LAY.rh });
const rowY = r => LAY.gridY + r * LAY.rh + LAY.rh * .6;

// ---------- 白天操作 ----------
function burst(c, r, col) { const p = plot(c, r); ui.rings.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, t: 0, col }); }
function tapPlot(c, r) {
  const S = G.S; if (ui.peek) return;
  if (S.phase === 'break') return breakTap(c, r);
  if (S.phase !== 'day') return;
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
    if (res === 'merged') { sfx.merge(); burst(c, r, '255,215,90'); at.bounce = 1; if (at.lvl >= 3 && DEF[at.id].s3) toast('升到 3 级!招牌技:' + DEF[at.id].s3, 2.5); else toast('升级!'); } else { sfx.place(); sel.s.bounce = 1; }
    ui.sel = null; P.vibrate(); return;
  }
  if (at) { ui.sel = { kind: 'stall', s: at }; sfx.tap(); }
}
// 中场:不能进货、不能扩地,只能调整已有的摊位(挪到空地、和别的摊位对调、同名同级叠放升级),每晚次数有限
function breakTap(c, r) {
  const S = G.S, at = L.stallAt(c, r), sel = ui.sel; if (!S.unlocked.has(c + ',' + r)) return;
  if (sel && sel.kind === 'stall') {
    if (at === sel.s) { ui.sel = null; return sfx.tap(); }
    const res = L.breakMove(sel.s, c, r);
    if (res === 'nomoves') { sfx.bad(); return toast('今晚的调整次数用完了'); }
    if (res === 'max') { sfx.bad(); return toast('已是最高级'); }
    if (res === 'merged') { sfx.merge(); burst(c, r, '255,215,90'); at.bounce = 1; if (at.lvl >= 3 && DEF[at.id].s3) toast('升到 3 级!招牌技:' + DEF[at.id].s3, 2.5); else toast('升级!'); } else { sfx.place(); sel.s.bounce = 1; }
    ui.sel = null; P.vibrate(); return;
  }
  if (at) { ui.sel = { kind: 'stall', s: at }; sfx.tap(); }
}
function tapCard(i) { const o = G.S.shop[i]; if (o.sold) return; ui.sel = ui.sel && ui.sel.kind === 'shop' && ui.sel.i === i ? null : { kind: 'shop', i }; sfx.tap(); }
function watchAd(cb) {
  const done = () => { cb(); persist(); };
  if (P.hasAd) return P.showRewardedAd(done, () => toast('广告暂时加载不出来'));
  // 没有真广告时:浏览器里是调试用的模拟广告;微信里说明广告位还没配置(上线前要在 platform.js 里填广告位 ID)
  ui.modal = P.isWx ? { title: '广告位未配置', lines: ['还没有填广告位 ID', '测试阶段直接发放奖励'], buttons: [], timer: 1.6, onDone: done }
    : { title: '模拟广告', lines: ['正式版这里播放激励视频', '看完后发放奖励'], buttons: [], timer: 1.6, onDone: done };
}

// ---------- 存档:只存主线白天的状态,擂台不存 ----------
// 引导没走完不存档,下次进来重新引导
function persist() { const S = G.S; if (ui.tut || S.arena || S.phase !== 'day') return; P.store.set('run', JSON.stringify(Object.assign({}, S, { unlocked: [...S.unlocked] }))); }
function loadRun() {
  try { const d = JSON.parse(P.store.get('run')); if (d && d.phase === 'day' && Array.isArray(d.stalls)) { d.unlocked = new Set(d.unlocked); L.restore(d); return true; } } catch (e) { }
  return false;
}

// ---------- 好友擂台 ----------
function resetUi() { Object.assign(ui, { sel: null, modal: null, cust: [], coins: [], pops: [], feed: [], inc: 0, peek: null, money: G.S.money, combos: null, pats: null }); }
function enterArena(rival, skipIntro, daily) {
  const th = daily ? L.themeOf(today()) : null;
  L.enterArena(rival, th ? { day: today(), theme: th } : null); resetUi(); if (skipIntro) return; sfx.open();
  if (th) {
    const m = L.medalLines(th);
    ui.modal = {
      title: `每日挑战 · ${th.n}`, small: true,
      lines: [`今日主题:${th.d}`, `预算 ¥${G.S.money},客流 ${L.custCount() + 2 * L.perk('rich')} 人,只营业一晚。今天所有人进到的货都一样,比的是谁会摆`, `热度奖牌线:{medal_1}${m[0]}  {medal_2}${m[1]}  {medal_3}${m[2]}。拿到奖牌会推进新摊位的解锁进度`].concat(rival ? [`好友今天的成绩是 ¥${rival.score}`] : []),
      buttons: [{ label: '开始', kind: 'pri', fn: () => { ui.modal = null; } }]
    };
    return;
  }
  ui.modal = rival
    ? { title: '好友向你下了战书', small: true, lines: [`TA 的夜市一晚热度 ${rival.score}`, `同样的规则:预算 ¥${ARENA.budget},客流 ${ARENA.cust} 人,只营业一晚`, '热度超过 TA 就算赢。可以先点右上的「擂主」看 TA 怎么摆'], buttons: [{ label: '应战', kind: 'pri', fn: () => { ui.modal = null; } }] }
    : { title: '擂台赛', small: true, lines: [`预算 ¥${ARENA.budget},客流 ${ARENA.cust} 人,只营业一晚`, `可以免费换货 ${ARENA.refresh} 次,地块可以花钱扩`, '摆出最高热度,再发给好友来挑战'], buttons: [{ label: '开始', kind: 'pri', fn: () => { ui.modal = null; } }] };
}
function leaveArena() { L.exitArena(); resetUi(); }
// 进每日挑战前先看今天还有没有次数
function startDaily(rival, skipIntro) {
  const ds = dailyState();
  if (ds.tries >= FREE_TRIES + ds.extra) {
    ui.modal = {
      title: '今天的次数用完了', small: true, lines: [`今日最高热度 ${ds.best} ${MEDAL[ds.medal]}`, `每天免费 ${FREE_TRIES} 次,明天会换一个新主题`],
      buttons: [{ label: '{play}看广告再来一次', kind: 'ad', fn: () => watchAd(() => { ds.extra++; saveProf(); enterArena(rival, skipIntro, true); }) }, { label: '明天再来', kind: 'sec', fn: () => { if (G.S.arena) leaveArena(); else ui.modal = null; } }]
    };
    return;
  }
  enterArena(rival, skipIntro, true);
}
// 连续挑战的进度:今天打没打、断没断,离下一档奖励还差几天
function streakLine() {
  const day = today(), alive = prof.lastDay === day || prof.lastDay === day - 1, n = alive ? prof.streak : 0, nx = L.nextStreak(n);
  const head = n ? `已连续挑战 ${n} 天` + (prof.lastDay === day ? '' : ',今天打一局就能续上') : '每天打一局每日挑战,连续几天有奖励';
  return nx ? head + `。连续 ${nx[0]} 天奖励解锁进度 +${nx[1]}` : head;
}
function challengeModal() {
  const th = L.themeOf(today()), ds = dailyState(), m = L.medalLines(th), left = Math.max(0, FREE_TRIES + ds.extra - ds.tries);
  ui.modal = {
    title: '挑战', small: true,
    lines: [`今日主题「${th.n}」:${th.d}`, ds.tries ? `今日最高热度 ${ds.best} ${MEDAL[ds.medal]},还剩 ${left} 次` : `今天还没打,免费 ${FREE_TRIES} 次,金牌线 ${m[2]}`, streakLine(), '自由擂台不限次数,打完可以发给好友来挑战'],
    buttons: [{ label: '每日挑战', kind: 'pri', fn: () => startDaily(null) }, { label: '自由擂台', kind: 'sec', fn: () => enterArena(null) }, { label: '关闭', kind: 'sec', fn: () => { ui.modal = null; } }]
  };
}
function dailySettle(r) {
  const S = G.S, score = r.inc, rival = S.rival, th = L.themeOf(S.day), m = L.medalLines(th), ds = dailyState(), payload = L.encodeArena(score);
  const medal = score >= m[2] ? 3 : score >= m[1] ? 2 : score >= m[0] ? 1 : 0, gain = Math.max(0, medal - ds.medal);   // 当天奖牌升档才加解锁进度
  let bonus = 0;   // 当天第一次打完时累计连续天数,满 3/7/14/30 天额外给解锁进度
  if (prof.lastDay !== ds.day) { prof.streak = prof.lastDay === ds.day - 1 ? prof.streak + 1 : 1; prof.lastDay = ds.day; bonus = L.streakBonus(prof.streak); }
  ds.best = Math.max(ds.best, score); ds.medal = Math.max(ds.medal, medal);
  const owners0 = openOwners(); prof.medal = Math.max(prof.medal || 0, medal);
  const before = prof.cleared; prof.cleared += gain + bonus; const achLines = grantAch(snapshot()); G.cleared = prof.cleared; saveProf();
  const fresh = L.UNLOCKS.filter(u => u.at > before && u.at <= prof.cleared), left = FREE_TRIES + ds.extra - ds.tries;
  const lines = [medal ? `${MEDAL[medal]} 拿到${['', '铜', '银', '金'][medal]}牌` + (gain ? `,解锁进度 +${gain}` : '') : `还差 ${m[0] - score} 热度拿铜牌`]
    .concat(medal < 3 && medal > 0 ? [`下一档 ${MEDAL[medal + 1]} ${m[medal]}`] : [],
      rival ? [`好友 ${rival.score},` + (score > rival.score ? '你赢了' : `还差 ${rival.score - score + 1}`)] : [],
      [`今日最高 ${ds.best} · 连续挑战 ${prof.streak} 天`], bonus ? [`连续挑战 ${prof.streak} 天奖励:解锁进度 +${bonus}`] : [], achLines, newOwnerLines(owners0), fresh.map(u => `解锁新摊位:{stall_${u.id}}${DEF[u.id].n}`));
  if (medal) sfx.ok(); else sfx.fail();
  ui.modal = {
    title: `今日挑战 · 热度 ${score}`, tone: medal ? 'ok' : 'bad', small: true, lines: [scoreLine(r)].concat(lines),
    buttons: [{ label: '发给好友比一比', kind: 'pri', fn: () => share(`今天的夜市挑战「${th.n}」我的热度 ${score},来比比?`, payload) },
      left > 0 ? { label: `再来一次(今天还剩 ${left} 次)`, kind: 'sec', fn: () => startDaily(rival, true) } : { label: '{play}看广告再来一次', kind: 'ad', fn: () => watchAd(() => { ds.extra++; saveProf(); enterArena(rival, true, true); }) },
      { label: '回到主线', kind: 'sec', fn: leaveArena }]
  };
}
function togglePeek() { const S = G.S; if (ui.peek) { S.stalls = ui.peek; ui.peek = null; } else { ui.peek = S.stalls; S.stalls = S.rival.stalls; ui.sel = null; } sfx.tap(); }
function share(title, payload) {
  drawAll(false);   // 先画一帧不带弹窗的干净画面,用作分享卡片的截图
  if (P.share({ title, query: 'ar=' + payload }) === 'copied') toast('挑战链接已复制,发给好友即可');
}
function arenaSettle(r) {
  if (G.S.daily) return dailySettle(r);
  const S = G.S, score = r.inc, rival = S.rival, isBest = score > ui.best, payload = L.encodeArena(score);
  if (isBest) { ui.best = score; P.store.set('arenaBest', String(score)); }
  const again = { label: rival && !r.ok ? '再战一局' : '再来一局', kind: 'sec', fn: () => enterArena(rival, true) }, back = { label: '回到主线', kind: 'sec', fn: leaveArena };
  if (!rival) {
    sfx.ok(); ui.modal = { title: `擂台热度 ${score}`, tone: 'ok', lines: [scoreLine(r), isBest ? '刷新了个人最高!' : `个人最高 ${ui.best}`], buttons: [{ label: '发给好友来挑战', kind: 'pri', fn: () => share(`我的夜市一晚热度 ${score},敢来打擂吗?`, payload) }, again, back] };
  } else if (r.ok) {
    sfx.ok(); ui.modal = { title: '打赢擂主!', tone: 'ok', lines: [`你 ${score}  :  擂主 ${rival.score}`], buttons: [{ label: '把战果发回去', kind: 'pri', fn: () => share(`你的擂台被我打下来了:热度 ${score},不服再战`, payload) }, again, back] };
  } else {
    sfx.fail(); ui.modal = {
      title: '差一点', tone: 'bad', lines: [`你 ${score}  :  擂主 ${rival.score}`, `还差 ${rival.score - score + 1}`],
      buttons: (r.encore ? [] : [{ label: '{play}看广告加场:再来 6 位顾客', kind: 'ad', fn: () => watchAd(() => { ui.modal = null; L.encore(); ui.gap = .4; ui.spawn = .2; ui.endT = 0; }) }]).concat([again, back])
    };
  }
}
function goNight() {
  const S = G.S;
  // 没有靠街的售卖摊:先提醒一次,三秒内再点才真的开张。不能直接禁止,否则没钱进货的玩家会卡死在白天
  if (!S.stalls.some(s => L.isFront(s.c) && !DEF[s.id].sup) && !(ui.goWarn > ui.t)) { ui.goWarn = ui.t + 3; sfx.bad(); return toast('没有靠街的售卖摊,开张赚不到钱。再点一次确认'); }
  for (const s of S.stalls) s.earn = 0;
  L.startNight(ui.tut ? 1 : L.WAVES); if (S.daily) { dailyState().tries++; saveProf(); }   // 每日挑战:开张才算用掉一次
  ui.sel = null; ui.inc = 0; ui.spawn = .3; ui.gap = Math.max(.15, 5 / G.N.queue.length); ui.feed = []; ui.endT = 0; sfx.open();
}

// ---------- 夜晚 ----------
function feed(s) { ui.feed.unshift({ s, life: 3 }); if (ui.feed.length > 3) ui.feed.pop(); }
function onSale(c, s, amt, f) {
  const p = plot(s.c, s.r), d = DEF[s.id]; s.bounce = 1; s.earn = (s.earn || 0) + amt;
  const special = f.thirsty || c.rich || f.last;
  ui.pops.push({ x: p.x + p.w / 2, y: p.y + 6, t: 0, s: '+¥' + amt, c: f.thirsty ? '#8fdcff' : c.rich ? '#fff0a0' : GOLD, big: special });
  if (f.heat > 0) ui.pops.push({ x: p.x + p.w / 2, y: p.y - 10, t: 0, s: '人气 +' + Math.round(f.heat * 10) / 10, c: '#ffb3d9', big: true });
  const n = Math.min(4, 1 + Math.floor(amt / 15));
  for (let i = 0; i < n; i++) ui.coins.push({ x0: p.x + p.w / 2, y0: p.y + p.h * .4, t: -i * .05, d: .45 + Math.random() * .2, cx: (Math.random() - .5) * 90 });
  if (f.thirsty) feed(`口渴连击 ×${f.thirsty} · ${d.n} +¥${amt}`); else if (c.rich) feed(`土豪消费 ×3 · ${d.n} +¥${amt}`);
  else if (f.last) feed(`临走再买 · ${d.n} +¥${amt}`); else if (s.id === 'ring') feed('有人玩了套圈,心情大好');
  sfx.coin();
}
function updateNight(dt) {
  const N = G.N, l = LAY; if (G.S.phase !== 'night') return;
  const sdt = dt * ui.speed; ui.spawn -= sdt;
  if (N.queue.length && ui.spawn <= 0) {
    ui.spawn = ui.gap; const c = L.newCust(N.queue.pop());
    Object.assign(c, { x: l.streetX + l.sw / 2 + (Math.random() - .5) * l.sw * .5, y: l.gridY - 30, dir: 1, next: 0, look: A.pickLook(c.rich, c.kid), seed: Math.random() * 9, shirt: pick(A.SHIRTS), hair: pick(A.HAIRS), skin: pick(A.SKINS), shirt2: pick(A.SHIRTS), hair2: pick(A.HAIRS), look2: A.pickLook(false) });
    ui.cust.push(c);
  }
  const sp = (l.gridH + 56) / 2.6;
  for (const c of ui.cust) {
    c.y += c.dir * sp * sdt;
    while (c.next >= 0 && c.next < ROWS && (c.dir > 0 ? c.y >= rowY(c.next) : c.y <= rowY(c.next))) { L.visit(c, c.next, onSale); c.next += c.dir; }
    if (c.dir > 0 && c.y > l.gridY + l.gridH + 26) { if (L.wantsBack(c)) { c.ret = true; c.dir = -1; c.next = ROWS - 1; } else c.done = true; }
    else if (c.dir < 0 && c.y < l.gridY - 30) c.done = true;
  }
  ui.cust = ui.cust.filter(c => !c.done);
  if (!N.queue.length && !ui.cust.length && !ui.coins.length) { ui.endT += dt; if (ui.endT > .5) { ui.endT = 0; if (L.waveDone()) { ui.sel = null; sfx.tap(); } else showSettle(L.finishNight()); } }
}
// 结算时列出当晚最赚钱的三个摊位,让玩家知道哪种摆法在起作用
function topEarners() {
  const a = G.S.stalls.filter(s => s.earn > 0).sort((x, y) => y.earn - x.earn).slice(0, 3);
  return a.length ? ['最赚钱的摊位:' + a.map(s => `${DEF[s.id].n} ¥${s.earn}`).join(' · ')] : [];
}
// 人气写成「2.6」;带了稀有秘诀就写成「2.6 × 1.8」
const heatText = o => o.heat.toFixed(1) + (o.xmult > 1 ? ' × ' + o.xmult : '');
const scoreLine = r => `流水 ¥${r.flow} × 人气 ${heatText(r)} = 热度 ${r.inc}`;
// 人气的来源明细:「起步 1 · 招牌搭配 +0.4 · 街型 +0.8 · 口渴连击 +0.5……」,带了稀有秘诀再写乘了多少
const SRC_N = [['base', '起步'], ['perk', '秘诀'], ['combo', '招牌搭配'], ['pat', '街型'], ['mid', '中场'], ['thirst', '口渴连击'], ['maxed', '买满']];
const srcLine = (src, xmult) => '人气来源:' + SRC_N.filter(([k]) => src[k] > 0).map(([k, n]) => `${n} ${k === 'base' ? '' : '+'}${Math.round(src[k] * 100) / 100}`).join(' · ') + (xmult > 1 ? `;稀有秘诀再 ×${xmult}` : '');
const patText = p => `${p.n}${p.count > 1 ? ' ×' + p.count : ''} +${p.heat}`;
// 人气从哪来:白天按现在的摆法预览开张时的人气,中场显示当晚已经涨到多少;下面列出所有街型的规则
function heatModal() {
  const N = G.S.phase === 'break' && G.N, o = L.openPreview(), pats = L.patternSummary(o.pats);
  const src = N ? Object.assign({}, N.parts, { thirst: N.hThirst, maxed: N.hMaxed, mid: N.hMid }) : o.parts;
  ui.modal = {
    title: '人气从哪来', small: true, lines: [(N ? '今晚到现在,' : '按现在的摆法,开张时') + `人气 ×${heatText(N || o)}`, srcLine(src, (N || o).xmult),
      pats.length ? '成立的街型:' + pats.map(patText).join(' · ') : '还没有凑成街型。下面任何一种都行,可以同时凑好几种',
      '营业时还会涨:口渴连击、顾客买满各 +0.1', '街型都能叠着凑(人气):']
      .concat(L.PATTERNS.map(p => `${p.n}:${p.d}`), ['招牌搭配另算,可以和街型一起吃']),
    buttons: [{ label: '知道了', kind: 'pri', fn: () => { ui.modal = null; } }]
  };
}
function showSettle(r) {
  if (G.S.arena) return arenaSettle(r);
  if (r.ok) {
    sfx.ok(); const base = r.flow + r.tip + r.interest + r.goal, extra = Math.round(base * .5);
    ui.modal = {
      title: '今晚达标!', tone: 'ok', small: true, lines: [scoreLine(r), srcLine(r.src, r.xmult), `目标 ${r.T},达标`].concat(r.tip ? [`小费 +¥${r.tip}`] : [], r.interest ? [`利息 +¥${r.interest}(没花的钱每 ¥10 生 ¥1,上限 ¥${L.interestCap()})`] : [], r.goal ? [`小目标达成 +¥${r.goal}`] : [], topEarners()),
      buttons: [{ label: `收摊  +¥${base}`, kind: 'pri', fn: () => afterSettle(true, base) }, { label: `{play}看广告多得 50%  +¥${base + extra}`, kind: 'ad', fn: () => watchAd(() => afterSettle(true, base + extra)) }]
    };
  } else {
    sfx.fail();
    P.store.set('pendingFail', String(r.flow));   // 记一笔:如果在这个界面直接退出,下次进来按未达标结算
    ui.modal = {
      title: '没达标', tone: 'bad', small: true, lines: [scoreLine(r), srcLine(r.src, r.xmult), `目标 ${r.T},还差 ${r.T - r.inc}`].concat(r.goal ? [`小目标达成 +¥${r.goal}`] : [], topEarners()),
      buttons: (r.encore ? [] : [{ label: '{play}看广告加场:再来 6 位顾客', kind: 'ad', fn: () => watchAd(() => { ui.modal = null; L.encore(); ui.gap = .4; ui.spawn = .2; ui.endT = 0; }) }])
        .concat([{ label: '认了(失去一颗心)', kind: 'sec', fn: () => afterSettle(false, r.flow + r.goal) }])
    };
  }
}
const shareBtn = n => ({ label: '炫耀一下', kind: 'sec', fn: () => { drawAll(false); if (P.share({ title: `我的夜市撑过了 ${n} 晚,你能超过吗?`, query: 'from=share' }) === 'copied') toast('链接已复制'); } });
function afterSettle(ok, gain) {
  P.store.set('pendingFail', '');
  const snap = snapshot(), hearts0 = G.S.hearts, who = L.ownerOf().k;   // 结算前先拍快照:结算后当晚的数据就清掉了
  const night = G.S.night, res = L.settle(ok, gain); ui.modal = null; ui.cust = [];
  const owners0 = openOwners(), before = prof.cleared; let newStake = 0;
  if (ok) {   // 记入档案:最高纪录、累计过关晚数
    prof.cleared++; prof.best = Math.max(prof.best, night);
    if (res === 'win' && prof.wonWith.indexOf(who) < 0) prof.wonWith.push(who);
    if (res === 'win' && L.stake() >= (prof.stake || 1) && L.stake() < L.STAKES.length) { prof.stake = L.stake() + 1; newStake = prof.stake; }
  }
  const achLines = grantAch(Object.assign(snap, { win: res === 'win', full: hearts0 >= L.maxHearts(), best: prof.best, wonWith: prof.wonWith.length }));
  saveProf(); G.cleared = prof.cleared;
  const fresh = L.UNLOCKS.filter(u => u.at > before && u.at <= prof.cleared);   // 过关和成就都会推进解锁进度,一起看有没有新摊位
  const go = () => {
    ui.modal = null;
    if (res === 'win') {
      sfx.ok(); ui.modal = {
        title: '夜市之王', tone: 'ok', lines: [`你撑过了 ${MAXN} 个夜晚,手握 ¥${G.S.money}`].concat(newStake ? [`解锁「${L.STAKES[newStake - 1].n}」:${L.STAKES[newStake - 1].d}`] : [], ['接着干,看看能撑到第几晚?']),
        buttons: [{ label: '继续营业(无尽模式)', kind: 'pri', fn: () => { L.goEndless(); perkModal(); } }, shareBtn(night), { label: '再来一局', kind: 'sec', fn: restart }]
      };
    } else if (res === 'perk') perkModal();
    else if (res === 'over') ui.modal = {
      title: '交不起摊位费', tone: 'bad', lines: [`止步第 ${night} 晚`, `历史最佳:撑过 ${prof.best} 晚`],
      buttons: (G.S.revived ? [] : [{ label: '{play}看广告续租一晚', kind: 'ad', fn: () => watchAd(() => { ui.modal = null; L.revive(); }) }])
        .concat(night > 1 ? [shareBtn(night - 1)] : [], [{ label: '重新开始', kind: 'sec', fn: restart }])
    };
  };
  const ownerLines = newOwnerLines(owners0);
  if (fresh.length || ownerLines.length || achLines.length) {
    sfx.merge(); ui.modal = {
      title: fresh.length ? '新摊位解锁!' : ownerLines.length ? '新摊主解锁!' : '成就达成!', tone: 'ok', small: true,
      lines: achLines.concat(fresh.map(u => `{stall_${u.id}}${DEF[u.id].n}:${DEF[u.id].d}`), fresh.length ? ['从现在起会出现在进货里'] : [], ownerLines), buttons: [{ label: '太好了', kind: 'pri', fn: go }]
    };
  }
  else go();
}
// list: 已经抽好的几个选项(从「换掉哪一个」返回时用,不能重抽);不传就新抽一批
function perkModal(list) {
  const ch = Array.isArray(list) ? list : L.perkChoices(), n = L.perkSlots(), full = n >= L.perkCap();
  ui.modal = {
    title: `选一条经营秘诀(${n}/${L.perkCap()})`,
    perks: ch.map(p => ({ p, fn: () => { if (L.takePerk(p) === 'full') return swapModal(p, ch); ui.modal = null; sfx.merge(); } })),
    buttons: [{ label: '{play}看广告换一批', kind: 'ad', fn: () => watchAd(() => perkModal()) }]
      .concat(full || !ch.length ? [{ label: '都不要,直接开下一晚', kind: 'sec', fn: () => { L.skipPerk(); ui.modal = null; sfx.tap(); } }] : [])
  };
}
// 栏位满了:选一个旧的换掉
function swapModal(p, ch) {
  ui.modal = {
    title: `换掉哪一个?换成「${p.n}」`,
    perks: L.ownedPerks().map(o => ({ p: o, fn: () => { L.takePerk(p, o.k); ui.modal = null; sfx.merge(); } })),
    buttons: [{ label: '不换了,返回', kind: 'sec', fn: () => perkModal(ch) }]
  };
}
// 重新开始:先选一位摊主。没解锁的也列出来并写明条件,给玩家一个盼头
function startRun(k, lv) { L.newGame(k, lv); resetUi(); sfx.open(); }
// 选难度:只解锁了「普通」时不问,直接开始。每一档都包含前面各档的限制
function stakeModal(k) {
  const top = Math.min(L.STAKES.length, prof.stake || 1); if (top <= 1) return startRun(k, 1);
  ui.modal = {
    title: '选难度',
    perks: L.STAKES.slice(0, Math.min(L.STAKES.length, top + 1)).map((st, i) => {
      const ok = i < top; return { p: { k: 'stake' + i, n: st.n, d: i ? st.d + '(含前面各档)' : st.d }, icon: 'stake_' + (i + 1), locked: !ok, note: ok ? '' : '用上一档难度通关后解锁', fn: ok ? () => startRun(k, i + 1) : () => { sfx.bad(); toast('用上一档难度通关后解锁'); } };
    }),
    buttons: [{ label: '返回选摊主', kind: 'sec', fn: restart }]
  };
}
function restart() {
  if (G.S.arena) L.exitArena();
  ui.modal = {
    title: '选一位摊主',
    perks: L.OWNERS.map(o => { const ok = ownerOpen(o); return { p: o, icon: 'owner_' + o.k, locked: !ok, note: ok ? '' : '解锁条件:' + o.need.t, fn: ok ? () => stakeModal(o.k) : () => { sfx.bad(); toast('还没解锁:' + o.need.t); } }; }),
    buttons: [{ label: '随便来一位', kind: 'sec', fn: () => stakeModal(pick(openOwners())) }]
  };
}
function helpModal() {
  const next = L.UNLOCKS.find(u => prof.cleared < u.at);   // 下一个要解锁的摊位
  ui.modal = {
    title: '怎么玩', small: true, lines: ['顾客从街口走到街尾,路过靠街的摊位时可能消费', '每晚热度达到目标才算过关,共 10 晚;通关后可以继续无尽模式', '点卡片选货,再点地块摆放;同名同级叠放升级', '里排放支援摊,加成覆盖同侧周围一圈', '顺序很重要:先烤串后奶茶,奶茶翻倍', '热度 = 流水 × 人气。流水是实收的钱;口渴连击、顾客买满、凑成招牌搭配都会涨人气', '第 3、6、9、10 晚是大考,规则提前公布,过了必出一个稀有秘诀', '一晚的客人分三波来,每波之间可以调整摊位,每晚 2 次', '没花掉的钱收摊时有利息:每 ¥10 生 ¥1,有上限', '有些摊位紧挨着摆会凑成「招牌搭配」,图鉴里能查', '同一侧连着同品类、对门同品类、品类齐全、同名开连锁、等级步步高,都是「街型」,能叠着涨人气。点顶上的「人气」看明细']
      .concat(!G.S.arena && L.stake() > 1 ? [`本局${L.STAKES[L.stake() - 1].n}:${L.STAKES.slice(1, L.stake()).map(x => x.d).join(';')}`] : [], !G.S.arena && L.ownerOf().k !== 'none' ? [`本局摊主「${L.ownerOf().n}」:${L.ownerOf().d}`] : [], prof.best ? [`历史最佳:撑过 ${prof.best} 晚`] : [], next ? [`再撑过 ${next.at - prof.cleared} 晚,解锁新摊位「${DEF[next.id].n}」`] : [], [`版本 ${P.version}${P.env ? '(' + P.env + ')' : ''}`]),
    buttons: [{ label: '知道了', kind: 'pri', fn: () => { ui.modal = null; } }, { label: `音效:${prof.sound ? '开' : '关'}`, kind: 'sec', fn: () => { prof.sound = !prof.sound; saveProf(); helpModal(); } }]
      .concat(G.S.arena ? [] : [{ label: '重新开始主线', kind: 'sec', fn: restart }])
  };
}
// ---------- 摊位图鉴:所有摊位排成一页(售卖摊在前),点开看作用和搭配 ----------
const HINT = {
  kebab: '后面接一个奶茶摊,奶茶的收入翻倍', tofu: '周围只放小吃,或者摆到街对面,免得熏到别的摊', rice: '单价高。放在靠街尾的位置,免得顾客吃饱后不买前面的小吃',
  tea: '放在烤串后面。挨着冰柜再加 50%', candy: '便宜好卖,适合用来凑同名升级', ice: '放街尾:顾客前面买得越多,它卖得越贵',
  ring: '放街口:玩过的顾客之后每一单都多付 40%', phone: '放在套圈后面,开心的顾客更愿意买', lamp: '放里排,让它照到尽量多的靠街摊位',
  fridge: '挨着奶茶、糖葫芦、冰粉', grill: '挨着烤串、臭豆腐、炒饭', cat: '挨着卖得最多的摊位,每卖一单都多赚',
  lemon: '放在炒饭后面,吃饱的顾客喝完又能买小吃;放在烤串后面一样翻倍', balloon: '放街口:拿到气球的顾客一路上都更愿意买',
  crayfish: '后面接奶茶或柠檬水,饮品收入×3。冷门,旁边放灯牌',
};
const CAT_NAME = { food: '小吃', drink: '饮品', sweet: '甜品', game: '玩具', goods: '杂货' };
const needOf = id => { const u = L.UNLOCKS.find(x => x.id === id); return u ? Math.max(0, u.at - prof.cleared) : 0; };
const comboFound = c => prof.combos.indexOf(c.k) >= 0;
function codexModal() {
  ui.modal = {
    title: '摊位图鉴', small: true, lines: ['点一个摊位看它的作用和搭配。棚顶和色带的颜色代表品类。'], grid: Object.keys(DEF).sort((a, b) => !!DEF[a].sup - !!DEF[b].sup).map(id => ({ id, need: needOf(id) })),
    buttons: [{ label: `招牌搭配 ${L.COMBOS.filter(comboFound).length}/${L.COMBOS.length}`, kind: 'pri', fn: comboModal }, { label: `成就 ${prof.ach.length}/${L.ACHS.length}`, kind: 'sec', fn: achModal }, { label: '关闭', kind: 'sec', fn: () => { ui.modal = null; } }]
  };
}
// 成就列表:达成的打实心星,没达成的打空心星
function achModal() {
  ui.modal = {
    title: `成就 ${prof.ach.length}/${L.ACHS.length}`, small: true,
    lines: ['每达成一个,奖励 1 到 3 点解锁进度。'].concat(L.ACHS.map(a => (prof.ach.indexOf(a.k) >= 0 ? '★ ' : '☆ ') + `${a.n}:${a.d}`)),
    buttons: [{ label: '返回图鉴', kind: 'pri', fn: codexModal }]
  };
}
// 搭配图鉴:摆出来过的写明做法;没摆出来过的只给一点线索(提到一个已经解锁的摊位)
function comboModal() {
  const lines = ['街同一侧、上下紧挨着的两个靠街摊位,凑对了就有加成。摆出来一次就记在这里。'].concat(L.COMBOS.map(c => {
    if (comboFound(c)) return `「${c.n}」${c.d}`;
    const ka = c.a.filter(id => !needOf(id)), kb = c.b.filter(id => !needOf(id)), one = ka[0] || kb[0];
    return '「???」' + (ka.length && kb.length ? `和${DEF[ka[0]].n}有关` : one ? `和${DEF[one].n}有关,还要一个没解锁的摊位` : '要用到还没解锁的摊位');
  }));
  ui.modal = { title: `招牌搭配 ${L.COMBOS.filter(comboFound).length}/${L.COMBOS.length}`, small: true, lines, buttons: [{ label: '返回图鉴', kind: 'pri', fn: codexModal }, { label: '街型说明', kind: 'sec', fn: heatModal }] };
}
function stallModal(id) {
  const d = DEF[id], need = needOf(id);
  ui.modal = {
    title: d.n, small: true,
    lines: (need ? [`还没解锁:再撑过 ${need} 晚就会出现在进货里(主线过关、每日挑战拿奖牌都算)`] : [])
      .concat([d.sup ? '支援摊:自己不卖东西,给同侧周围一圈的摊位加成。升级后加成翻倍' : `${CAT_NAME[d.cat]} · 售价 ¥${d.p} · 吸引力 ${Math.round(d.a * 100)}% · 进货价 ¥${d.cost}`, d.d].concat(d.s3 ? ['升到 3 级的招牌技:' + d.s3] : [], ['怎么摆:' + HINT[id]]), L.COMBOS.filter(c => comboFound(c) && c.a.concat(c.b).indexOf(id) >= 0).map(c => `搭配「${c.n}」${c.d}`)),
    buttons: [{ label: '返回图鉴', kind: 'pri', fn: codexModal }]
  };
}
function perkListModal() {
  const own = L.ownedPerks(); if (!own.length) return helpModal();
  ui.modal = { title: `已有的经营秘诀 ${own.length}/${L.perkCap()}`, small: true, lines: [`最多带 ${L.perkCap()} 种;同一种最多叠到 ${L.PERK_MAX} 级,稀有的和只有一级的不能叠`].concat(own.map(p => `{perk_${p.k}}${p.n}${p.r ? '(稀有)' : p.one ? '' : ' ' + L.perk(p.k) + ' 级'}:${p.d}`
      + (p.k === 'regular' ? `(已涨 ${Math.round(L.grown('regular') * L.REGULAR * 100)}%)` : p.k === 'fame' ? `(已攒 +${L.grown('fame')})` : ''))),   /* 成长型秘诀:写上已经攒了多少 */ buttons: [{ label: '知道了', kind: 'pri', fn: () => { ui.modal = null; } }] };
}

// ---------- 绘制:场景 ----------
// 用地面贴图铺满一块矩形;没有这张贴图时返回 false,由调用方画纯色。贴图按四分之一大小平铺,纹理才不会太粗
function tiled(name, x, y, w, h, k = .25) {
  const im = A.image(name); if (!im) return false; if (!im._pat) im._pat = ctx.createPattern(im, 'repeat');
  ctx.save(); ctx.scale(k, k); ctx.fillStyle = im._pat; ctx.fillRect(x / k, y / k, w / k, h / k); ctx.restore(); return true;
}
function drawScene() {
  const l = LAY, S = G.S, d = ui.dark, day = S.phase === 'day', sel = ui.sel, pulse = .5 + .5 * Math.sin(ui.t * 5);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, mix([92, 62, 110], [24, 20, 48], d)); bg.addColorStop(.5, mix([58, 44, 86], [16, 14, 34], d)); bg.addColorStop(1, mix([34, 28, 58], [10, 9, 22], d));
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // 人行道与街面
  for (const x of [4, l.streetX + l.sw + 2]) {
    A.rr(ctx, x, l.gridY - 6, 2 * l.cw + 2, l.gridH + 12, 12); ctx.save(); ctx.clip();
    if (!tiled('tile_walk', x, l.gridY - 6, 2 * l.cw + 2, l.gridH + 12)) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fill(); }
    ctx.restore();
  }
  if (tiled('tile_street', l.streetX + 2, l.gridY - 26, l.sw - 4, l.gridH + 60)) { ctx.fillStyle = `rgba(8,7,18,${.15 + .3 * d})`; ctx.fillRect(l.streetX + 2, l.gridY - 26, l.sw - 4, l.gridH + 60); }   // 贴图上压一层暗色,入夜更暗
  else { ctx.fillStyle = mix([52, 46, 78], [26, 24, 44], d); ctx.fillRect(l.streetX + 2, l.gridY - 26, l.sw - 4, l.gridH + 60); }
  ctx.fillStyle = 'rgba(255,255,255,.05)'; for (let y = l.gridY - 20; y < l.gridY + l.gridH + 30; y += 22) ctx.fillRect(l.streetX + l.sw / 2 - 1.5, y, 3, 11);
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(l.streetX + 2, l.gridY - 26, 2, l.gridH + 60); ctx.fillRect(l.streetX + l.sw - 4, l.gridY - 26, 2, l.gridH + 60);
  // 地块
  const range = sel && sel.kind === 'stall' && DEF[sel.s.id].sup ? sel.s : null;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = plot(c, r), open = S.unlocked.has(c + ',' + r), at = L.stallAt(c, r);
    A.rr(ctx, p.x + 2, p.y + 2, p.w - 4, p.h - 4, 9);
    if (open) {
      ctx.fillStyle = L.isFront(c) ? 'rgba(255,214,160,.09)' : 'rgba(255,255,255,.045)'; ctx.fill();
      if (range && L.inRange(range, c, r)) { ctx.fillStyle = `rgba(${A.AURA[range.id]},${.18 + .1 * pulse})`; ctx.fill(); }
      if (sel && sel.kind === 'shop' && day) {
        const id = S.shop[sel.i].id;
        if (!at) { ctx.strokeStyle = `rgba(120,255,170,${.35 + .4 * pulse})`; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]); }
        else if (at.id === id && at.lvl === 1) { ctx.strokeStyle = `rgba(255,215,90,${.5 + .5 * pulse})`; ctx.lineWidth = 2.5; ctx.stroke(); }
      }
      if (sel && sel.kind === 'stall' && sel.s === at) { ctx.strokeStyle = `rgba(255,215,90,${.6 + .4 * pulse})`; ctx.lineWidth = 2.5; ctx.stroke(); }
    } else {
      if (A.image('tile_walk')) { ctx.fillStyle = 'rgba(8,7,18,.5)'; ctx.fill(); }   // 铺了地面贴图以后,没解锁的地块压暗一层,和能用的地块分开
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      if (day && L.canUnlock(c, r)) txt('+¥' + L.unlockCost(), p.x + p.w / 2, p.y + p.h / 2, 11, S.money >= L.unlockCost() ? '#b9f5cf' : DIM, 'center');
    }
    if (day || S.phase === 'break') hit(p.x, p.y, p.w, p.h, () => tapPlot(c, r));
  }
  // 街口牌楼:有 gate.png 就画图,立在街口正中;没有就画一道写着「夜市」的红横梁
  const gate = A.image('gate'), gcx = l.streetX + l.sw / 2;
  if (gate) { const gh = 46, gw = gh * gate.width / gate.height; ctx.drawImage(gate, gcx - gw / 2, l.gridY - 2 - gh, gw, gh); }   // 牌楼图太小,横匾里写不下字,就不写了
  else {
    A.rr(ctx, l.streetX - 4, l.gridY - 30, l.sw + 8, 20, 6); ctx.fillStyle = '#b8322a'; ctx.fill();
    ctx.fillStyle = '#e25a40'; ctx.fillRect(l.streetX - 4, l.gridY - 30, l.sw + 8, 4); txt('夜 市', gcx, l.gridY - 19, 12, '#ffe6a0', 'center', true);
  }
  A.glow(ctx, l.streetX + l.sw / 2, l.gridY - 20, 50, '255,120,70', .12 + .2 * d);
  // 摊位(逐排绘制,前排遮挡后排)与靠街的地面光
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const s = L.stallAt(c, r); if (!s) continue; const p = plot(c, r), def = DEF[s.id];
    if (s.bounce) s.bounce = Math.max(0, s.bounce - DT * 5);
    if (L.isFront(c) && !def.sup) A.glow(ctx, c === 1 ? l.streetX + 6 : l.streetX + l.sw - 6, p.y + p.h * .75, 34, '255,180,90', .22 * d);
    A.drawStall(ctx, p.x, p.y, p.w, p.h, s, def, d, ui.t);
  }
  // 每个摊位底下挂一块名牌,不用点开就知道是什么:左半是品类色底的名字,右半白天显示「售价·吸引力」(支援摊显示作用)
  for (const s of S.stalls) {
    const p = plot(s.c, s.r), def = DEF[s.id], bad = !def.sup && !L.isFront(s.c);
    let info = !(day || S.phase === 'break') ? '' : def.sup ? SUP_INFO[s.id](s.lvl) : bad ? '不靠街' : (st => st.closed ? '今晚停业' : `¥${Math.round(st.price)}·${Math.round(st.a * 100)}%`)(L.statOf(s));
    ctx.font = font(9.5, true); const nw = ctx.measureText(def.n).width + 6; ctx.font = font(8.5, true); let iw = info ? ctx.measureText(info).width + 6 : 0;
    // 名牌不能比地块宽,否则会盖住旁边摊位的名字:放不下就换短写法(售卖摊只写售价,支援摊只写数值),还放不下就只留名字
    if (info && nw + iw > p.w + 2) {
      if (!bad) { info = def.sup ? info.replace(/^[^+]+/, '') : info.split('·')[0]; iw = ctx.measureText(info).width + 6; }
      if (nw + iw > p.w + 2) { info = ''; iw = 0; }
    }
    const w = nw + iw, x = p.x + p.w / 2 - w / 2, y = p.y + p.h - 14;
    A.rr(ctx, x - 1, y - 1, w + 2, 15, 5); ctx.fillStyle = INK; ctx.fill();
    ctx.save(); A.rr(ctx, x, y, w, 13, 4); ctx.clip();
    ctx.fillStyle = def.sup ? BROWN : A.CAT_COLOR[def.cat]; ctx.fillRect(x, y, nw, 13);
    if (iw) { ctx.fillStyle = bad ? '#7a2a22' : PAPER; ctx.fillRect(x + nw, y, iw, 13); }
    ctx.restore();
    txt(def.n, x + nw / 2, y + 7, 9.5, '#fff', 'center', true); if (iw) txt(info, x + nw + iw / 2, y + 7, 8.5, bad ? '#ffd0c8' : INK, 'center', true);
    if (s.lvl > 1) { A.rr(ctx, p.x + p.w - 25, p.y, 24, 14, 5); ctx.fillStyle = INK; ctx.fill(); A.rr(ctx, p.x + p.w - 24, p.y + 1, 22, 12, 4); ctx.fillStyle = s.lvl > 2 ? GOLD : '#8fc4ff'; ctx.fill(); txt('Lv' + s.lvl, p.x + p.w - 13, p.y + 7.5, 9, INK, 'center', true); }
  }
  // 招牌搭配:两个摊位之间挂一枚金牌
  // 连摊:沿街边画一道品类色的竖条,标出连在一起的那几个摊位
  for (const pt of L.streetPatterns()) if (pt.k === 'chain') {
    const ss = S.stalls.filter(s => pt.uids.indexOf(s.uid) >= 0); if (!ss.length) continue;
    const r0 = Math.min(...ss.map(s => s.r)), r1 = Math.max(...ss.map(s => s.r)), bx = ss[0].c === 1 ? l.streetX + 2 : l.streetX + l.sw - 6;
    A.rr(ctx, bx, l.gridY + r0 * l.rh + 8, 4, (r1 - r0 + 1) * l.rh - 16, 2); ctx.fillStyle = A.CAT_COLOR[DEF[ss[0].id].cat]; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
  }
  for (const x of L.activeCombos()) {
    const gap = Math.abs(x.a.r - x.b.r) > 1;   // 「隔空搭配」凑成的:金牌挂在中间那个摊位的左边
    const up = x.a.r < x.b.r ? x.a : x.b, p = plot(up.c, up.r + (gap ? 1 : 0)), bx = p.x + 4, by = gap ? p.y + p.h / 2 : p.y + p.h + 4;   // 挂在两摊交界的左角:右上角留给等级牌
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(bx, by, 7.5, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    txt('搭', bx, by + .5, 8.5, INK, 'center', true);
  }
  // 顾客
  ui.cust.sort((a, b) => a.y - b.y);
  for (const c of ui.cust) { ctx.globalAlpha = Math.max(0, Math.min(1, (c.y - (l.gridY - 30)) / 14, (l.gridY + l.gridH + 26 - c.y) / 14));
    // 顾客随地块高度等比缩放,保持「人高约为摊位高的一半」
    const k = l.rh / 68 * (c.kid ? .72 : 1); ctx.save(); ctx.translate(c.x, c.y); ctx.scale(k, k);
    if (c.couple) A.drawPerson(ctx, Object.assign({}, c, { x: 7, y: 0, shirt: c.shirt2, hair: c.hair2, seed: c.seed + 2, look: c.look2, thirsty: 0, happy: false, full: false, balloon: false }), ui.t);   // 情侣:旁边多画一个人,头顶标记只画一份
    A.drawPerson(ctx, Object.assign({}, c, { x: c.couple ? -6 : 0, y: 0 }), ui.t); ctx.restore();
  } ctx.globalAlpha = 1;
  // 横跨街道的灯串
  const cols = ['255,215,106', '255,142,106', '127,214,255', '182,255,138'];
  for (const k of [1, 3, 5]) {
    const y = l.gridY + l.rh * k - 4, x0 = l.streetX - 2, x1 = l.streetX + l.sw + 2;
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + 16, x1, y); ctx.stroke();
    for (let i = 1; i <= 5; i++) {
      const u = i / 6, bx = x0 + (x1 - x0) * u, by = y + 16 * 2 * u * (1 - u), col = cols[(i + k) % 4], tw = .75 + .25 * Math.sin(ui.t * 3 + i * 1.7 + k);
      A.glow(ctx, bx, by + 2, 9, col, (.18 + .32 * d) * tw); ctx.fillStyle = `rgb(${col})`; ctx.beginPath(); ctx.arc(bx, by + 2, 2, 0, 7); ctx.fill();
    }
  }
  // 暗角
  const vg = ctx.createRadialGradient(W / 2, H * .45, H * .25, W / 2, H * .45, H * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${.2 + .3 * d})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// ---------- 绘制:顶部 HUD ----------
function drawHUD() {
  const l = LAY, S = G.S, y = l.top, T = L.target(), night = S.phase !== 'day', ar = S.arena;
  // 左:木牌写第几晚,旁边是生命;右:纸价签写钱
  const title = ar ? (S.daily ? '每日挑战' : '擂台赛') : (S.endless ? `第 ${S.night} 晚 · 无尽` : `第 ${S.night}/${MAXN} 晚`) + (S.event && S.event.boss ? ' · 大考' : '');
  ctx.font = font(13, true); const tw = ctx.measureText(title).width + 20;
  plate(10, y + 1, tw, 23, WOOD, 6, 2); txt(title, 10 + tw / 2, y + 13, 13, PAPER, 'center', true);
  if (ar) txt(S.daily ? L.themeOf(S.day).n : S.rival ? '对战好友' : '自由练习', 20 + tw, y + 13, 12, WARM, 'left', true);
  else for (let i = 0; i < L.maxHearts(); i++) A.drawHeart(ctx, 28 + tw + i * 19, y + 13, 7, i < S.hearts);
  const ms = '¥ ' + Math.round(ui.money); ctx.font = font(15, true); const mw = ctx.measureText(ms).width + 34;
  plate(W - 10 - mw, y + 1, mw, 23, PAPER, 6, 2); A.drawCoin(ctx, W - 10 - mw + 13, y + 12.5, 6.5); txt(ms, W - 18, y + 13, 15, INK, 'right', true);
  // 人气:白天显示按现在的摆法开张时是多少,夜里显示实时的。放在钱的左边;左边的内容太长放不下时不显示
  const hm = night && G.N ? G.N.heat * G.N.xmult : (o => o.heat * o.xmult)(L.openPreview()), hs = '人气 ×' + hm.toFixed(1);
  ctx.font = font(12, true); const hsw = ctx.measureText(hs).width;
  if (W - 18 - mw - hsw > (ar ? 20 + tw + 70 : 28 + tw + L.maxHearts() * 19)) {
    txt(hs, W - 18 - mw, y + 13, 12, night ? '#ffb3d9' : WARM, 'right', true);
    if (S.phase !== 'night') hit(W - 24 - mw - hsw, y - 2, hsw + 12, 30, heatModal);   // 点人气:看人气从哪来、有哪些街型(夜里不弹,免得挡住结算)
  }
  // 目标进度条:一根木条,热度用红色填充,达标后变绿
  const gold = S.daily ? L.medalLines(L.themeOf(S.day))[2] : 0, ref = gold || T || (ar ? ui.best : 0);   // 进度条的满格:主线是目标,擂台是擂主成绩或个人最高
  const bx = 12, by = y + 30, bw = W - 24, bh = 20, k = night && ref ? Math.min(1, ui.inc / ref) : 0;
  const barText = !ar ? (night ? `热度 ${Math.round(ui.inc)} / 目标 ${T}` : `热度目标 ${T} · 客流 ${L.custCount() + 2 * L.perk('rich')} 人 · 每人最多买 ${L.capN()} 次`)
    : S.daily ? (night ? `热度 ${Math.round(ui.inc)} / 金牌 ${gold}` : `客流 ${L.custCount() + 2 * L.perk('rich')} 人 · 每人最多买 ${L.capN()} 次 · 金牌 ${gold}`)
    : night ? `热度 ${Math.round(ui.inc)}` + (T ? ` / 擂主 ${T}` : ui.best ? ` / 个人最高 ${ui.best}` : '')
      : `预算 ¥${ARENA.budget} · 客流 ${ARENA.cust} 人 · ` + (T ? `擂主 ${T}` : ui.best ? `个人最高 ${ui.best}` : '只营业一晚');
  A.rr(ctx, bx, by, bw, bh, 6); ctx.fillStyle = WOOD_D; ctx.fill();
  if (k > 0) { ctx.save(); A.rr(ctx, bx, by, bw, bh, 6); ctx.clip(); ctx.fillStyle = k >= 1 ? GREEN : RED; ctx.fillRect(bx, by, bw * k, bh); ctx.restore(); }
  A.rr(ctx, bx, by, bw, bh, 6); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  txt(barText, W / 2, by + bh / 2 + .5, 11, PAPER, 'center', true);
  // 第三行:主线显示经营秘诀和挑战入口;擂台里显示提示和「看擂主摆法」
  const py = y + 65, pill = (x, w, label, fn) => { plate(x, py - 11, w, 21, PAPER, 6, 2); txt(label, x + w / 2, py, 11, INK, 'center', true); hit(x, py - 14, w, 28, fn); };
  if (ar) {
    if (S.rival && S.phase === 'day') { txt(ui.peek ? '正在看擂主的摆法' : '想赢?先看看擂主怎么摆', 12, py, 11, WARM); pill(W - 106, 62, ui.peek ? '看我的' : '看擂主', togglePeek); }
    else txt(S.daily ? `今日主题:${L.themeOf(S.day).d}` : S.rival ? '热度超过擂主就算赢' : '摆出最高热度,再发给好友来挑战', 12, py, 11, WARM);
  } else {
    const own = L.ownedPerks();
    if (own.length) { let x = 12; const lab = `秘诀 ${own.length}/${L.perkCap()}`; txt(lab, x, py, 11, WARM); x += ctx.measureText(lab).width + 8; for (const p of own) { if (x > W - 186) break; drawToken('perk_' + p.k, x + 9, py, 18, TXT); x += 20; if (L.perk(p.k) > 1) { const s = '×' + L.perk(p.k); txt(s, x, py, 11, TXT, 'left', true); x += ctx.measureText(s).width; } x += 4; } }
    else txt('每晚达标后选一条经营秘诀', 12, py, 11, WARM);
    hit(0, py - 12, W - 164, 24, perkListModal);
    if (S.phase === 'day') {
      pill(W - 154, 52, '图鉴', codexModal);
      pill(W - 96, 52, '挑战', challengeModal);
      if (!dailyState().tries) { ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(W - 45, py - 11, 4.5, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); }   // 今天的每日挑战还没打:红点提醒
    }
  }
  plate(W - 34, py - 11, 23, 21, PAPER, 10.5, 2); txt('?', W - 22.5, py, 13, INK, 'center', true); hit(W - 40, py - 14, 40, 28, helpModal);
}

// ---------- 绘制:底部面板 ----------
function drawPanel() {
  const l = LAY, S = G.S, y = l.panelY;
  // 底板:一块深色木板,顶上一道亮边,几道木纹
  if (!tiled('tile_wood', 0, y, W, l.panelH + 40, .5)) { ctx.fillStyle = WOOD_D; ctx.fillRect(0, y, W, l.panelH + 40); }
  ctx.fillStyle = INK; ctx.fillRect(0, y, W, 3); ctx.fillStyle = WOOD; ctx.fillRect(0, y + 3, W, 2);
  ctx.fillStyle = 'rgba(0,0,0,.16)'; for (const yy of [58, 116, 166]) ctx.fillRect(0, y + yy, W, 1.5);
  if (S.phase === 'day') {
    // 说明条:一张纸签
    plate(10, y + 11, W - 20, 43, PAPER, 6, 2);
    if (ui.peek) {   // 正在看擂主的摆法:只能看,不能动
      txt(`擂主的摆法 · 热度 ${S.rival.score}`, 20, y + 24, 13.5, RED, 'left', true); txt('记住 TA 的顺序和支援摊位置,回去摆一个更好的', 20, y + 42, 11, INK);
      btn(10, y + 104, W - 20, 46, '回到我的夜市', 'pri', togglePeek); return;
    }
    const sel = ui.sel;
    if (sel) {
      const stall = sel.kind === 'stall', id = stall ? sel.s.id : S.shop[sel.i].id, d = DEF[id], head = d.n + (stall ? ' Lv' + sel.s.lvl : '');
      txt(head, 20, y + 24, 14, RED, 'left', true);
      txt(d.sup ? '支援摊' : `售价 ${d.p} · 吸引 ${Math.round(d.a * 100)}%`, 30 + ctx.measureText(head).width, y + 24, 11, BROWN);
      txt(wrap(stall && sel.s.lvl >= 3 && d.s3 ? '3 级招牌技:' + d.s3 : d.d, stall ? 250 : 335, 11)[0], 20, y + 42, 11, INK);
      if (stall) btn(W - 94, y + 17, 76, 28, `退货 +¥${L.sellVal(sel.s)}`, 'pri', () => { L.sell(sel.s); ui.sel = null; sfx.place(); });
    } else {
      const gi = L.goalInfo();   // 今晚有小目标时,第一行换成小目标
      txt(gi ? `小目标:${gi.text},奖 ¥${gi.reward}` : '点卡片选货,再点地块摆放。点已摆的摊位可以挪动。', 20, y + 24, 11.5, INK, 'left', true);
      const ev = L.eventInfo();   // 今晚有事件时,第二行换成事件说明
      const nb = L.nextBoss();
      if (ev) txt(wrap(ev.boss ? `今晚大考「${ev.n}」:${ev.d}` : `今晚${ev.n}:${ev.d}`, 335, 11)[0], 20, y + 42, 11, RED, 'left', true);
      else if (nb) txt(wrap(`第 ${nb.night} 晚大考「${nb.n}」:${nb.d}`, 335, 11)[0], 20, y + 42, 11, BROWN);
      else txt('靠街的摊位才接客;名牌上的数字是「售价·吸引力」', 20, y + 42, 11, BROWN);
    }
    // 进货卡片:纸价签。顶上是品类色带,中间是摊位的图、名字和一句话作用,底下是价格
    for (let i = 0; i < 4; i++) {
      const o = S.shop[i], d = DEF[o.id], on = sel && sel.kind === 'shop' && sel.i === i, x = 10.5 + i * 90, cy = y + 62 - (on ? 5 : 0), cw = 84, ch = 98, cost = L.costOf(d);
      ctx.globalAlpha = o.sold ? .38 : 1;
      plate(x, cy, cw, ch, PAPER, 7);
      ctx.save(); A.rr(ctx, x + 1, cy + 1, cw - 2, ch - 2, 6); ctx.clip();
      ctx.fillStyle = d.sup ? BROWN : A.CAT_COLOR[d.cat]; ctx.fillRect(x, cy, cw, 7); ctx.fillStyle = PAPER_D; ctx.fillRect(x, cy + ch - 21, cw, 21); ctx.restore();
      if (on) { A.rr(ctx, x - 2, cy - 2, cw + 4, ch + 4, 9); ctx.strokeStyle = RED; ctx.lineWidth = 3; ctx.stroke(); }
      const im = A.image('stall_' + o.id);
      if (im) { const hh = 44, ww = hh * im.width / im.height; ctx.drawImage(im, x + cw / 2 - ww / 2, cy + 9, ww, hh); }
      else { ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(d.e, x + cw / 2, cy + 31); }
      txt(d.n, x + cw / 2, cy + 60, 12.5, INK, 'center', true);
      txt(d.t, x + cw / 2, cy + 72, 9, BROWN, 'center');
      txt(o.sold ? '已进货' : '¥' + cost, x + cw / 2, cy + ch - 10, 12.5, o.sold ? BROWN : S.money >= cost ? RED : '#a89a84', 'center', true);
      ctx.globalAlpha = 1; hit(x, y + 56, cw, ch + 8, () => tapCard(i));
    }
    // 按钮
    if (S.arena) {
      if (S.refLeft > 0) btn(10, y + 170, 84, 40, `换货 ×${S.refLeft}`, 'sec', () => { L.refresh(); ui.sel = null; sfx.tap(); });
      else btn(10, y + 170, 84, 40, '{play}换货+4', 'ad', () => watchAd(() => { ui.modal = null; L.addRefresh(4); }));
      btn(100, y + 170, 84, 40, '退出擂台', 'sec', leaveArena);
    } else {
      btn(10, y + 170, 84, 40, L.refCost() ? `换货 ¥${L.refCost()}` : '换货 免费', 'sec', () => { if (L.refresh(false) === 'nomoney') { sfx.bad(); toast('钱不够'); } else { ui.sel = null; sfx.tap(); } });
      btn(100, y + 170, 84, 40, '{play}免费换', 'ad', () => watchAd(() => { ui.modal = null; L.refresh(true); ui.sel = null; }));
    }
    if (!ui.tut && L.skipInfo()) { btn(190, y + 170, 56, 40, '跳过', 'sec', skipModal); btn(252, y + 170, 113, 40, '开张营业', 'pri', goNight); }   // 平常夜可以跳过,换一样奖励
    else btn(190, y + 170, 175, 40, '开张营业', 'pri', goNight);
  } else if (S.phase === 'break') drawBreak(y);
  else {
    const left = G.N ? G.N.queue.length + ui.cust.length : 0;
    const wn = G.N && G.N.waves && G.N.waves.length > 1 ? ` · 第 ${G.N.wave + 1}/${G.N.waves.length} 波` + (G.N.waveType !== 'normal' ? ' ' + (L.WAVE_TYPES.find(t => t.k === G.N.waveType) || {}).n : '') : '';
    txt('今晚热度' + wn + (left ? ` · 还有 ${left} 位` : ' · 打烊中…'), 20, y + 28, 12, WARM, 'left', true); txt('' + Math.round(ui.inc), 20, y + 66, 38, GOLD, 'left', true);
    if (G.N) txt(`流水 ¥${G.N.flow} × 人气 ${heatText(G.N)}`, 20, y + 100, 12.5, '#ffb3d9', 'left', true);   // 热度是怎么乘出来的
    // 顾客头顶标记的图例
    const ly = y + 132; let lx = 20;
    ctx.fillStyle = '#7fd6ff'; ctx.beginPath(); ctx.moveTo(lx + 4, ly - 6); ctx.quadraticCurveTo(lx + 9, ly + 1, lx + 4, ly + 4); ctx.quadraticCurveTo(lx - 1, ly + 1, lx + 4, ly - 6); ctx.fill();
    txt('口渴,饮品翻倍', lx + 13, ly, 10.5, WARM); lx += 96;
    txt('♪', lx + 4, ly, 12, '#ffe680', 'center', true); txt('开心,多付四成', lx + 13, ly, 10.5, WARM); lx += 96;
    txt('饱', lx + 5, ly, 10, '#ffb38a', 'center', true); txt('不再买小吃', lx + 14, ly, 10.5, WARM);
    ui.feed.forEach((f, i) => { ctx.globalAlpha = Math.min(1, f.life); txt(f.s, W - 16, y + 28 + i * 22, 12, i ? PAPER : '#ffd98a', 'right', !i); }); ctx.globalAlpha = 1;
    const ev = L.eventInfo(); if (ev) txt(`今晚${ev.n}`, 20, y + 190, 12, '#ffb38a', 'left', true);
    const gi = L.goalInfo(); if (gi) txt(`小目标:${gi.text}(${gi.cur}/${gi.n})` + (gi.done ? ' 达成' : ''), 20, y + 162, 11.5, gi.done ? '#9fe6b8' : WARM, 'left', true);
    if (S.phase === 'night') btn(W - 126, y + 170, 116, 40, ui.speed > 1 ? '正常速度' : '加速 ×2', 'sec', () => { ui.speed = ui.speed > 1 ? 1 : 2; sfx.tap(); });
  }
}

// 中场面板:公布下一波是什么客人,还能调整几次;选中摊位时提示怎么挪
function drawBreak(y) {
  const N = G.N, nw = L.nextWaveInfo(), T = L.target(), sel = ui.sel;
  plate(10, y + 11, W - 20, 43, PAPER, 6, 2);
  if (sel && sel.kind === 'stall') {
    txt(`${DEF[sel.s.id].n} Lv${sel.s.lvl}`, 20, y + 24, 14, RED, 'left', true);
    txt(N.moves > 0 ? '点要去的地块:空地是挪过去,有摊位是对调,同名同级是升级' : '今晚的调整次数用完了,再点一下它取消选中', 20, y + 42, 11, INK);
  } else if (nw) { txt(`第 ${nw.i}/${nw.total} 波要来的是:${nw.n}`, 20, y + 24, 14, RED, 'left', true); txt(wrap(nw.d, 335, 11)[0], 20, y + 42, 11, INK); }
  txt(`中场休息 · 还能调整 ${N.moves} 次`, 20, y + 80, 14, GOLD, 'left', true);
  txt('点一个摊位,再点要去的地块。不调整也可以直接继续', 20, y + 101, 11, WARM);
  txt(`热度 ${N.income}` + (T ? ` / 目标 ${T}` : '') + ` · 流水 ¥${N.flow} × 人气 ${heatText(N)}`, 20, y + 125, 12, '#ffb3d9', 'left', true);
  const gi = L.goalInfo(); if (gi) txt(`小目标:${gi.text}(${gi.cur}/${gi.n})` + (gi.done ? ' 达成' : ''), 20, y + 147, 11.5, gi.done ? '#9fe6b8' : WARM, 'left', true);
  btn(10, y + 170, W - 20, 40, nw ? `继续营业:迎接${nw.n}` : '继续营业', 'pri', () => { L.nextWave(); ui.sel = null; ui.spawn = .3; ui.endT = 0; sfx.open(); });
}
// 跳过今晚:先说清楚代价和换来什么
function skipModal() {
  const sk = L.skipInfo(); if (!sk) return;
  ui.modal = {
    title: '跳过今晚?', small: true, lines: ['今晚不营业:没有收入,不选秘诀,也不算过关', `换来「${sk.n}」:${sk.d}`],
    buttons: [{ label: `跳过,拿「${sk.n}」`, kind: 'pri', fn: () => { const res = L.skipNight(); ui.modal = null; ui.sel = null; sfx.merge(); if (res === 'perk') perkModal(); } }, { label: '还是营业', kind: 'sec', fn: () => { ui.modal = null; } }]
  };
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
  ctx.fillStyle = `rgba(12,7,4,${.72 * m.a})`; ctx.fillRect(0, 0, W, H); ui.hits.length = 0; hit(0, 0, W, H, () => { });
  const w = 319, x = (W - w) / 2, lines = m.small ? m.lines.flatMap(s => wrap(s, w - 48, 12.5)) : m.lines || [];
  const hPerks = (m.perks || []).length * 66, hBtn = m.buttons.length * 54, hGrid = m.grid ? Math.ceil(m.grid.length / 4) * 84 + 2 : 0, rest = 66 + hPerks + hGrid + hBtn + (m.timer != null ? 26 : 8);
  // 小字行距 21;行数太多、纸牌高过屏幕时(小屏上的「怎么玩」)把行距压紧,最紧 16
  const lh = m.small ? (lines.length ? Math.max(16, Math.min(21, (H - 16 - rest) / lines.length)) : 21) : 24;
  const h = rest + lines.length * lh, y = (H - h) / 2, e = 1 - Math.pow(1 - m.a, 3);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(.86 + .14 * e, .86 + .14 * e); ctx.translate(-W / 2, -H / 2); ctx.globalAlpha = m.a;
  // 一张大纸牌,顶上一条色带写标题:达标是金色,没达标是灰褐色,其余是红色
  plate(x, y, w, h, PAPER, 10, 5);
  // 有布横幅的图(ui_ribbon_*)就把横幅压在纸牌顶上,左右各探出 8
  if (!A.nine(ctx, 'ui_ribbon_' + (m.tone === 'ok' ? 'gold' : m.tone === 'bad' ? 'gray' : 'red'), x - 8, y - 6, w + 16, 56, 14)) {
    ctx.save(); A.rr(ctx, x + 1, y + 1, w - 2, h - 2, 9); ctx.clip(); ctx.fillStyle = m.tone === 'ok' ? '#e3a72f' : m.tone === 'bad' ? BROWN : RED; ctx.fillRect(x, y, w, 44); ctx.fillStyle = INK; ctx.fillRect(x, y + 44, w, 2); ctx.restore();
  }
  txt(m.title, W / 2, y + 23, 18, m.tone === 'ok' ? INK : PAPER, 'center', true);
  let cy = y + 70;
  for (const s of lines) { txt(s, m.small ? x + 24 : W / 2, cy, m.small ? 12.5 : 14, INK, m.small ? 'left' : 'center'); cy += lh; }
  if (m.timer != null) { A.rr(ctx, x + 40, cy, w - 80, 8, 4); ctx.fillStyle = PAPER_D; ctx.fill(); A.rr(ctx, x + 40, cy, (w - 80) * (1 - m.timer / 1.6), 8, 4); ctx.fillStyle = GREEN; ctx.fill(); }
  if (m.grid) {   // 图鉴的格子:每格一张摊位图、名字和一句话作用;没解锁的变灰并写还差几晚
    m.grid.forEach((g, i) => {
      const d = DEF[g.id], gx = x + 15 + (i % 4) * 73, gy = cy + Math.floor(i / 4) * 84, locked = g.need > 0, im = A.image('stall_' + g.id);
      plate(gx, gy, 68, 78, locked ? PAPER_D : '#fff5df', 6, 2);
      ctx.fillStyle = d.sup ? BROWN : A.CAT_COLOR[d.cat]; ctx.fillRect(gx + 2, gy + 2, 64, 5);
      ctx.globalAlpha = m.a * (locked ? .35 : 1);
      if (im) { const hh = 40, ww = hh * im.width / im.height; ctx.drawImage(im, gx + 34 - ww / 2, gy + 9, ww, hh); }
      else { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(d.e, gx + 34, gy + 30); }
      ctx.globalAlpha = m.a;
      txt(d.n, gx + 34, gy + 58, 11.5, INK, 'center', true); txt(locked ? `再过 ${g.need} 晚` : d.t, gx + 34, gy + 69, 8.5, locked ? RED : BROWN, 'center');
      hit(gx, gy, 68, 80, () => stallModal(g.id));
    });
    cy += hGrid;
  }
  for (const pk of m.perks || []) {
    const own = pk.icon ? 0 : L.perk(pk.p.k);   // 经营秘诀写「已有几个」;摊主不写
    ctx.globalAlpha = m.a * (pk.locked ? .5 : 1);
    plate(x + 16, cy, w - 32, 56, '#fff5df', 7, 2);
    drawToken(pk.icon || 'perk_' + pk.p.k, x + 44, cy + 28, pk.icon && pk.icon.indexOf('owner_') === 0 ? 48 : 36, INK);   // 摊主头像画大一点,不然看不清脸
    txt(pk.p.n + (pk.p.r ? ' · 稀有' : '') + (own ? `(已有 ${own} 级)` : ''), x + 72, cy + 19, 14, pk.p.r ? '#8a4fd0' : RED, 'left', true); txt(pk.note || pk.p.d, x + 72, cy + 39, 11.5, pk.locked ? BROWN : INK);
    ctx.globalAlpha = m.a;
    hit(x + 16, cy, w - 32, 58, pk.fn); cy += 66;
  }
  cy += 4; for (const b of m.buttons) { btn(x + 20, cy, w - 40, 44, b.label, b.kind, b.fn); cy += 54; }
  ctx.restore();
}
function drawToast() {
  const t = ui.toast; if (!t) return; t.life -= DT; if (t.life <= 0) { ui.toast = null; return; }
  ctx.globalAlpha = Math.min(1, t.life * 3); ctx.font = font(13, true); const w = ctx.measureText(t.t).width + 28;
  plate(W / 2 - w / 2, H * .42, w, 32, PAPER, 6, 2); txt(t.t, W / 2, H * .42 + 16.5, 13, INK, 'center', true); ctx.globalAlpha = 1;
}

// ---------- 新手引导:带着玩家摆出「烤串 → 奶茶 + 灯牌」并打完第一晚 ----------
const cardRect = i => ({ x: 10.5 + i * 90, y: LAY.panelY + 57, w: 84, h: 106 });
const selIs = i => ui.sel && ui.sel.kind === 'shop' && ui.sel.i === i;
const TUT = [
  { any: true, msg: () => ui.pendingRival ? '好友向你下了战书!\n先花一分钟学会摆摊,马上就去应战。' : '欢迎来到夜市!\n顾客会从街口走到街尾,路过靠街的摊位就可能掏钱。' },
  { msg: '先进货。点这张烤串。', rect: () => cardRect(0), done: () => selIs(0) },
  { msg: '摆在靠街的这一格。\n只有靠街的摊位才接客。', cell: [1, 0], rect: () => plot(1, 0), done: () => L.stallAt(1, 0) },
  { msg: '再进一杯奶茶。', rect: () => cardRect(1), done: () => selIs(1) },
  { msg: '摆在烤串的下一格。\n顾客吃完烤串会口渴,奶茶收入翻倍。', cell: [1, 1], rect: () => plot(1, 1), done: () => L.stallAt(1, 1) },
  { msg: '这是灯牌,它不卖东西,\n但能让周围的摊位更吸引人。', rect: () => cardRect(2), done: () => selIs(2) },
  { msg: '支援摊放在里排就行。', cell: [0, 0], rect: () => plot(0, 0), done: () => L.stallAt(0, 0) },
  { msg: '准备好了,开张营业!', rect: () => ({ x: 190, y: LAY.panelY + 170, w: 175, h: 44 }), done: () => G.S.phase !== 'day' },
  { passive: true, msg: '顾客来了!蓝色的「口渴连击」就是烤串配\n奶茶的效果,每次还让人气涨一点。\n热度 = 流水 × 人气,热度达标才过关。', done: () => G.S.phase === 'day' && !ui.modal },
  { any: true, msg: '同名同级的摊位叠在一起会升级。\n摊位的顺序和搭配,就是这门生意的全部学问。祝生意兴隆!' },
];
function startTut() { ui.tut = { step: 0, skip: null }; G.S.shop = ['kebab', 'tea', 'lamp', 'candy'].map(id => ({ id, sold: false })); }
function endTut() { ui.tut = null; ui.combos = []; ui.pats = []; P.store.set('tut', '1'); persist(); }   // combos 置空:引导里摆出来的搭配,引导结束后提示一次
function nextTut() { ui.tut.step++; ui.tut.skip = null; if (ui.tut.step >= TUT.length) endTut(); }
// 引导的指示箭头:金色粗箭头,up 为 true 时朝上指
function pointer(x, y, up) {
  const k = up ? 1 : -1; ctx.beginPath();
  ctx.moveTo(x, y - 13 * k); ctx.lineTo(x + 11, y - 1 * k); ctx.lineTo(x + 4.5, y - 1 * k); ctx.lineTo(x + 4.5, y + 13 * k);
  ctx.lineTo(x - 4.5, y + 13 * k); ctx.lineTo(x - 4.5, y - 1 * k); ctx.lineTo(x - 11, y - 1 * k); ctx.closePath();
  ctx.fillStyle = GOLD; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
}
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
    pointer(r.x + r.w / 2, below ? y1 + 20 + bob : y0 - 20 - bob, below);
    by = below ? y1 + 42 : y0 - 42 - bh;
  } else if (st.passive) by = LAY.panelY - bh - 14;   // 夜晚的提示贴在面板上方,不挡街道
  else { ctx.fillStyle = 'rgba(5,4,12,.68)'; ctx.fillRect(0, 0, W, H); by = H * .36; }
  if (!A.nine(ctx, 'ui_paper', bx, by, bw, bh + 4, 14)) {
    A.rr(ctx, bx, by + 4, bw, bh, 14); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill();
    A.rr(ctx, bx, by, bw, bh, 14); ctx.fillStyle = PAPER; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  }
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
  // 目标是地块时直接落到那一格
  if (st.cell) { tapPlot(st.cell[0], st.cell[1]); return true; }
  return false;
}

// ---------- 主循环 ----------
let last = 0;
// 一帧出错不能让整个游戏停住:记下错误(只报前几次,避免刷屏),下一帧照常继续
let frameErrors = 0;
function frame() {
  try { tick(); } catch (e) { if (frameErrors++ < 5) console.error('[夜市] 这一帧出错了', e); ctx.globalAlpha = 1; }
  requestAnimationFrame(frame);
}
// 推进一帧。dt 只在调试时传入(页面在后台时浏览器不触发动画帧,用它手动推进)
function tick(dt) {
  const now = Date.now(); DT = dt || Math.min(.05, (now - last) / 1000 || 0); last = now; ui.t += DT;
  const S = G.S; layout(); updateNight(DT);
  ui.dark += ((S.phase === 'day' ? .35 : S.phase === 'break' ? .6 : 1) - ui.dark) * Math.min(1, DT * 2.5);
  ui.money += (S.money - ui.money) * Math.min(1, DT * 10); if (Math.abs(S.money - ui.money) < .6) ui.money = S.money;
  if (G.N) { ui.inc += (G.N.income - ui.inc) * Math.min(1, DT * 12); if (Math.abs(G.N.income - ui.inc) < .6) ui.inc = G.N.income; }
  for (const f of ui.feed) f.life -= DT; ui.feed = ui.feed.filter(f => f.life > 0);
  // 好友战书:等回到白天、没有弹窗时再进擂台,不打断正在进行的夜晚
  if (ui.tut) { const st = TUT[ui.tut.step]; if (st.done && st.done()) nextTut(); }
  if ((S.phase === 'day' || S.phase === 'break') && !ui.tut && !ui.peek && !ui.modal && !ui.toast) {   // 白天摆出了新的招牌搭配:提示一次;第一次见到的记进档案
    const prev = ui.combos, next = []; let told = false;   // prev 为空:刚进这一局,已有的搭配只记不提示
    for (const x of L.activeCombos()) {
      const key = x.c.k + ':' + x.a.uid + ':' + x.b.uid, isNew = prev && prev.indexOf(key) < 0;
      if (isNew && told) continue;   // 一次只提示一个,同时凑成的其余几个等这条提示消失后再说
      const fresh = prof.combos.indexOf(x.c.k) < 0; if (fresh) { prof.combos.push(x.c.k); saveProf(); }
      if (isNew) { told = true; toast((fresh ? '发现新搭配' : '搭配达成') + `「${x.c.n}」`, 2.2); sfx.merge(); }
      next.push(key);
    }
    ui.combos = next;
    if (!told) {   // 新凑成(或变长)的街型:同样一次提示一个
      const prevP = ui.pats, nextP = []; let toldP = false;
      for (const p of L.streetPatterns()) {
        const key = p.k + ':' + p.uids.join(',') + ':' + p.heat, isNew = prevP && prevP.indexOf(key) < 0;
        if (isNew && toldP) continue;
        if (isNew) { toldP = true; toast(`凑成街型「${p.n}」,人气 +${p.heat}`, 2); sfx.merge(); }
        nextP.push(key);
      }
      ui.pats = nextP;
    }
  }
  const evKey = S.phase === 'day' && S.event ? S.night + S.event.k : '';   // 新的一晚碰上事件:等弹窗关掉后提示一次
  if (evKey && evKey !== ui.evKey && !ui.modal && !ui.tut && !S.arena) { ui.evKey = evKey; toast(S.event.boss ? `今晚是大考「${L.eventInfo().n}」,看下方说明` : `今晚碰上「${L.eventInfo().n}」,看下方说明`, 2.5); }
  if (ui.pendingRival && S.phase === 'day' && !ui.modal && !ui.tut) { const r = ui.pendingRival; ui.pendingRival = null;
    if (r.day == null) enterArena(r); else if (r.day === today()) startDaily(r); else { startDaily(null); toast('好友的每日挑战已过期,来打今天的'); }
  }
  drawAll(true);
}
function drawAll(overlay) {
  const k = P.dpr * P.scale; ui.hits.length = 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (P.offX) { ctx.fillStyle = '#0a0806'; ctx.fillRect(0, 0, P.canvas.width, P.canvas.height); }   // 宽屏:两侧留边涂黑
  ctx.setTransform(k, 0, 0, k, P.offX * P.dpr, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();                                      // 画面不画到留边上
  drawScene(); drawHUD(); drawPanel(); drawFx(); if (overlay) { drawTut(); drawModal(); drawToast(); }
  ctx.restore();
}
P.onTap((px, py) => {
  if (!ac) ac = P.createAudio(); if (ac && ac.state === 'suspended' && ac.resume) ac.resume();
  const x = (px - P.offX) / P.scale, y = py / P.scale;
  if (tutTap(x, y)) return;
  // 点击区域有两种:普通的矩形;或者带 at 函数的(场景用它把屏幕坐标换算成地块)
  for (let i = ui.hits.length - 1; i >= 0; i--) {
    const h = ui.hits[i], v = h.at ? h.at(x, y) : x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h;
    if (v) { h.fn(v); break; }
  }
  persist();
});
A.setCanvasFactory(P.createCanvas); A.loadImages(P); ui.best = +P.store.get('arenaBest') || 0;
const hadSave = loadRun(); if (!hadSave) L.newGame();
// 上次在「没达标」的结算界面直接退出了:按未达标结算,不能靠退出重打这一晚
const pendingFail = P.store.get('pendingFail');
if (pendingFail) {
  P.store.set('pendingFail', '');
  if (hadSave) { if (L.settle(false, +pendingFail || 0) === 'over') L.newGame(); persist(); toast('上一晚没达标就退出了,已按未达标结算'); }
}
ui.money = G.S.money;
if (!hadSave && P.store.get('tut') !== '1') startTut();   // 第一次玩:走新手引导
P.initShare(() => Object.assign({ title: '夜市一条街:来我的夜市逛逛' }, A.image('share_cover') ? { imageUrl: 'assets/share_cover.jpg' } : {}));   // 有分享封面图就用它,没有时微信自动截当前画面
P.onChallenge(str => { if (str === ui.lastAr) return; ui.lastAr = str; const r = L.decodeArena(str); if (r) ui.pendingRival = r; });
// 调试入口:浏览器里挂在 window 上;自动化测试(模拟微信环境)时挂在全局。正式的微信环境里不暴露
const debugApi = { L, ui, G, P, tapPlot, tapCard, goNight, enterArena, leaveArena, togglePeek, tick, startDaily, challengeModal, codexModal, stallModal, perkModal, prof, today };
if (!P.isWx) window.__game = debugApi; else if (typeof __NM_TEST__ !== 'undefined') globalThis.__game = debugApi;
requestAnimationFrame(frame);
