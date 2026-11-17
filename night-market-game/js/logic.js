// 游戏规则。不依赖任何渲染或平台接口,换引擎时这个文件可以原样带走。
export const COLS = 4, ROWS = 6, MAXN = 10;
export const LV = [1, 2, 4];
// 每晚的热度目标(热度 = 流水 × 人气),按自动试玩(随手乱摆、不讲究顺序)的热度分布定的:
// 取的是自动试玩热度分布里偏低的一档(大约第 15 百分位;第 10 晚取第 25 百分位),所以乱摆也有八成多能过前九晚、七成多能过第 10 晚。
// 第 3、6、9、10 晚是大考,有额外的限制,所以这几晚的目标涨得慢。热度是乘出来的,好坏局差距很大,真人认真摆会远高于目标
export const TARGET = [25, 75, 150, 450, 1600, 3800, 10000, 13000, 15000, 22000];
const INFL = 1.4; // 物价每晚上涨的倍率,防止后期钱花不完

// s3: 升到 3 级后多出来的「招牌技」(只有售卖摊有),效果在 trySell 和 statOf 里按摊位写
export const DEF = {
  kebab: { n: '烤串', e: '🍢', cat: 'food', cost: 20, p: 6, a: .55, d: '吃完口渴:下一杯饮品收入×2', t: '吃完口渴', s3: '口渴倍数升到 ×2.5' },
  tofu: { n: '臭豆腐', e: '🥘', cat: 'food', cost: 15, p: 5, a: .7, d: '很吸客,但周围非小吃摊吸引力-30%', t: '吸客但熏邻摊', s3: '不再熏邻摊' },
  rice: { n: '炒饭', e: '🍛', cat: 'food', cost: 30, p: 12, a: .5, d: '单价高,但吃饱后不再买小吃', t: '贵 · 管饱', s3: '顾客吃了不会饱' },
  tea: { n: '奶茶', e: '🧋', cat: 'drink', cost: 20, p: 5, a: .6, d: '饮品。口渴的顾客付双倍', t: '口渴时翻倍', s3: '不渴的顾客也多付两成' },
  candy: { n: '糖葫芦', e: '🍡', cat: 'sweet', cost: 15, p: 4, a: .65, d: '甜品。便宜好卖', t: '便宜好卖', s3: '吸引力再 +20%' },
  ice: { n: '冰粉', e: '🍧', cat: 'sweet', cost: 25, p: 3, a: .5, d: '顾客之前每消费1次,售价+3。放街尾', t: '越靠街尾越贵', s3: '每次加价从 +3 升到 +4' },
  ring: { n: '套圈', e: '🎯', cat: 'game', cost: 30, p: 4, a: .45, free: 1, d: '不占消费次数。玩后开心:之后消费+40%', t: '玩了开心', s3: '开心加成升到 +50%' },
  phone: { n: '手机壳', e: '📱', cat: 'goods', cost: 35, p: 14, a: .25, d: '单价高但冷门;开心的顾客吸引力翻倍', t: '贵 · 冷门', s3: '开心的顾客几乎必买' },
  lamp: { n: '灯牌', e: '🏮', sup: 1, cost: 20, d: '支援:周围摊位吸引力+20%', t: '周围吸引+20%' },
  fridge: { n: '冰柜', e: '🧊', sup: 1, cost: 25, d: '支援:周围饮品、甜品售价+50%', t: '饮品甜品+50%' },
  grill: { n: '炭炉', e: '🔥', sup: 1, cost: 25, d: '支援:周围小吃售价+40%', t: '周围小吃+40%' },
  cat: { n: '招财猫', e: '🐱', sup: 1, cost: 35, d: '支援:周围摊位每卖一单额外+¥2', t: '周围每单+¥2' },
  // 后加的摊位必须接在最后:战书里按这里的顺序给摊位编号,改顺序会让旧链接认错摊位
  lemon: { n: '柠檬水', e: '🍋', cat: 'drink', cost: 15, p: 3, a: .65, d: '饮品,口渴时同样翻倍。解腻:吃饱的顾客喝完又能吃小吃', t: '解腻', s3: '口渴的顾客倍数再 +1' },
  balloon: { n: '气球', e: '🎈', cat: 'game', cost: 25, p: 3, a: .5, free: 1, d: '不占消费次数。拿着气球的顾客,之后路过的摊位吸引力+20%', t: '之后吸引+20%', s3: '吸引力加成升到 +35%' },
  crayfish: { n: '小龙虾', e: '🦞', cat: 'food', cost: 40, p: 15, a: .35, d: '单价高但冷门。吃完特别口渴:下一杯饮品收入×3', t: '贵 · 饮品×3', s3: '口渴倍数升到 ×3.5' },
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
  { k: 'land', e: '📜', n: '地摊执照', d: '立即免费解锁 2 块地', once: 1 },
  { k: 'tip', e: '💵', n: '小费', d: '每晚结算额外获得流水的 10%' },
  { k: 'save', e: '🐷', n: '存钱罐', d: '利息的上限翻倍' },
  { k: 'tail', e: '🌙', n: '压轴好戏', d: '最后两排(街尾)的摊位售价 +30%' },
  { k: 'supply', e: '📦', n: '老供货商', d: '每晚第一次换货免费' },
  { k: 'queue', e: '👥', n: '排长队', d: '吸引力 60% 以上的摊位售价 +25%' },
  { k: 'set', e: '🍱', n: '尝鲜', d: '顾客头一回买某个品类,这一单 +20%' },
  // ---- 「人气」类:不加流水,加倍率 ----
  { k: 'warm', e: '🚪', n: '开门迎客', d: '每晚开张时人气多 +0.3' },
  { k: 'word', e: '💬', n: '口口相传', d: '顾客买满时,人气多涨 0.1' },
  { k: 'cool', e: '🥤', n: '解渴名店', d: '口渴连击时,人气多涨 0.1' },
  { k: 'pair', e: '🧩', n: '好搭档', d: '每组招牌搭配,开张时人气多 +0.2' },
  // ---- 稀有(r: 1):把人气再乘一次。只有一级,不能叠 ----
  { k: 'xcombo', e: '⛓️', n: '连锁招牌', r: 1, d: '每组生效的招牌搭配,人气 ×1.2' },
  { k: 'xfew', e: '💎', n: '小而精', r: 1, d: '靠街摊位不超过 6 个时,人气 ×1.8' },
  { k: 'xfull', e: '🎪', n: '一条龙', r: 1, d: '靠街 12 个位置全摆满时,人气 ×1.6' },
  { k: 'xtop', e: '👑', n: '老字号', r: 1, d: '每个 3 级的靠街摊位,人气 ×1.15' },
  { k: 'xmono', e: '🏷️', n: '专卖街', r: 1, d: '靠街摊位不超过 2 个品类时,人气 ×1.6' },
];
// 秘诀最多带 PERK_SLOTS 种,同一种最多叠到 PERK_MAX 级(稀有的只有 1 级)。once 的秘诀(地摊执照)当场生效,不占栏位
export const PERK_SLOTS = 5, PERK_MAX = 3, RARE_CHANCE = 0.25;
const perkDef = k => PERKS.find(p => p.k === k) || {};
export const perkMax = p => p.r ? 1 : PERK_MAX;
export const ownedPerks = () => PERKS.filter(p => !p.once && (G.S.perks[p.k] || 0) > 0);
export const perkSlots = () => ownedPerks().length;
export const perkCap = () => PERK_SLOTS - (G.S && !G.S.arena && (G.S.stake || 1) >= 8 ? 1 : 0);   // 这一局最多带几种

