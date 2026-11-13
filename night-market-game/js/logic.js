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
  // 后加的摊位必须接在最后:战书里按这里的顺序给摊位编号,改顺序会让旧链接认错摊位
  lemon: { n: '柠檬水', e: '🍋', cat: 'drink', cost: 15, p: 3, a: .65, d: '饮品,口渴时同样翻倍。解腻:吃饱的顾客喝完又能吃小吃', t: '解腻' },
  balloon: { n: '气球', e: '🎈', cat: 'game', cost: 25, p: 3, a: .5, free: 1, d: '不占消费次数。拿着气球的顾客,之后路过的摊位吸引力+20%', t: '之后吸引+20%' },
  crayfish: { n: '小龙虾', e: '🦞', cat: 'food', cost: 40, p: 15, a: .35, d: '单价高但冷门。吃完特别口渴:下一杯饮品收入×3', t: '贵 · 饮品×3' },
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
  { k: 'save', e: '🐷', n: '存钱罐', d: '每晚结算时,手上的现金生 10% 的利息' },
  { k: 'tail', e: '🌙', n: '压轴好戏', d: '最后两排(街尾)的摊位售价 +30%' },
  { k: 'supply', e: '📦', n: '老供货商', d: '每晚第一次换货免费' },
  { k: 'queue', e: '👥', n: '排长队', d: '吸引力 60% 以上的摊位售价 +25%' },
  { k: 'set', e: '🍱', n: '尝鲜', d: '顾客头一回买某个品类,这一单 +20%' },
];

// 摊主:主线开局时选一位,整局有效;擂台和每日挑战不算,保证规则对所有人相同。
// need 是解锁条件:stat 是玩家档案里的一项(cleared 累计过关晚数 / best 最远撑过第几晚 / medal 每日挑战拿过的最高奖牌),达到 v 就解锁
export const OWNERS = [
  { k: 'none', e: '🙂', n: '小本经营', d: '没有特别之处,稳扎稳打' },
  { k: 'bbq', e: '🍖', n: '烧烤师傅', d: '自带烤串,小吃 +15%,别的 -15%,起步 ¥30', need: { stat: 'cleared', v: 8, t: '累计过关 8 晚' } },
  { k: 'sweet', e: '🍰', n: '甜品控', d: '饮品甜品 +25%,小吃 -25%', need: { stat: 'cleared', v: 20, t: '累计过关 20 晚' } },
  { k: 'local', e: '🚩', n: '地头蛇', d: '多 4 块地,换货半价,起步 ¥50', need: { stat: 'best', v: MAXN, t: '通关主线一次' } },
  { k: 'rich', e: '💰', n: '富二代', d: '起步 ¥100,但只有 2 颗心', need: { stat: 'medal', v: 2, t: '每日挑战拿到银牌' } },
  { k: 'star', e: '🎥', n: '网红店主', d: '每晚客流 +3,进货价 +15%', need: { stat: 'best', v: 13, t: '无尽模式撑过第 13 晚' } },
  { k: 'calc', e: '🧮', n: '精算师', d: '秘诀四选一,起步 ¥45', need: { stat: 'medal', v: 3, t: '每日挑战拿到金牌' } },
];
const owner = () => G.S.arena ? 'none' : G.S.owner || 'none';
export const ownerOf = () => OWNERS.find(o => o.k === owner());
const START_MONEY = { bbq: 30, local: 50, rich: 100, calc: 45 };

