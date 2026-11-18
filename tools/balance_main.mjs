// 主线难度检查:让自动试玩从第 1 晚打到第 10 晚,看每晚营业额相对目标的倍数,以及能不能在 3 颗心内通关。
// 试玩策略很朴素(买得起就买、同名一级就合成、售卖摊放靠街、支援摊放里排、不讲究顺序),真人认真摆会明显好于它。
// 用法(在放着 night-market-game 的文件夹里运行): node tools/balance_main.mjs file:///完整路径/night-market-game/js/logic.js 0   (最后的数字是累计过关晚数,0 = 新玩家)
const L = await import(process.argv[2]);
const { G, DEF, ROWS, MAXN, PERKS } = L;
G.cleared = +process.argv[3] || 0;
const OWNER = process.argv[4] || 'none';   // 可选的第三个参数:摊主(logic.js 里 OWNERS 的 k),不写就是「小本经营」
// 第四个参数写 cal 进入「定目标」模式:每晚都算过关,只统计热度、流水、人气的分布,用来重新定 TARGET(见交付说明)
// 第四个参数也可以写一个数字:难度(1 到 8),不写是 1
const STAKE = +process.argv[5] || 1;
const CAL = process.argv[5] === 'cal', mk = () => Array.from({ length: MAXN }, () => []), incs = mk(), flows = mk(), mults = mk();
// 选秘诀:随机挑一个;栏位满了就一半机会随机换掉一个旧的,一半机会不要
function pickPerk() {
  const ch = L.perkChoices(), p = ch[Math.random() * ch.length | 0];
  if (!p) return L.skipPerk();
  if (L.takePerk(p) !== 'full') return;
  const own = L.ownedPerks();
  if (Math.random() < .5) L.takePerk(p, own[Math.random() * own.length | 0].k); else L.skipPerk();
}
// 后期花钱:随手挑一样买得起的老字号或秘诀升级
function spendUp() {
  const S = G.S, opts = [];
  for (const s of S.stalls) if (s.lvl === 3 && L.oldCost(s) <= S.money) opts.push(() => L.makeOld(s));
  for (const p of L.ownedPerks()) if (L.canPerkUp(p) && L.perkUpCost(p) <= S.money) opts.push(() => L.buyPerkUp(p));
  for (const b of L.BUILDS) if (L.buildCost(b) <= S.money) opts.push(() => L.buyBuild(b));   // 夜市建设
  return opts.length ? opts[Math.random() * opts.length | 0]() === 'ok' : false;
}
function day() {
  const S = G.S; let ref = 0, uid = 1000 + S.stalls.length * 7 + S.night * 100;
  for (let step = 0; step < 80; step++) {
    let did = false;
    for (const o of S.shop) {
      if (o.sold) continue; const d = DEF[o.id], cost = L.costOf(d); if (S.money < cost) continue;
      if (d.sup && !S.stalls.some(x => !DEF[x.id].sup)) continue;
      const same = S.stalls.find(s => s.id === o.id && s.lvl === 1);
      if (same) { S.money -= cost; o.sold = true; same.lvl = 2; did = true; continue; }
      const cols = d.sup ? [0, 3] : [1, 2]; let spot = null;
      for (let r = 0; r < ROWS && !spot; r++) for (const c of cols) if (S.unlocked.has(c + ',' + r) && !L.stallAt(c, r)) { spot = [c, r]; break; }
      if (!spot) for (let r = 0; r < ROWS && !spot; r++) for (const c of cols) if (L.canUnlock(c, r) && S.money >= cost + L.unlockCost()) { L.unlock(c, r); spot = [c, r]; break; }
      if (!spot) continue; S.money -= cost; o.sold = true; S.stalls.push({ uid: uid++, id: o.id, lvl: 1, c: spot[0], r: spot[1] }); did = true;
    }
    for (const a of S.stalls) if (a.lvl === 2) { const b = S.stalls.find(x => x !== a && x.id === a.id && x.lvl === 2); if (b) { a.lvl = 3; S.stalls = S.stalls.filter(x => x !== b); did = true; break; } }
    if (!did) did = spendUp();
    if (!did) { if (S.money >= L.refCost() * 5 && ref < 12) { L.refresh(false); ref++; } else break; }
  }
}
const N = 400, ratio = Array.from({ length: MAXN }, () => []); let wins = 0; const reach = Array(MAXN + 1).fill(0);
for (let g = 0; g < N; g++) {
  L.newGame(OWNER, STAKE); let guard = 0;
  while (guard++ < 40) {
    const S = G.S, n = S.night; day(); const inc = L.quickSim(1), T = L.target(); ratio[n - 1].push(inc / T); incs[n - 1].push(inc); flows[n - 1].push(L.quickSim.flow); mults[n - 1].push(L.quickSim.mult);
    const res = L.settle(CAL || inc >= T, L.quickSim.flow + (inc >= T ? L.overBonus(L.overStars(inc, T), L.quickSim.flow) : 0) + L.interestOf() + (G.S.night >= 2 ? Math.round(L.goalReward(L.quickSim.flow) / 2) : 0));   // 进口袋的是流水(不是热度),达标后再加超额奖励
    if (res === 'win') { wins++; reach[MAXN]++; break; }
    if (res === 'over') { reach[n - 1]++; break; }
    if (res === 'perk') pickPerk();
  }
}
if (CAL) {   // 每晚热度的几个分位数(第 10、15、25、50 百分位),以及流水和人气的中位数
  const pc = (a, p) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * p)] : 0; };
  console.log(incs.map((a, i) => `第${i + 1}晚 热度 p10=${pc(a, .10)} p15=${pc(a, .15)} p25=${pc(a, .25)} p50=${pc(a, .5)} · 流水 p50=${pc(flows[i], .5)} · 人气 p25=${pc(mults[i], .25).toFixed(1)} p50=${pc(mults[i], .5).toFixed(1)} p90=${pc(mults[i], .9).toFixed(1)}`).join('\n'));
  process.exit(0);
}
const q = (a, p) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * p)].toFixed(2) : '-'; };
console.log('累计过关 ' + G.cleared + ' 晚的玩家' + (OWNER !== 'none' ? ' · 摊主 ' + OWNER : '') + (STAKE > 1 ? ' · 难度 ' + STAKE : '') + ' · 自动试玩通关率 ' + (wins / N * 100).toFixed(0) + '%');
console.log('每晚「热度/目标」的中位数(括号里是较差的四分之一):');
console.log(ratio.map((a, i) => `第${i + 1}晚 ${q(a, .5)}(${q(a, .25)}) 达标${(a.filter(x => x >= 1).length / Math.max(1, a.length) * 100).toFixed(0)}%`).join('\n'));
