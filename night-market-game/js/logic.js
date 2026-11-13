// 游戏规则。不依赖任何渲染或平台接口,换引擎时这个文件可以原样带走。
export const COLS = 4, ROWS = 6, MAXN = 10;
export const LV = [1, 2, 4];
// 每晚营业额目标,按自动试玩(随手乱摆、不讲究顺序)的营业额分布定的:
// 前三晚九成能过,给新手留余地;之后逐晚收紧,到第 10 晚乱摆只有四成左右能过,要靠排顺序和搭配
export const TARGET = [25, 50, 100, 260, 620, 1250, 2200, 3400, 5000, 7000];
const INFL = 1.4; // 物价每晚上涨的倍率,防止后期钱花不完

export const DEF = {
  kebab: { n: '烤串', e: '🍢', cat: 'food', cost: 20, p: 6, a: .55, d: '吃完口渴:下一杯饮品收入×2', t: '吃完口渴' },
  tofu: { n: '臭豆腐', e: '🥘', cat: 'food', cost: 15, p: 5, a: .7, d: '很吸客,但周围非小吃摊吸引力-30%', t: '吸客但熏邻摊' },
  rice: { n: '炒饭', e: '🍛', cat: 'food', cost: 30, p: 12, a: .5, d: '单价高,但吃饱后不再买小吃', t: '贵 · 管饱' },
  tea: { n: '奶茶', e: '🧋', cat: 'drink', cost: 20, p: 5, a: .6, d: '饮品。口渴的顾客付双倍', t: '口渴时翻倍' },
  candy: { n: '糖葫芦', e: '🍡', cat: 'sweet', cost: 15, p: 4, a: .65, d: '甜品。便宜好卖', t: '便宜好卖' },
  ice: { n: '冰粉', e: '🍧', cat: 'sweet', cost: 25, p: 3, a: .5, d: '顾客之前每消费1次,售价+3。放街尾', t: '越靠街尾越贵' },
  ring: { n: '套圈', e: '🎯', cat: 'game', cost: 30, p: 4, a: .45, free: 1, d: '不占消费次数。玩后开心:之后消费+40%', t: '玩了开心' },
  phone: { n: '手机壳', e: '📱', cat: 'goods', cost: 35, p: 14, a: .25, d: '单价高但冷门;开心的顾客吸引力翻倍', t: '贵 · 冷门' },
  lamp: { n: '灯牌', e: '🏮', sup: 1, cost: 20, d: '支援:周围摊位吸引力+20%', t: '周围吸引+20%' },
  fridge: { n: '冰柜', e: '🧊', sup: 1, cost: 25, d: '支援:周围饮品、甜品售价+50%', t: '饮品甜品+50%' },
  grill: { n: '炭炉', e: '🔥', sup: 1, cost: 25, d: '支援:周围小吃售价+40%', t: '周围小吃+40%' },
  cat: { n: '招财猫', e: '🐱', sup: 1, cost: 35, d: '支援:周围摊位每卖一单额外+¥2', t: '周围每单+¥2' },
};
export const PERKS = [
  { k: 'more', e: '📸', n: '网红打卡', d: '每晚客流 +4 人' },
  { k: 'big', e: '🍽️', n: '大胃王', d: '每位顾客消费次数上限 +1' },
  { k: 'back', e: '🔄', n: '回头客', d: '25% 的顾客走到街尾后折返再逛一遍' },
  { k: 'price', e: '💹', n: '集体涨价', d: '所有售价 +15%' },
  { k: 'shout', e: '📣', n: '吆喝', d: '所有摊位吸引力 +10%' },
  { k: 'last', e: '🎁', n: '临走再买', d: '每位顾客的最后一单收入翻倍' },
  { k: 'first', e: '🧧', n: '开门红', d: '每位顾客的第一单额外 +¥5' },
  { k: 'rich', e: '🤑', n: '土豪光临', d: '每晚多来 2 位土豪,消费 ×3' },
  { k: 'cheap', e: '🤝', n: '熟人价', d: '进货价 -15%' },
  { k: 'land', e: '📜', n: '地摊执照', d: '立即免费解锁 2 块地' },
  { k: 'tip', e: '💵', n: '小费', d: '每晚结算额外获得营业额的 10%' },
];