// 每晚小目标:主线从第 2 晚起,每晚给一个可做可不做的目标,做到了结算时多拿一笔钱(当晚目标的三成)。
// n: 要做到的数量;d: 说明;v: 从当晚的统计里读出现在做到了多少
export const GOALS = [
  { k: 'thirst', n: () => 2 + Math.floor(G.S.night / 2), d: n => `口渴连击 ${n} 次`, v: N => N.thirst },
  { k: 'maxed', n: () => 2 + Math.floor(G.S.night / 2), d: n => `让 ${n} 位顾客买满上限`, v: N => N.maxed },
  { k: 'top', n: () => Math.max(10, Math.round(targetOf(G.S.night) * .5 / 5) * 5), d: n => `有一个摊位单独赚到 ¥${n}`, v: N => Math.max(0, ...Object.values(N.earn)) },
  { k: 'over', n: () => Math.round(targetOf(G.S.night) * 1.5 / 5) * 5, d: n => `营业额冲到 ¥${n}`, v: N => N.income },
  { k: 'cats', n: () => G.S.night < 5 ? 3 : 4, d: n => `卖出 ${n} 个不同品类`, v: N => Object.keys(N.catSet).length },
];
const GOAL_REWARD = 0.3;
function rollGoal() {
  const S = G.S; if (S.arena || S.night < 2) { S.goal = null; return; }
  const last = S.goal && S.goal.k, pool = GOALS.filter(g => g.k !== last), g = pool[Math.random() * pool.length | 0];
  S.goal = { k: g.k, n: g.n(), reward: Math.max(10, Math.round(targetOf(S.night) * GOAL_REWARD / 5) * 5) };
}
// 当前小目标的说明和进度,没有时返回 null
export function goalInfo() {
  const g = G.S.goal, def = g && GOALS.find(x => x.k === g.k); if (!def || G.S.arena) return null;
  const cur = G.N && G.N.earn ? Math.round(def.v(G.N)) : 0;
  return { text: def.d(g.n), cur: Math.min(cur, g.n), n: g.n, reward: g.reward, done: cur >= g.n };
}
const counters = () => ({ thirst: 0, maxed: 0, earn: {}, catSet: {} });   // 当晚的统计,小目标用

// 夜市事件:主线从第 2 晚起,每晚有六成机会碰上一件事,改变当晚的规则。事件公开显示在白天,玩家可以先挪摊位再开张。
// cust: 客流倍数;cap: 每人消费次数的增减;其余效果在 statOf 里按 k 处理
export const EVENTS = [
  { k: 'rain', n: '下小雨', d: '客流少四分之一,但小吃售价 +50%', cust: .75 },
  { k: 'hot', n: '闷热夜', d: '饮品、甜品售价 +50%,小吃吸引力 -20%' },
  { k: 'fair', n: '庙会', d: '客流多四成,但每人少买一次', cust: 1.4, cap: -1 },
  { k: 'payday', n: '发工资', d: '每位顾客多买一次', cap: 1 },
  { k: 'blogger', n: '美食博主探店', d: c => `${CAT_N[c]}售价 +80%` },
  { k: 'late', n: '夜宵潮', d: '街尾三排售价 +40%,街口三排 -20%' },
  // 下面三种改变的是「来的是什么客人」,效果在 newCust 和 trySell 里
  { k: 'kids', n: '亲子夜', d: '四成顾客是小孩,只买甜品和玩具,但爱掏钱' },
  { k: 'couple', n: '情侣夜', d: '一半顾客是情侣,每单付两份,最多买两次' },
  { k: 'worker', n: '加班夜', d: '顾客一来就口渴,第一杯饮品收入翻倍' },
];