// 流水、人气、热度:流水是当晚实收的钱,收摊后进口袋;人气是倍数,每晚从 1 起步,下面这些事会让它涨;
// 热度 = 流水 × 人气(× 稀有秘诀的倍数),每晚的目标考核的是热度。代码里 N.flow 是流水,N.income 是热度
export const HEAT = { combo: 0.2, thirst: 0.1, maxed: 0.1 };   // 开张时每组招牌搭配 / 每次口渴连击 / 每位买满的顾客

// 成就:达成一次就永久记在档案里,奖励 r 点解锁进度。t(x) 判断是否达成,x 是界面层在结算时拍的一张快照:
// inc 当晚热度 / thirst 当晚口渴连击次数 / lvl3 场上有没有 3 级摊 / combos 场上生效的搭配数 / found 发现过的搭配种数
// win 这一晚是否刚通关 / full 通关时是否一颗心没丢 / best 最远撑过第几晚 / wonWith 用过几位不同的摊主通关 / medal 拿过的最高奖牌 / streak 每日挑战连续天数
export const ACHS = [
  { k: 'inc1', n: '小有所成', d: '一晚热度达到 500', r: 1, t: x => x.inc >= 500 },
  { k: 'inc2', n: '日进斗金', d: '一晚热度达到 5000', r: 2, t: x => x.inc >= 5000 },
  { k: 'inc3', n: '夜市神话', d: '一晚热度达到 50000', r: 3, t: x => x.inc >= 50000 },
  { k: 'thirst', n: '解渴专家', d: '一晚口渴连击 10 次', r: 1, t: x => x.thirst >= 10 },
  { k: 'lvl3', n: '金字招牌', d: '把一个摊位升到 3 级', r: 1, t: x => x.lvl3 },
  { k: 'combo3', n: '搭配大师', d: '同时摆出 3 组招牌搭配', r: 2, t: x => x.combos >= 3 },
  { k: 'found5', n: '见多识广', d: '发现 5 种招牌搭配', r: 2, t: x => x.found >= 5 },
  { k: 'found10', n: '夜市百科', d: '发现全部 10 种招牌搭配', r: 3, t: x => x.found >= 10 },
  { k: 'win', n: '夜市之王', d: '通关主线', r: 2, t: x => x.win },
  { k: 'flawless', n: '一颗心都没丢', d: '通关主线时没有丢过心', r: 3, t: x => x.win && x.full },
  { k: 'end15', n: '不夜城', d: '无尽模式撑过第 15 晚', r: 3, t: x => x.best >= 15 },
  { k: 'owners3', n: '换个活法', d: '用 3 位不同的摊主通关', r: 3, t: x => x.wonWith >= 3 },
  { k: 'gold', n: '金牌摊主', d: '每日挑战拿到金牌', r: 2, t: x => x.medal >= 3 },
  { k: 'streak7', n: '风雨无阻', d: '每日挑战连续 7 天', r: 2, t: x => x.streak >= 7 },
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

// 难度:开局时选,通关一档解锁下一档。每一档在前面所有档的基础上再加一条。擂台和每日挑战不算
export const STAKES = [
  { n: '普通', d: '没有额外限制' },
  { n: '难度 2', d: '每晚目标 +15%' },
  { n: '难度 3', d: '换货价格翻倍' },
  { n: '难度 4', d: '起步资金少 ¥15' },
  { n: '难度 5', d: '大考夜的目标再 +20%' },
  { n: '难度 6', d: '少一颗心' },
  { n: '难度 7', d: '物价涨得更快' },
  { n: '难度 8', d: '秘诀栏位少一个' },
];
export const stake = () => G.S.arena ? 1 : G.S.stake || 1;

// 每晚小目标:主线从第 2 晚起,每晚给一个可做可不做的目标,做到了结算时多拿一笔钱(当晚目标的三成)。
// n: 要做到的数量;d: 说明;v: 从当晚的统计里读出现在做到了多少
export const GOALS = [
  { k: 'thirst', n: () => 2 + Math.floor(G.S.night / 2), d: n => `口渴连击 ${n} 次`, v: N => N.thirst },
  { k: 'maxed', n: () => 2 + Math.floor(G.S.night / 2), d: n => `让 ${n} 位顾客买满上限`, v: N => N.maxed },
  { k: 'heat', n: () => Math.round((1.6 + 0.12 * G.S.night) * 10) / 10, d: n => `人气涨到 ×${n}`, v: N => N.heat * N.xmult },
  { k: 'over', n: () => Math.round(targetOf(G.S.night) * 1.5 / 5) * 5, d: n => `热度冲到 ${n}`, v: N => N.income },
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
  const cur = G.N && G.N.earn ? Math.round(def.v(G.N) * 10) / 10 : 0;
  return { text: def.d(g.n), cur: Math.min(cur, g.n), n: g.n, reward: g.reward, done: cur >= g.n };
}
const counters = () => ({ thirst: 0, maxed: 0, earn: {}, catSet: {}, flow: 0, heat: 1, xmult: 1 });   // 当晚的统计:小目标用的几项,加上流水、人气、稀有秘诀的倍数

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
const patrolled = r => r === 0 && G.S.event && G.S.event.k === 'patrol';   // 大考「城管巡查」:第一排今晚停业,也不参与搭配
const frontAt = (c, r) => { const s = stallAt(c, r); return s && !DEF[s.id].sup && !patrolled(r) ? s : null; };
// 场上现在生效的所有搭配
export function activeCombos() {
  const out = [];
  for (const s of G.S.stalls) { if (!isFront(s.c) || DEF[s.id].sup || patrolled(s.r)) continue; const t = frontAt(s.c, s.r + 1); if (t) out.push(...pairCombos(s, t)); }
  return out;
}
// 某个摊位参与的搭配(和上家、下家各看一次)
function combosAt(s) {
  if (!isFront(s.c) || patrolled(s.r)) return [];
  const up = frontAt(s.c, s.r - 1), down = frontAt(s.c, s.r + 1);
  return (up ? pairCombos(up, s) : []).concat(down ? pairCombos(s, down) : []);
}
const CAT_N = { food: '小吃', drink: '饮品', sweet: '甜品', game: '玩具', goods: '杂货' };
const EVENT_CHANCE = 0.6;
// 大考夜:主线第 3、6、9、10 晚(无尽模式里每逢 3 的倍数)。每局开局时排好顺序并公开,规则专门为难某一类摆法。
// 大考夜没有随机事件;过了大考,下一次选秘诀必出一个稀有的。cust、cap 的含义同事件,capMax 是每人消费次数的上限;其余效果在 statOf、trySell 里按 k 处理
export const BOSSES = [
  { k: 'judge', n: '美食评委', d: '甜品、玩具、杂货售价减半' },
  { k: 'blackout', n: '停电', d: '支援摊全部失效' },
  { k: 'patrol', n: '城管巡查', d: '街口第一排不能营业' },
  { k: 'picky', n: '挑剔的食客', d: '每位顾客最多买 2 次', capMax: 2 },
  { k: 'haggle', n: '砍价团', d: '所有售价打七折' },
  { k: 'quiet', n: '冷清夜', d: '客流少三分之一', cust: .67 },
  { k: 'mono', n: '尝鲜团', d: '每人同一品类只买一次' },
];
export const isBossNight = n => n % 3 === 0 || n === MAXN;
const bossIdx = n => n === MAXN ? 3 : n < MAXN ? n / 3 - 1 : Math.floor(n / 3);   // 这是本局第几场大考(从 0 数)
function bossSeq() { const S = G.S; if (!S.bossSeq) S.bossSeq = BOSSES.map(b => b.k).sort(() => Math.random() - 0.5); return S.bossSeq; }
export const bossOf = n => !G.S.arena && isBossNight(n) ? BOSSES.find(b => b.k === bossSeq()[bossIdx(n) % BOSSES.length]) : null;
// 下一场大考(今晚就是的话返回今晚):{ night, n, d };擂台里没有
export function nextBoss() { if (G.S.arena) return null; let n = G.S.night; while (!isBossNight(n)) n++; const b = bossOf(n); return { night: n, n: b.n, d: b.d }; }

export const eventOf = () => { const e = G.S.event; return e ? EVENTS.find(x => x.k === e.k) || BOSSES.find(x => x.k === e.k) : null; };
// 当前事件(或大考)的名字和说明,没有时返回 null;boss 为 true 表示今晚是大考
export function eventInfo() { const ev = eventOf(); if (!ev) return null; return { n: ev.n, d: typeof ev.d === 'function' ? ev.d(G.S.event.cat) : ev.d, boss: !!G.S.event.boss }; }
function rollEvent() {
  const S = G.S, boss = bossOf(S.night); if (boss) { S.event = { k: boss.k, boss: 1 }; return; }
  if (S.arena || S.night < 2 || Math.random() > EVENT_CHANCE) { S.event = null; return; }
  const last = S.event && S.event.k, pool = EVENTS.filter(e => e.k !== last), ev = pool[Math.random() * pool.length | 0];
  const cats = [...new Set(S.stalls.filter(s => !DEF[s.id].sup).map(s => DEF[s.id].cat))];   // 博主专挑玩家已经有的品类
  S.event = { k: ev.k }; if (ev.k === 'blogger') S.event.cat = cats.length ? cats[Math.random() * cats.length | 0] : 'food';
}

// 擂台赛:固定预算和客流,只营业一晚,比热度。规则对所有人相同,所以成绩可以互相比
export const ARENA = { budget: 400, cust: 20, refresh: 6, rows: 3 };

export const G = { S: null, N: null, main: null, cleared: 0 };   // cleared: 玩家累计过关的晚数(跨局),由界面层从档案里读出来填上 // S: 当前状态;N: 当晚状态;main: 打擂台时暂存的主线状态
let uid = 1;
// 读档
export function restore(d) { G.S = d; G.N = null; for (const s of d.stalls) uid = Math.max(uid, s.uid + 1); }

// 每日挑战:擂台的一个变体。每天一个主题(一组现成的经营秘诀,外加可选的预算和客流),所有人当天进到的货完全相同。
// base 是自动试玩在这个主题下的热度中位数,奖牌线按它的倍数定
export const DAILY = [
  { k: 'hot', n: '网红之夜', d: '客流多 12 人', perks: { more: 3 }, base: 5640 },
  { k: 'eat', n: '大胃王之夜', d: '每位顾客最多买 5 次', perks: { big: 2 }, base: 2240 },
  { k: 'rich', n: '土豪之夜', d: '多来 6 位土豪,消费 ×3', perks: { rich: 3 }, base: 5950 },
  { k: 'back', n: '回头客之夜', d: '75% 的顾客走到街尾会折返再逛一遍', perks: { back: 3 }, base: 3280 },
  { k: 'gift', n: '临别大促', d: '每位顾客的最后一单 ×3,第一单额外 +¥10', perks: { last: 2, first: 2 }, base: 4780 },
  { k: 'tight', n: '精打细算', d: '预算只有 ¥250,但进货价打七折', perks: { cheap: 2 }, budget: 250, base: 2190 },
  { k: 'gold', n: '黄金地段', d: '所有售价 +45%,但客流只有 12 人', perks: { price: 3 }, cust: 12, base: 1890 },
  { k: 'rain', n: '雨夜', d: '客流少四分之一,小吃售价 +50%', perks: {}, event: { k: 'rain' }, base: 2210 },
  { k: 'fair', n: '庙会', d: '客流多四成,但每人少买一次', perks: {}, event: { k: 'fair' }, base: 3940 },
  { k: 'blog', n: '博主探店', d: '甜品售价 +80%', perks: {}, event: { k: 'blogger', cat: 'sweet' }, base: 3080 },
  { k: 'kids', n: '亲子夜', d: '四成顾客是小孩,只买甜品和玩具,但爱掏钱', perks: {}, event: { k: 'kids' }, base: 1770 },
  { k: 'couple', n: '情侣夜', d: '一半顾客是情侣,每单付两份,最多买两次', perks: {}, event: { k: 'couple' }, base: 3430 },
];
export const themeOf = day => DAILY[day % DAILY.length];
// 铜牌随手能拿;银牌约等于自动试玩里排前五分之一的成绩;金牌比自动试玩的最好成绩还高一截,要靠排顺序和搭配
export const medalLines = th => [.75, 1.25, 1.8].map(k => Math.round(th.base * k / 10) * 10);   // 铜、银、金。热度是乘出来的,好坏局差距大,所以银、金两档拉得比较开
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
// 第 n 晚的目标。前 10 晚用校准过的表;无尽模式里每晚再涨 50%,取整到 100
export const targetOf = n => n <= MAXN ? TARGET[n - 1] : Math.round(TARGET[MAXN - 1] * Math.pow(1.5, n - MAXN) / 100) * 100;
// 今晚实际的目标:在表上的数字之外,还要算难度(2 档起 +15%,5 档起大考夜再 +20%)和「打点关系」(下一场大考 -25%)
export const target = () => {
  const S = G.S; if (S.arena) return S.rival ? S.rival.score : 0;
  const boss = isBossNight(S.night);
  return Math.round(targetOf(S.night) * (stake() >= 2 ? 1.15 : 1) * (boss && stake() >= 5 ? 1.2 : 1) * (boss && S.bossEase ? .75 : 1));
};
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

export function newGame(who, level) {
  const k = OWNERS.some(o => o.k === who) ? who : 'none', lv = Math.max(1, Math.min(STAKES.length, level | 0 || 1));
  const S = G.S = { owner: k, stake: lv, night: 1, hearts: Math.max(1, (k === 'rich' ? 2 : 3) - (lv >= 6 ? 1 : 0)), money: Math.max(10, (START_MONEY[k] || 60) - (lv >= 4 ? 15 : 0)), stalls: [], shop: [], perks: {}, unlocked: new Set(), unlockN: 0, revived: false, phase: 'day' };
  for (let r = 0; r < (k === 'local' ? 3 : 2); r++) for (let c = 0; c < COLS; c++) S.unlocked.add(c + ',' + r);
  if (k === 'bbq') S.stalls.push({ uid: uid++, id: 'kebab', lvl: 1, c: 1, r: 0 });
  G.N = null; rollShop();
}
export const maxHearts = () => Math.max(1, (owner() === 'rich' ? 2 : 3) - (stake() >= 6 ? 1 : 0));
export const perk = k => G.S.perks[k] || 0;
export const isFront = c => c === 1 || c === 2;
export const stallAt = (c, r) => G.S.stalls.find(s => s.c === c && s.r === r);
const infl = () => Math.pow(stake() >= 7 ? 1.45 : INFL, G.S.night - 1);
export const costOf = d => Math.ceil(d.cost * infl() * Math.pow(0.85, perk('cheap')) * (owner() === 'star' ? 1.15 : 1));
export const sellVal = s => Math.floor(DEF[s.id].cost * Math.pow(2, s.lvl - 1) / 2);
export const unlockCost = () => Math.ceil((10 + 5 * G.S.unlockN) * infl());
export const refCost = () => G.S.freeRef > 0 && !G.S.arena ? 0 : Math.ceil(5 * infl() * (owner() === 'local' ? .5 : 1) * (stake() >= 3 ? 2 : 1));   // 老供货商:每晚头一次换货免费
export const custCount = () => { const ev = eventOf(); return Math.round(((G.S.arena ? (G.S.custBase || ARENA.cust) : 8 + 2 * G.S.night + (owner() === 'star' ? 3 : 0)) + 4 * perk('more')) * (ev && ev.cust || 1)); };
export const capN = () => { const ev = eventOf(); return Math.max(1, Math.min(ev && ev.capMax || 99, 3 + perk('big') + (ev && ev.cap || 0))); };
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
  const bk = G.S.event && G.S.event.k;
  for (const o of around(s)) {
    if (bk === 'blackout' && DEF[o.id].sup) continue;   // 大考「停电」:支援摊失效
    if (o.id === 'lamp') aMul += 0.2 * o.lvl;
    if (o.id === 'fridge' && (d.cat === 'drink' || d.cat === 'sweet')) pm += 0.5 * o.lvl;
    if (o.id === 'grill' && d.cat === 'food') pm += 0.4 * o.lvl;
    if (o.id === 'cat') flat += 2 * o.lvl;
    if (o.id === 'tofu' && o.lvl < 3 && d.cat !== 'food') aMul -= 0.3;   // 3 级臭豆腐不再熏邻摊
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
  if (s.lvl >= 3 && s.id === 'candy') aMul += .2;   // 3 级糖葫芦的招牌技
  const a = Math.max(.05, Math.min(.95, d.a * aMul));
  if (a >= .6) pm *= 1 + 0.25 * perk('queue');
  if (bk === 'judge' && d.cat !== 'food' && d.cat !== 'drink') pm *= .5;   // 大考「美食评委」
  if (bk === 'haggle') pm *= .7;                                          // 大考「砍价团」
  return { a, price: d.p * pm, pm, flat, closed: bk === 'patrol' && s.r === 0 };   // closed: 大考「城管巡查」,第一排今晚不能营业
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
function calcStats() { const m = new Map(); for (const s of G.S.stalls) if (isFront(s.c) && !DEF[s.id].sup) { const st = statOf(s); if (!st.closed) m.set(s.uid, st); } return m; }
// 按现在的摆法算:开张时的人气(1 起步,每组招牌搭配加一点),以及稀有秘诀再乘的倍数
function calcOpen(stats) {
  const front = G.S.stalls.filter(s => stats.has(s.uid)), combos = activeCombos().filter(x => stats.has(x.a.uid) && stats.has(x.b.uid)).length;
  const heat = Math.round((1 + 0.3 * perk('warm') + combos * (HEAT.combo + 0.2 * perk('pair'))) * 100) / 100;
  let x = 1;
  if (perk('xcombo')) x *= Math.pow(1.2, combos);
  if (perk('xfew') && front.length && front.length <= 6) x *= 1.8;
  if (perk('xfull') && front.length >= 12) x *= 1.6;
  if (perk('xtop')) x *= Math.pow(1.15, front.filter(s => s.lvl >= 3).length);
  if (perk('xmono') && front.length && new Set(front.map(s => DEF[s.id].cat)).size <= 2) x *= 1.6;
  return { heat, xmult: Math.round(x * 100) / 100 };
}
// 开张:把上面算出来的两个数写进当晚状态。open 记下开张时的人气,中场挪了摊位以后用它算「新凑成的搭配该补多少」
function openHeat(N) { const o = calcOpen(N.stats); N.heat = N.open = o.heat; N.xmult = o.xmult; return N; }
// 白天预览:按现在的摆法,开张时人气是多少、稀有秘诀的倍数是多少
export const openPreview = () => calcOpen(calcStats());

// 一晚的客人分 WAVES 波来。每波之间停下来(中场),公布下一波是什么客人,玩家有 MOVES 次机会调整摊位(挪动、对调或叠放升级)。
// 第一波固定是散客;后面每波的类型随机,到中场才公布。效果在 newCust、trySell 里按 k 处理
export const WAVES = 3, MOVES = 2;
export const WAVE_TYPES = [
  { k: 'normal', n: '散客', d: '没什么特别' },
  { k: 'thirsty', n: '下班潮', d: '个个进场就口渴,第一杯饮品翻倍' },
  { k: 'kids', n: '亲子团', d: '一半是小孩,只买甜品和玩具,爱掏钱' },
  { k: 'couple', n: '情侣档', d: '一半是情侣,每单两份,最多买两次' },
  { k: 'foodie', n: '夜宵客', d: '专为小吃来的,小吃多付五成' },
  { k: 'vip', n: '贵客', d: '这一波多来 2 位土豪' },
];
function rollWave(prev) { const pool = WAVE_TYPES.filter(t => t.k !== 'normal' && t.k !== prev); return Math.random() < .25 ? 'normal' : pool[Math.random() * pool.length | 0].k; }
// 把一晚的客人切成几波:返回 [{ type, q }]
function makeWaves(n) {
  const q = makeQueue(custCount(), 2 * perk('rich')), per = Math.ceil(q.length / n), out = []; let prev = 'normal';
  for (let i = 0; i < n; i++) { const part = q.slice(i * per, (i + 1) * per); if (!part.length) continue; const type = i ? rollWave(prev) : 'normal'; prev = type; if (type === 'vip') part.push(true, true); out.push({ type, q: part }); }
  return out.length ? out : [{ type: 'normal', q: [] }];
}
function loadWave() { const N = G.N, w = N.waves[N.wave]; N.waveType = w.type; N.queue = w.q.slice().sort(() => Math.random() - 0.5); }
// waves: 分几波(新手引导里传 1,不停顿)
export function startNight(waves = WAVES) {
  G.S.phase = 'night';
  G.N = openHeat(Object.assign({ waves: makeWaves(waves), wave: 0, moves: MOVES, queue: [], income: 0, encore: false, stats: calcStats() }, counters()));
  loadWave(); return G.N;
}
// 这一波的客人都走了:后面还有就进中场(返回 true),没有就该结算了(返回 false)
export function waveDone() { const N = G.N; if (!N || N.encore || N.wave >= N.waves.length - 1) return false; G.S.phase = 'break'; return true; }
// 下一波是什么客人(中场时显示):{ i: 第几波, total, n, d };没有下一波返回 null
export function nextWaveInfo() { const N = G.N; if (!N || N.wave >= N.waves.length - 1) return null; const t = WAVE_TYPES.find(x => x.k === N.waves[N.wave + 1].type); return { i: N.wave + 2, total: N.waves.length, n: t.n, d: t.d }; }
// 中场调整一次:把摊位 s 挪到 (c, r)。次数用完返回 'nomoves';其余同 moveStall
export function breakMove(s, c, r) { const N = G.N; if (G.S.phase !== 'break' || !N || N.moves <= 0) return 'nomoves'; const res = moveStall(s, c, r); if (res !== 'max') N.moves--; return res; }
// 中场结束,下一波开始。摊位可能挪过:各摊位的数值重算;稀有秘诀的倍数按新的摆法算;新凑成的搭配补上人气
export function nextWave() {
  const N = G.N; if (G.S.phase !== 'break' || !N) return;
  N.wave++; N.stats = calcStats(); const o = calcOpen(N.stats);
  if (o.heat > N.open) { N.heat = Math.round((N.heat + o.heat - N.open) * 100) / 100; N.open = o.heat; }
  N.xmult = o.xmult; N.income = Math.round(N.flow * N.heat * N.xmult);
  G.S.phase = 'night'; loadWave();
}
export function encore() { G.N.encore = true; G.N.waveType = 'normal'; G.N.queue = makeQueue(6, 0); G.S.phase = 'night'; }
// thirsty:下一杯饮品的倍数,0 是不渴。kid(小孩)、couple(情侣)、foodie(夜宵客)由当晚的事件或这一波的类型带来,土豪不会是这几种。
// wave: 这位顾客属于哪种波次;不传就用当晚正在进行的那一波
export const newCust = (rich, wave) => {
  const ev = G.S.event && G.S.event.k, wv = wave || (G.N && G.N.waveType) || 'normal', r = Math.random();
  return { buys: 0, thirsty: ev === 'worker' || wv === 'thirsty' ? 2 : 0, full: false, happy: false, balloon: false, cats: [], rich,
    kid: !rich && ((ev === 'kids' && r < .4) || (wv === 'kids' && r < .5)), couple: !rich && ((ev === 'couple' && r < .5) || (wv === 'couple' && r < .5)), foodie: !rich && wv === 'foodie' };
};
const capOf = c => c.couple ? Math.min(2, capN()) : capN();   // 这位顾客最多买几次
function trySell(c, s, onSale) {
  const N = G.N, d = DEF[s.id], st = N.stats.get(s.uid); if (!st) return;
  const top = s.lvl >= 3;   // 3 级:招牌技生效
  const cap = capOf(c), free = d.free;   // free: 这一单不占消费次数
  if (c.kid && d.cat !== 'sweet' && d.cat !== 'game') return;
  if (G.S.event && G.S.event.k === 'mono' && c.cats.indexOf(d.cat) >= 0) return;   // 大考「尝鲜团」
  if (!free && c.buys >= cap) return; if (d.cat === 'food' && c.full) return; if (s.id === 'ring' && c.happy) return; if (s.id === 'balloon' && c.balloon) return;
  let a = st.a; if (s.id === 'phone' && c.happy) a = top ? .95 : a * 2; if (c.balloon) a *= c.balloon; if (c.kid) a *= 2; a = Math.min(.95, a);
  if (Math.random() > a) return;
  const f = { thirsty: 0, last: false };
  let amt = st.price + (s.id === 'ice' ? (top ? 4 : 3) * c.buys * st.pm : 0);
  if (d.cat === 'drink' && c.thirsty) { f.thirsty = c.thirsty + (top && s.id === 'lemon' ? 1 : 0); amt *= f.thirsty; c.thirsty = 0; }
  else if (top && s.id === 'tea') amt *= 1.2;
  if (c.happy) amt *= c.happy;
  if (!free && c.buys + 1 >= cap && perk('last')) { amt *= 1 + perk('last'); f.last = true; }
  amt += st.flat; if (!free && c.buys === 0) amt += 5 * perk('first');
  if (c.cats.indexOf(d.cat) < 0) { amt *= 1 + 0.2 * perk('set'); c.cats.push(d.cat); }
  if (c.foodie && d.cat === 'food') amt *= 1.5;
  if (c.couple) amt *= 2; if (c.rich) amt *= 3; amt = Math.round(amt);
  // 顾客状态:thirsty 是下一杯饮品的倍数,happy 是之后每一单的倍数,balloon 是之后吸引力的倍数;0 或 false 表示没有
  if (s.id === 'kebab') c.thirsty = Math.max(c.thirsty, top ? 2.5 : 2); if (s.id === 'crayfish') c.thirsty = top ? 3.5 : 3;
  if (s.id === 'rice' && !top) c.full = true; if (s.id === 'ring') c.happy = top ? 1.5 : 1.4;
  if (s.id === 'lemon') c.full = false; if (s.id === 'balloon') c.balloon = top ? 1.35 : 1.2;
  let dh = 0;   // 这一单让人气涨了多少
  if (!free) { c.buys++; if (c.buys === cap) { N.maxed++; dh += HEAT.maxed + 0.1 * perk('word'); } }
  if (f.thirsty) { N.thirst++; dh += HEAT.thirst + 0.1 * perk('cool'); }
  N.catSet[d.cat] = 1; N.earn[s.uid] = (N.earn[s.uid] || 0) + amt;
  N.flow += amt; N.heat = Math.round((N.heat + dh) * 100) / 100; f.heat = dh;
  N.income = Math.round(N.flow * N.heat * N.xmult);   // 热度 = 流水 × 人气 × 稀有秘诀的倍数
  if (onSale) onSale(c, s, amt, f);
}
export function visit(c, r, onSale) { for (const col of Math.random() < .5 ? [1, 2] : [2, 1]) { const s = stallAt(col, r); if (s) trySell(c, s, onSale); } }
// 利息:收摊时,手上没花掉的钱每 ¥10 生 ¥1,有上限(上限跟着物价涨);秘诀「存钱罐」每级把上限再加一倍。擂台里没有
export const interestCap = () => Math.ceil(20 * infl()) * (1 + perk('save'));
export const interestOf = () => G.S.arena ? 0 : Math.min(Math.floor(G.S.money / 10), interestCap());
export const wantsBack = c => !c.ret && c.buys < capOf(c) && Math.random() < 0.25 * perk('back');
export function finishNight() {
  const S = G.S, T = target(), inc = G.N.income; S.phase = 'settle';
  return { ok: S.arena ? inc > T : inc >= T, inc, T, flow: G.N.flow, heat: G.N.heat, xmult: G.N.xmult, tip: Math.round(G.N.flow * 0.1 * perk('tip')), interest: interestOf(), goal: (gi => gi && gi.done ? gi.reward : 0)(goalInfo()), encore: G.N.encore };
}
// 进入下一晚的白天。普通模式里第 10 晚没过则重打第 10 晚;无尽模式一直往后
export function nextDay() {
  const S = G.S, was = S.night; if (S.endless || S.night < MAXN) S.night++;
  if (S.night !== was && isBossNight(was)) S.bossEase = false;   // 「打点关系」只管一场大考
  S.phase = 'day'; S.freeRef = perk('supply'); G.N = null; rollEvent(); rollGoal(); rollSkip(); rollShop();
}
// 跳过平常夜:今晚不营业,没有收入、不选秘诀、不算过关,换一样奖励(每晚随机一样,白天就能看到)。大考夜、第 1 晚、擂台里不能跳
export const SKIP_TAGS = [
  { k: 'rare', n: '稀有秘诀', d: () => '立刻从稀有秘诀里挑一个' },
  { k: 'cash', n: '一笔现金', d: () => `立刻拿到 ¥${skipCash()}` },
  { k: 'ease', n: '打点关系', d: () => '下一场大考的目标降低 25%' },
  { k: 'land', n: '三块空地', d: () => '免费解锁 3 块地' },
];
const skipCash = () => Math.round(60 * infl());
function rollSkip() { const S = G.S; S.skipTag = S.arena ? null : SKIP_TAGS[Math.random() * SKIP_TAGS.length | 0].k; }
export const canSkip = () => { const S = G.S; return !S.arena && S.phase === 'day' && S.night >= 2 && !isBossNight(S.night) && !!S.skipTag; };
export function skipInfo() { const t = SKIP_TAGS.find(x => x.k === G.S.skipTag); return t && canSkip() ? { k: t.k, n: t.n, d: t.d() } : null; }
function unlockFree(n) { const S = G.S; for (let r = 0; r < ROWS && n; r++) for (let c = 0; c < COLS && n; c++) if (canUnlock(c, r)) { S.unlocked.add(c + ',' + r); n--; } }
// 返回 'perk'(接着要选稀有秘诀,选完才进下一晚)、'next'(已经进了下一晚)或 'no'(今晚不能跳)
export function skipNight() {
  const S = G.S, k = S.skipTag; if (!canSkip()) return 'no';
  if (k === 'cash') S.money += skipCash();
  if (k === 'ease') S.bossEase = true;
  if (k === 'land') unlockFree(3);
  if (k === 'rare') { S.rareOnly = true; S.phase = 'settle'; return 'perk'; }
  nextDay(); return 'next';
}
// 返回 'win' | 'perk'(等玩家选完秘诀再进下一晚)| 'over' | 'next'
export function settle(ok, gain) {
  const S = G.S; S.money += gain;
  if (ok) { if (!S.arena && isBossNight(S.night)) S.rareNext = true; return S.night === MAXN && !S.endless ? 'win' : 'perk'; }   // 过了大考:下次选秘诀必出一个稀有的
  S.hearts--; if (S.hearts <= 0) return 'over';
  nextDay(); return 'next';
}
// 通关后继续营业:目标每晚再涨 40%,看能撑到第几晚
export function goEndless() { G.S.endless = true; }
export function revive() { G.S.revived = true; G.S.hearts = 1; nextDay(); }
// 三选一(精算师四选一)。已经叠满的不再出;每个位置有 RARE_CHANCE 的机会出稀有的,刚过大考时保证有一个
export function perkChoices() {
  const n = owner() === 'calc' ? 4 : 3, pool = PERKS.filter(p => p.once || perk(p.k) < perkMax(p)).sort(() => Math.random() - 0.5);
  const rare = pool.filter(p => p.r), norm = pool.filter(p => !p.r), out = [];
  for (let i = 0; i < n; i++) {
    const want = G.S.rareOnly || (i === 0 && G.S.rareNext) || Math.random() < RARE_CHANCE, src = want && rare.length ? rare : norm.length ? norm : rare;   // rareOnly: 跳过平常夜换来的,全是稀有
    if (src.length) out.push(src.pop());
  }
  return out.sort(() => Math.random() - 0.5);
}
// 不拿秘诀,直接进下一晚
export function skipPerk() { G.S.rareNext = G.S.rareOnly = false; nextDay(); }
// 拿一个秘诀。栏位满了又不是已有的,要指定换掉哪个(drop,秘诀的 k);没指定就返回 'full',什么也不做
export function takePerk(p, drop) {
  const S = G.S;
  if (!p.once && !perk(p.k) && perkSlots() >= perkCap()) { if (!drop || !perk(drop) || perkDef(drop).once) return 'full'; delete S.perks[drop]; }
  S.perks[p.k] = perk(p.k) + 1; S.rareNext = S.rareOnly = false;
  if (p.k === 'land') unlockFree(2);
  nextDay(); return 'ok';
}
// 调试用:不播动画,估算当前摆法的平均热度
export function quickSim(k = 300) {
  const keep = G.N; let sum = 0, flow = 0, mult = 0;
  for (let i = 0; i < k; i++) {
    G.N = openHeat(Object.assign({ income: 0, stats: calcStats() }, counters()));
    for (const w of makeWaves(WAVES)) for (const rich of w.q) {   // 和真打一样分波次、带波次类型,只是中场不调整
      const c = newCust(rich, w.type); for (let r = 0; r < ROWS; r++) visit(c, r);
      if (wantsBack(c)) for (let r = ROWS - 1; r >= 0; r--) visit(c, r);
    }
    sum += G.N.income; flow += G.N.flow; mult += G.N.heat * G.N.xmult;
  }
  G.N = keep; quickSim.flow = Math.round(flow / k); quickSim.mult = mult / k;   // 平均流水(实收的钱,自动试玩拿它当收入)和平均人气
  return Math.round(sum / k);
}