// 擂台赛:固定预算和客流,只营业一晚,比营业额。规则对所有人相同,所以成绩可以互相比
export const ARENA = { budget: 400, cust: 20, refresh: 6, rows: 3 };

export const G = { S: null, N: null, main: null, cleared: 0 };   // cleared: 玩家累计过关的晚数(跨局),由界面层从档案里读出来填上 // S: 当前状态;N: 当晚状态;main: 打擂台时暂存的主线状态
let uid = 1;
// 读档
export function restore(d) { G.S = d; G.N = null; for (const s of d.stalls) uid = Math.max(uid, s.uid + 1); }

// 每日挑战:擂台的一个变体。每天一个主题(一组现成的经营秘诀,外加可选的预算和客流),所有人当天进到的货完全相同。
// base 是自动试玩在这个主题下的营业额中位数,奖牌线按它的倍数定
export const DAILY = [
  { k: 'hot', n: '网红之夜', d: '客流多 12 人', perks: { more: 3 }, base: 1330 },
  { k: 'eat', n: '大胃王之夜', d: '每位顾客最多买 5 次', perks: { big: 2 }, base: 950 },
  { k: 'rich', n: '土豪之夜', d: '多来 6 位土豪,消费 ×3', perks: { rich: 3 }, base: 1580 },
  { k: 'back', n: '回头客之夜', d: '75% 的顾客走到街尾会折返再逛一遍', perks: { back: 3 }, base: 920 },
  { k: 'gift', n: '临别大促', d: '每位顾客的最后一单 ×3,第一单额外 +¥10', perks: { last: 2, first: 2 }, base: 1370 },
  { k: 'tight', n: '精打细算', d: '预算只有 ¥250,但进货价打七折', perks: { cheap: 2 }, budget: 250, base: 700 },
  { k: 'gold', n: '黄金地段', d: '所有售价 +45%,但客流只有 12 人', perks: { price: 3 }, cust: 12, base: 700 },
];
export const themeOf = day => DAILY[day % DAILY.length];
// 铜牌随手能拿;银牌约等于自动试玩里排前五分之一的成绩;金牌比自动试玩的最好成绩还高一截,要靠排顺序和搭配
export const medalLines = th => [.75, 1.1, 1.45].map(k => Math.round(th.base * k / 10) * 10);   // 铜、银、金
// 可以固定种子的随机数:每日挑战用它来进货,保证所有人看到的货一样;其他模式没有种子,用普通随机
function rnd() {
  const S = G.S; if (S.seed == null) return Math.random();
  let t = S.seed = (S.seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
// daily: { day, theme },不传就是普通擂台
export function enterArena(rival, daily) {
  if (!G.S.arena) G.main = G.S;
  const S = G.S = { arena: true, rival: rival || null, night: 1, hearts: 3, money: ARENA.budget, stalls: [], shop: [], perks: {}, unlocked: new Set(), unlockN: 0, revived: false, phase: 'day', refLeft: ARENA.refresh };
  for (let r = 0; r < ARENA.rows; r++) for (let c = 0; c < COLS; c++) S.unlocked.add(c + ',' + r);
  if (daily) { const th = daily.theme; Object.assign(S, { daily: th.k, day: daily.day, perks: Object.assign({}, th.perks), money: th.budget || ARENA.budget, custBase: th.cust || ARENA.cust, seed: (daily.day * 1103515245 + 12345) | 0 }); }
  G.N = null; rollShop();
}
export function exitArena() { if (G.main) { G.S = G.main; G.main = null; } G.N = null; }
export const addRefresh = n => { G.S.refLeft += n; };
// 今晚要超过的数字:主线是每晚目标,擂台是擂主成绩(没有擂主时为 0)
// 第 n 晚的目标。前 10 晚用校准过的表;无尽模式里每晚再涨 40%,取整到 50
export const targetOf = n => n <= MAXN ? TARGET[n - 1] : Math.round(TARGET[MAXN - 1] * Math.pow(1.4, n - MAXN) / 50) * 50;
export const target = () => G.S.arena ? (G.S.rival ? G.S.rival.score : 0) : targetOf(G.S.night);
// 战书编码:版本.成绩.摊位列表(每个摊位 4 个字符:种类、等级、列、行),放进分享链接的参数里
const IDS = Object.keys(DEF);
// 每日挑战的战书多带一段日期(版本 2),好友点开进的是同一天的挑战
export function encodeArena(score) { return (G.S.daily ? '2.' + G.S.day + '.' : '1.') + score.toString(36) + '.' + G.S.stalls.map(s => IDS.indexOf(s.id).toString(36) + s.lvl + s.c + s.r).join(''); }
export function decodeArena(str) {
  const p = String(str || '').split('.'); let day = null;
  if (p[0] === '2' && p.length === 4) { day = +p[1]; p.splice(1, 1); if (!(day > 0)) return null; } else if (p[0] !== '1') return null;
  if (p.length !== 3 || p[2].length % 4 || p[2].length > 96) return null;
  const score = parseInt(p[1], 36); if (!(score >= 0)) return null;
  const stalls = [], seen = new Set();
  for (let i = 0; i < p[2].length; i += 4) {
    const id = IDS[parseInt(p[2][i], 36)], lvl = +p[2][i + 1], c = +p[2][i + 2], r = +p[2][i + 3];
    if (!id || !(lvl >= 1 && lvl <= 3) || !(c >= 0 && c < COLS) || !(r >= 0 && r < ROWS) || seen.has(c + ',' + r)) return null;
    seen.add(c + ',' + r); stalls.push({ uid: 100000 + i, id, lvl, c, r });
  }
  return { score, stalls, day };
}

export function newGame() {
  const S = G.S = { night: 1, hearts: 3, money: 60, stalls: [], shop: [], perks: {}, unlocked: new Set(), unlockN: 0, revived: false, phase: 'day' };
  for (let r = 0; r < 2; r++) for (let c = 0; c < COLS; c++) S.unlocked.add(c + ',' + r);
  G.N = null; rollShop();
}
export const perk = k => G.S.perks[k] || 0;
export const isFront = c => c === 1 || c === 2;
export const stallAt = (c, r) => G.S.stalls.find(s => s.c === c && s.r === r);
const infl = () => Math.pow(INFL, G.S.night - 1);
export const costOf = d => Math.ceil(d.cost * infl() * Math.pow(0.85, perk('cheap')));
export const sellVal = s => Math.floor(DEF[s.id].cost * Math.pow(2, s.lvl - 1) / 2);
export const unlockCost = () => Math.ceil((10 + 5 * G.S.unlockN) * infl());
export const refCost = () => Math.ceil(5 * infl());
export const custCount = () => G.S.arena ? (G.S.custBase || ARENA.cust) + 4 * perk('more') : 8 + 2 * G.S.night + 4 * perk('more');
export const capN = () => 3 + perk('big');
// 新摊位随累计过关的晚数逐步解锁,给玩家一个长期目标。擂台里不受限制,保证规则对所有人相同
export const UNLOCKS = [{ id: 'tofu', at: 4 }, { id: 'ice', at: 10 }, { id: 'phone', at: 18 }, { id: 'cat', at: 28 }];
export const isUnlocked = id => { const u = UNLOCKS.find(x => x.id === id); return !u || G.cleared >= u.at; };
// 主线里,每个货位有 35% 的机会刷出「已经摆着的摊位」的同款:想升级的摊位更容易刷到,
// 而且解锁的摊位种类变多以后,凑同款升级不会因此变难。擂台和每日挑战不用这条,保证所有人的货一样
const OWN_BIAS = 0.35;
export function rollShop() {
  const S = G.S, ks = Object.keys(DEF).filter(id => S.arena || isUnlocked(id)), owned = S.arena ? [] : [...new Set(S.stalls.map(s => s.id))];
  S.shop = [0, 1, 2, 3].map(() => ({ id: owned.length && rnd() < OWN_BIAS ? owned[rnd() * owned.length | 0] : ks[rnd() * ks.length | 0], sold: false }));
}
export function canUnlock(c, r) {
  return !G.S.unlocked.has(c + ',' + r) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => G.S.unlocked.has((c + a) + ',' + (r + b)));
}
// 支援范围:同侧周围一圈(含斜向)
export const inRange = (s, c, r) => (s.c < 2) === (c < 2) && Math.abs(c - s.c) <= 1 && Math.abs(r - s.r) <= 1 && !(c === s.c && r === s.r);
export const around = s => G.S.stalls.filter(o => o !== s && inRange(s, o.c, o.r));
export function statOf(s) {
  const d = DEF[s.id]; if (d.sup) return null;
  let aMul = 1 + 0.1 * perk('shout'), pm = 1, flat = 0;
  for (const o of around(s)) {
    if (o.id === 'lamp') aMul += 0.2 * o.lvl;
    if (o.id === 'fridge' && (d.cat === 'drink' || d.cat === 'sweet')) pm += 0.5 * o.lvl;
    if (o.id === 'grill' && d.cat === 'food') pm += 0.4 * o.lvl;
    if (o.id === 'cat') flat += 2 * o.lvl;
    if (o.id === 'tofu' && d.cat !== 'food') aMul -= 0.3;
  }
  pm *= LV[s.lvl - 1] * (1 + 0.15 * perk('price'));
  return { a: Math.max(.05, Math.min(.95, d.a * aMul)), price: d.p * pm, pm, flat };
}

// ---------- 白天操作(返回结果码,由界面决定提示) ----------
export function refresh(free) {
  const S = G.S;
  if (S.arena) { if (S.refLeft <= 0) return 'noref'; S.refLeft--; }   // 擂台里换货不花钱,但次数有限
  else if (!free) { if (S.money < refCost()) return 'nomoney'; S.money -= refCost(); }
  rollShop(); return 'ok';
}
export function unlock(c, r) { const S = G.S; if (!canUnlock(c, r)) return 'far'; if (S.money < unlockCost()) return 'nomoney'; S.money -= unlockCost(); S.unlockN++; S.unlocked.add(c + ',' + r); return 'ok'; }
export function buyPlace(i, c, r) {
  const S = G.S, o = S.shop[i], d = DEF[o.id], at = stallAt(c, r);
  if (o.sold) return 'sold';
  if (at && !(at.id === o.id && at.lvl === 1)) return 'occupied';
  if (S.money < costOf(d)) return 'nomoney';
  S.money -= costOf(d); o.sold = true;
  if (at) { at.lvl = 2; return 'merged'; }
  S.stalls.push({ uid: uid++, id: o.id, lvl: 1, c, r }); return 'placed';
}
export function moveStall(s, c, r) {
  const S = G.S, at = stallAt(c, r);
  if (at && at.id === s.id && at.lvl === s.lvl) { if (at.lvl >= 3) return 'max'; at.lvl++; S.stalls = S.stalls.filter(o => o !== s); return 'merged'; }
  if (at) { at.c = s.c; at.r = s.r; s.c = c; s.r = r; return 'swapped'; }
  s.c = c; s.r = r; return 'moved';
}
export function sell(s) { const S = G.S; S.money += sellVal(s); S.stalls = S.stalls.filter(o => o !== s); }

// ---------- 夜晚结算 ----------
function makeQueue(n, rich) { const q = []; for (let i = 0; i < n; i++) q.push(false); for (let i = 0; i < rich; i++) q.push(true); return q.sort(() => Math.random() - 0.5); }
function calcStats() { const m = new Map(); for (const s of G.S.stalls) if (isFront(s.c) && !DEF[s.id].sup) m.set(s.uid, statOf(s)); return m; }
export function startNight() { G.S.phase = 'night'; return G.N = { queue: makeQueue(custCount(), 2 * perk('rich')), income: 0, encore: false, stats: calcStats() }; }
export function encore() { G.N.encore = true; G.N.queue = makeQueue(6, 0); G.S.phase = 'night'; }
export const newCust = rich => ({ buys: 0, thirsty: false, full: false, happy: false, rich });
function trySell(c, s, onSale) {
  const N = G.N, d = DEF[s.id], st = N.stats.get(s.uid); if (!st) return;
  const cap = capN();
  if (!d.free && c.buys >= cap) return; if (d.cat === 'food' && c.full) return; if (s.id === 'ring' && c.happy) return;
  let a = st.a; if (s.id === 'phone' && c.happy) a = Math.min(.95, a * 2);
  if (Math.random() > a) return;
  const f = { thirsty: false, last: false };
  let amt = st.price + (s.id === 'ice' ? 3 * c.buys * st.pm : 0);
  if (d.cat === 'drink' && c.thirsty) { amt *= 2; c.thirsty = false; f.thirsty = true; }
  if (c.happy) amt *= 1.4;
  if (!d.free && c.buys + 1 >= cap && perk('last')) { amt *= 1 + perk('last'); f.last = true; }
  amt += st.flat; if (!d.free && c.buys === 0) amt += 5 * perk('first');
  if (c.rich) amt *= 3; amt = Math.round(amt);
  if (s.id === 'kebab') c.thirsty = true; if (s.id === 'rice') c.full = true; if (s.id === 'ring') c.happy = true;
  if (!d.free) c.buys++;
  N.income += amt; if (onSale) onSale(c, s, amt, f);
}
export function visit(c, r, onSale) { for (const col of Math.random() < .5 ? [1, 2] : [2, 1]) { const s = stallAt(col, r); if (s) trySell(c, s, onSale); } }
export const wantsBack = c => !c.ret && c.buys < capN() && Math.random() < 0.25 * perk('back');
export function finishNight() {
  const S = G.S, T = target(), inc = G.N.income; S.phase = 'settle';
  return { ok: S.arena ? inc > T : inc >= T, inc, T, tip: Math.round(inc * 0.1 * perk('tip')), encore: G.N.encore };
}
// 进入下一晚的白天。普通模式里第 10 晚没过则重打第 10 晚;无尽模式一直往后
export function nextDay() { const S = G.S; if (S.endless || S.night < MAXN) S.night++; S.phase = 'day'; G.N = null; rollShop(); }
// 返回 'win' | 'perk'(等玩家选完秘诀再进下一晚)| 'over' | 'next'
export function settle(ok, gain) {
  const S = G.S; S.money += gain;
  if (ok) return S.night === MAXN && !S.endless ? 'win' : 'perk';
  S.hearts--; if (S.hearts <= 0) return 'over';
  nextDay(); return 'next';
}
// 通关后继续营业:目标每晚再涨 40%,看能撑到第几晚
export function goEndless() { G.S.endless = true; }
export function revive() { G.S.revived = true; G.S.hearts = 1; nextDay(); }
export const perkChoices = () => [...PERKS].sort(() => Math.random() - 0.5).slice(0, 3);
export function takePerk(p) {
  const S = G.S; S.perks[p.k] = perk(p.k) + 1;
  if (p.k === 'land') { let n = 2; for (let r = 0; r < ROWS && n; r++) for (let c = 0; c < COLS && n; c++) if (canUnlock(c, r)) { S.unlocked.add(c + ',' + r); n--; } }
  nextDay();
}
// 调试用:不播动画,估算当前摆法的平均营业额
export function quickSim(k = 300) {
  const keep = G.N; let sum = 0;
  for (let i = 0; i < k; i++) {
    G.N = { income: 0, stats: calcStats() };
    for (const rich of makeQueue(custCount(), 2 * perk('rich'))) {
      const c = newCust(rich); for (let r = 0; r < ROWS; r++) visit(c, r);
      if (wantsBack(c)) for (let r = ROWS - 1; r >= 0; r--) visit(c, r);
    }
    sum += G.N.income;
  }
  G.N = keep; return Math.round(sum / k);
}