// 招牌搭配:街同一侧、上下紧挨着的两个靠街摊位凑成特定组合时触发,加成直接算进售价和吸引力,白天在名牌上就能看到。
// a、b: 两边各自可以是哪些摊位;order 为 true 时 a 必须在靠街口的一边(顾客先路过 a);
// fa、fb: 给 a、b 的加成,p 是售价、a 是吸引力,都是增加的比例
export const COMBOS = [
  { k: 'bbqtea', n: '撸串配饮料', a: ['kebab'], b: ['tea', 'lemon'], order: true, fb: { a: .25 }, d: '烤串后面紧挨着饮品:饮品吸引力 +25%' },
  { k: 'meal', n: '管饱套餐', a: ['kebab'], b: ['rice'], order: true, fb: { a: .25 }, d: '烤串后面紧挨着炒饭:炒饭吸引力 +25%' },
  { k: 'dessert', n: '饭后甜点', a: ['rice'], b: ['candy', 'ice'], order: true, fb: { p: .3 }, d: '炒饭后面紧挨着甜品:甜品售价 +30%' },
  { k: 'sweet', n: '甜蜜蜜', a: ['candy'], b: ['ice'], fa: { p: .3 }, fb: { p: .3 }, d: '糖葫芦挨着冰粉:两个都售价 +30%' },
  { k: 'trend', n: '潮人街', a: ['phone'], b: ['ring', 'balloon'], fa: { a: .5 }, d: '手机壳挨着套圈或气球:手机壳吸引力 +50%' },
  { k: 'stink', n: '重口味', a: ['tofu'], b: ['crayfish'], fa: { p: .25 }, fb: { p: .25 }, d: '臭豆腐挨着小龙虾:两个都售价 +25%' },
  { k: 'drinks', n: '饮品站', a: ['tea'], b: ['lemon'], fa: { p: .25 }, fb: { p: .25 }, d: '奶茶挨着柠檬水:两个都售价 +25%' },
  { k: 'relief', n: '解腻套餐', a: ['rice'], b: ['lemon'], order: true, fb: { p: 1 }, d: '炒饭后面紧挨着柠檬水:柠檬水售价翻倍' },
  { k: 'play', n: '游乐角', a: ['ring'], b: ['balloon'], fa: { a: .25 }, fb: { a: .25 }, d: '套圈挨着气球:两个都吸引力 +25%' },
  { k: 'icefire', n: '冰火两重天', a: ['crayfish'], b: ['ice'], fa: { p: .3 }, fb: { p: .3 }, d: '小龙虾挨着冰粉:两个都售价 +30%' },
];
// up 在靠街口的一边、down 紧跟其后:返回这一对凑成的搭配,每项是 { c: 搭配, a, b }
function pairCombos(up, down) {
  const out = [];
  for (const c of COMBOS) {
    if (c.a.indexOf(up.id) >= 0 && c.b.indexOf(down.id) >= 0) out.push({ c, a: up, b: down });
    else if (!c.order && c.b.indexOf(up.id) >= 0 && c.a.indexOf(down.id) >= 0) out.push({ c, a: down, b: up });
  }
  return out;
}
const frontAt = (c, r) => { const s = stallAt(c, r); return s && !DEF[s.id].sup ? s : null; };
// 场上现在生效的所有搭配
export function activeCombos() {
  const out = [];
  for (const s of G.S.stalls) { if (!isFront(s.c) || DEF[s.id].sup) continue; const t = frontAt(s.c, s.r + 1); if (t) out.push(...pairCombos(s, t)); }
  return out;
}
// 某个摊位参与的搭配(和上家、下家各看一次)
function combosAt(s) {
  if (!isFront(s.c)) return [];
  const up = frontAt(s.c, s.r - 1), down = frontAt(s.c, s.r + 1);
  return (up ? pairCombos(up, s) : []).concat(down ? pairCombos(s, down) : []);
}
const CAT_N = { food: '小吃', drink: '饮品', sweet: '甜品', game: '玩具', goods: '杂货' };
const EVENT_CHANCE = 0.6;
export const eventOf = () => { const e = G.S.event; return e ? EVENTS.find(x => x.k === e.k) : null; };
// 当前事件的名字和说明,没有事件时返回 null
export function eventInfo() { const ev = eventOf(); if (!ev) return null; return { n: ev.n, d: typeof ev.d === 'function' ? ev.d(G.S.event.cat) : ev.d }; }
function rollEvent() {
  const S = G.S; if (S.arena || S.night < 2 || Math.random() > EVENT_CHANCE) { S.event = null; return; }
  const last = S.event && S.event.k, pool = EVENTS.filter(e => e.k !== last), ev = pool[Math.random() * pool.length | 0];
  const cats = [...new Set(S.stalls.filter(s => !DEF[s.id].sup).map(s => DEF[s.id].cat))];   // 博主专挑玩家已经有的品类
  S.event = { k: ev.k }; if (ev.k === 'blogger') S.event.cat = cats.length ? cats[Math.random() * cats.length | 0] : 'food';
}

// 擂台赛:固定预算和客流,只营业一晚,比营业额。规则对所有人相同,所以成绩可以互相比
export const ARENA = { budget: 400, cust: 20, refresh: 6, rows: 3 };

export const G = { S: null, N: null, main: null, cleared: 0 };   // cleared: 玩家累计过关的晚数(跨局),由界面层从档案里读出来填上 // S: 当前状态;N: 当晚状态;main: 打擂台时暂存的主线状态
let uid = 1;
// 读档
export function restore(d) { G.S = d; G.N = null; for (const s of d.stalls) uid = Math.max(uid, s.uid + 1); }

// 每日挑战:擂台的一个变体。每天一个主题(一组现成的经营秘诀,外加可选的预算和客流),所有人当天进到的货完全相同。
// base 是自动试玩在这个主题下的营业额中位数,奖牌线按它的倍数定
export const DAILY = [
  { k: 'hot', n: '网红之夜', d: '客流多 12 人', perks: { more: 3 }, base: 1300 },
  { k: 'eat', n: '大胃王之夜', d: '每位顾客最多买 5 次', perks: { big: 2 }, base: 960 },
  { k: 'rich', n: '土豪之夜', d: '多来 6 位土豪,消费 ×3', perks: { rich: 3 }, base: 1550 },
  { k: 'back', n: '回头客之夜', d: '75% 的顾客走到街尾会折返再逛一遍', perks: { back: 3 }, base: 880 },
  { k: 'gift', n: '临别大促', d: '每位顾客的最后一单 ×3,第一单额外 +¥10', perks: { last: 2, first: 2 }, base: 1380 },
  { k: 'tight', n: '精打细算', d: '预算只有 ¥250,但进货价打七折', perks: { cheap: 2 }, budget: 250, base: 710 },
  { k: 'gold', n: '黄金地段', d: '所有售价 +45%,但客流只有 12 人', perks: { price: 3 }, cust: 12, base: 700 },
  { k: 'rain', n: '雨夜', d: '客流少四分之一,小吃售价 +50%', perks: {}, event: { k: 'rain' }, base: 750 },
  { k: 'fair', n: '庙会', d: '客流多四成,但每人少买一次', perks: {}, event: { k: 'fair' }, base: 860 },
  { k: 'blog', n: '博主探店', d: '甜品售价 +80%', perks: {}, event: { k: 'blogger', cat: 'sweet' }, base: 900 },
  { k: 'kids', n: '亲子夜', d: '四成顾客是小孩,只买甜品和玩具,但爱掏钱', perks: {}, event: { k: 'kids' }, base: 610 },
  { k: 'couple', n: '情侣夜', d: '一半顾客是情侣,每单付两份,最多买两次', perks: {}, event: { k: 'couple' }, base: 1030 },
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
  if (daily) { const th = daily.theme; Object.assign(S, { daily: th.k, day: daily.day, perks: Object.assign({}, th.perks), money: th.budget || ARENA.budget, custBase: th.cust || ARENA.cust, event: th.event || null, seed: (daily.day * 1103515245 + 12345) | 0 }); }
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

export function newGame(who) {
  const k = OWNERS.some(o => o.k === who) ? who : 'none';
  const S = G.S = { owner: k, night: 1, hearts: k === 'rich' ? 2 : 3, money: START_MONEY[k] || 60, stalls: [], shop: [], perks: {}, unlocked: new Set(), unlockN: 0, revived: false, phase: 'day' };
  for (let r = 0; r < (k === 'local' ? 3 : 2); r++) for (let c = 0; c < COLS; c++) S.unlocked.add(c + ',' + r);
  if (k === 'bbq') S.stalls.push({ uid: uid++, id: 'kebab', lvl: 1, c: 1, r: 0 });
  G.N = null; rollShop();
}
export const maxHearts = () => owner() === 'rich' ? 2 : 3;
export const perk = k => G.S.perks[k] || 0;
export const isFront = c => c === 1 || c === 2;
export const stallAt = (c, r) => G.S.stalls.find(s => s.c === c && s.r === r);
const infl = () => Math.pow(INFL, G.S.night - 1);
export const costOf = d => Math.ceil(d.cost * infl() * Math.pow(0.85, perk('cheap')) * (owner() === 'star' ? 1.15 : 1));
export const sellVal = s => Math.floor(DEF[s.id].cost * Math.pow(2, s.lvl - 1) / 2);
export const unlockCost = () => Math.ceil((10 + 5 * G.S.unlockN) * infl());
export const refCost = () => G.S.freeRef > 0 && !G.S.arena ? 0 : Math.ceil(5 * infl() * (owner() === 'local' ? .5 : 1));   // 老供货商:每晚头一次换货免费
export const custCount = () => { const ev = eventOf(); return Math.round(((G.S.arena ? (G.S.custBase || ARENA.cust) : 8 + 2 * G.S.night + (owner() === 'star' ? 3 : 0)) + 4 * perk('more')) * (ev && ev.cust || 1)); };
export const capN = () => { const ev = eventOf(); return Math.max(1, 3 + perk('big') + (ev && ev.cap || 0)); };
// 新摊位随累计过关的晚数逐步解锁,给玩家一个长期目标。擂台里不受限制,保证规则对所有人相同
export const UNLOCKS = [{ id: 'tofu', at: 4 }, { id: 'ice', at: 10 }, { id: 'phone', at: 18 }, { id: 'cat', at: 28 }, { id: 'lemon', at: 36 }, { id: 'balloon', at: 45 }, { id: 'crayfish', at: 55 }];
// 每日挑战连续打满若干天,额外奖励解锁进度。30 天以后每满 30 天再给一次
export const STREAK = [[3, 2], [7, 3], [14, 5], [30, 8]];
export const streakBonus = n => n > 30 ? (n % 30 ? 0 : 8) : (STREAK.find(x => x[0] === n) || [0, 0])[1];
export const nextStreak = n => n >= 30 ? [Math.ceil((n + 1) / 30) * 30, 8] : STREAK.find(x => x[0] > n);
export const isUnlocked = id => { const u = UNLOCKS.find(x => x.id === id); return !u || G.cleared >= u.at; };
// 主线里,每个货位有 35% 的机会刷出「已经摆着的摊位」的同款:想升级的摊位更容易刷到,
// 而且解锁的摊位种类变多以后,凑同款升级不会因此变难。擂台和每日挑战不用这条,保证所有人的货一样
// 解锁的种类每多一种,这个机会再加 2.5%,否则老玩家货太杂、凑不齐同款,反而比新手难
const OWN_BIAS = 0.35, OWN_BIAS_STEP = 0.025;
export function rollShop() {
  const S = G.S, ks = Object.keys(DEF).filter(id => S.arena || isUnlocked(id)), owned = S.arena ? [] : [...new Set(S.stalls.map(s => s.id))];
  const bias = OWN_BIAS + OWN_BIAS_STEP * Math.max(0, ks.length - 8);
  S.shop = [0, 1, 2, 3].map(() => ({ id: owned.length && rnd() < bias ? owned[rnd() * owned.length | 0] : ks[rnd() * ks.length | 0], sold: false }));
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
  if (s.r >= ROWS - 2) pm *= 1 + 0.3 * perk('tail');
  const seen = {};   // 招牌搭配:同一种搭配对一个摊位只算一次
  for (const x of combosAt(s)) { if (seen[x.c.k]) continue; seen[x.c.k] = 1; const fx = x.a === s ? x.c.fa : x.c.fb; if (fx) { aMul += fx.a || 0; pm *= 1 + (fx.p || 0); } }
  const ow = owner();   // 摊主
  if (ow === 'bbq') pm *= d.cat === 'food' ? 1.15 : .85;
  if (ow === 'sweet') pm *= d.cat === 'drink' || d.cat === 'sweet' ? 1.25 : d.cat === 'food' ? .75 : 1;
  const ev = G.S.event;   // 夜市事件
  if (ev) {
    if (ev.k === 'rain' && d.cat === 'food') pm *= 1.5;
    if (ev.k === 'hot') { if (d.cat === 'drink' || d.cat === 'sweet') pm *= 1.5; if (d.cat === 'food') aMul *= .8; }
    if (ev.k === 'blogger' && d.cat === ev.cat) pm *= 1.8;
    if (ev.k === 'late') pm *= s.r >= ROWS / 2 ? 1.4 : .8;
  }
  const a = Math.max(.05, Math.min(.95, d.a * aMul));
  if (a >= .6) pm *= 1 + 0.25 * perk('queue');
  return { a, price: d.p * pm, pm, flat };
}

// ---------- 白天操作(返回结果码,由界面决定提示) ----------
export function refresh(free) {
  const S = G.S;
  if (S.arena) { if (S.refLeft <= 0) return 'noref'; S.refLeft--; }   // 擂台里换货不花钱,但次数有限
  else if (!free) { if (S.money < refCost()) return 'nomoney'; if (S.freeRef > 0) S.freeRef--; else S.money -= refCost(); }
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
export function startNight() { G.S.phase = 'night'; return G.N = Object.assign({ queue: makeQueue(custCount(), 2 * perk('rich')), income: 0, encore: false, stats: calcStats() }, counters()); }
export function encore() { G.N.encore = true; G.N.queue = makeQueue(6, 0); G.S.phase = 'night'; }
// thirsty:下一杯饮品的倍数,0 是不渴。kid(小孩)、couple(情侣)由当晚的事件带来,土豪不会是这两种
export const newCust = rich => {
  const ev = G.S.event && G.S.event.k, r = Math.random();
  return { buys: 0, thirsty: ev === 'worker' ? 2 : 0, full: false, happy: false, balloon: false, cats: [], rich, kid: !rich && ev === 'kids' && r < .4, couple: !rich && ev === 'couple' && r < .5 };
};
const capOf = c => c.couple ? Math.min(2, capN()) : capN();   // 这位顾客最多买几次
function trySell(c, s, onSale) {
  const N = G.N, d = DEF[s.id], st = N.stats.get(s.uid); if (!st) return;
  const cap = capOf(c);
  if (c.kid && d.cat !== 'sweet' && d.cat !== 'game') return;
  if (!d.free && c.buys >= cap) return; if (d.cat === 'food' && c.full) return; if (s.id === 'ring' && c.happy) return; if (s.id === 'balloon' && c.balloon) return;
  let a = st.a; if (s.id === 'phone' && c.happy) a *= 2; if (c.balloon) a *= 1.2; if (c.kid) a *= 2; a = Math.min(.95, a);
  if (Math.random() > a) return;
  const f = { thirsty: 0, last: false };
  let amt = st.price + (s.id === 'ice' ? 3 * c.buys * st.pm : 0);
  if (d.cat === 'drink' && c.thirsty) { amt *= c.thirsty; f.thirsty = c.thirsty; c.thirsty = 0; }
  if (c.happy) amt *= 1.4;
  if (!d.free && c.buys + 1 >= cap && perk('last')) { amt *= 1 + perk('last'); f.last = true; }
  amt += st.flat; if (!d.free && c.buys === 0) amt += 5 * perk('first');
  if (c.cats.indexOf(d.cat) < 0) { amt *= 1 + 0.2 * perk('set'); c.cats.push(d.cat); }
  if (c.couple) amt *= 2; if (c.rich) amt *= 3; amt = Math.round(amt);
  if (s.id === 'kebab') c.thirsty = Math.max(c.thirsty, 2); if (s.id === 'crayfish') c.thirsty = 3; if (s.id === 'rice') c.full = true; if (s.id === 'ring') c.happy = true;
  if (s.id === 'lemon') c.full = false; if (s.id === 'balloon') c.balloon = true;
  if (!d.free) { c.buys++; if (c.buys === cap) N.maxed++; }
  if (f.thirsty) N.thirst++; N.catSet[d.cat] = 1; N.earn[s.uid] = (N.earn[s.uid] || 0) + amt;
  N.income += amt; if (onSale) onSale(c, s, amt, f);
}
export function visit(c, r, onSale) { for (const col of Math.random() < .5 ? [1, 2] : [2, 1]) { const s = stallAt(col, r); if (s) trySell(c, s, onSale); } }
export const wantsBack = c => !c.ret && c.buys < capOf(c) && Math.random() < 0.25 * perk('back');
export function finishNight() {
  const S = G.S, T = target(), inc = G.N.income; S.phase = 'settle';
  return { ok: S.arena ? inc > T : inc >= T, inc, T, tip: Math.round(inc * 0.1 * perk('tip')), interest: Math.round(S.money * 0.1 * perk('save')), goal: (gi => gi && gi.done ? gi.reward : 0)(goalInfo()), encore: G.N.encore };
}
// 进入下一晚的白天。普通模式里第 10 晚没过则重打第 10 晚;无尽模式一直往后
export function nextDay() { const S = G.S; if (S.endless || S.night < MAXN) S.night++; S.phase = 'day'; S.freeRef = perk('supply'); G.N = null; rollEvent(); rollGoal(); rollShop(); }
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
export const perkChoices = () => [...PERKS].sort(() => Math.random() - 0.5).slice(0, owner() === 'calc' ? 4 : 3);
export function takePerk(p) {
  const S = G.S; S.perks[p.k] = perk(p.k) + 1;
  if (p.k === 'land') { let n = 2; for (let r = 0; r < ROWS && n; r++) for (let c = 0; c < COLS && n; c++) if (canUnlock(c, r)) { S.unlocked.add(c + ',' + r); n--; } }
  nextDay();
}
// 调试用:不播动画,估算当前摆法的平均营业额
export function quickSim(k = 300) {
  const keep = G.N; let sum = 0;
  for (let i = 0; i < k; i++) {
    G.N = Object.assign({ income: 0, stats: calcStats() }, counters());
    for (const rich of makeQueue(custCount(), 2 * perk('rich'))) {
      const c = newCust(rich); for (let r = 0; r < ROWS; r++) visit(c, r);
      if (wantsBack(c)) for (let r = ROWS - 1; r >= 0; r--) visit(c, r);
    }
    sum += G.N.income;
  }
  G.N = keep; return Math.round(sum / k);
}
