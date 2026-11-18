// 会摆的自动试玩:买货和原来一样(买得起就买、同名一级就合成),但
//  1. 摆完以后反复尝试对调/挪动摊位,按「估算营业额」爬山,凑搭配、街型、先烤串后饮品;
//  2. 选秘诀时每个都试一下,挑估算热度最高的;
//  3. 货买完了还有钱,挑最划算的老字号或秘诀升级。
// 「会摆」比 balance_main.mjs 的「随手摆」更接近认真玩的真人(但中场不调整,也不会有目的地进货),定每晚目标时两个一起看。
// 用法(在放着 night-market-game 的文件夹里运行):
//   node tools/balance_smart.mjs <logic.js 的地址> <累计过关晚数> <smart 或 naive> <run 或 cal> [局数,默认 200] [难度 1~8]
//   run:正常打,输出通关率、每晚「热度/目标」的中位数、达标和拿星的比例;cal:每晚都算过关,只输出热度的分位数
//   想先试一组新目标不改 logic.js:在命令前设环境变量 TGT=30,100,...(10 个数,逗号分隔)
const L = await import(process.argv[2]);
const { G, DEF, ROWS, COLS, MAXN } = L;
G.cleared = +process.argv[3] || 0;
if (process.env.TGT) process.env.TGT.split(',').forEach((v, i) => { L.TARGET[i] = +v; });   // 试一组新目标,不用改 logic.js
const SMART = process.argv[4] !== 'naive', CAL = process.argv[5] === 'cal', NG = +process.argv[6] || 200, STAKE = +process.argv[7] || 1;

// 估算营业额:每个靠街售卖摊 价格×吸引力,饮品前面有烤串/小龙虾按 ×2,冰粉越靠后越贵;再乘开张人气和稀有倍数
function score() {
  const S = G.S, front = S.stalls.filter(s => L.isFront(s.c) && !DEF[s.id].sup);
  let flow = 0;
  for (const s of front) {
    const st = L.statOf(s); if (st.closed) continue;
    let p = st.price;
    if (DEF[s.id].cat === 'drink' && front.some(o => (o.id === 'kebab' || o.id === 'crayfish') && o.r < s.r)) p *= 2;
    if (s.id === 'ice') p += 3 * Math.min(3, s.r) * st.pm;
    flow += p * Math.min(.95, st.a) + st.flat;
  }
  const o = L.openPreview();
  return flow * o.heat * o.xmult;
}
function cells() { const out = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (G.S.unlocked.has(c + ',' + r)) out.push([c, r]); return out; }
function arrange() {
  const S = G.S, cs = cells(); let best = score();
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (const s of S.stalls.slice()) for (const [c, r] of cs) {
      if (s.c === c && s.r === r) continue;
      const at = L.stallAt(c, r), sc = s.c, sr = s.r;
      if (at && at.id === s.id && at.lvl === s.lvl) continue;   // 不在这里合成
      if (at) { at.c = sc; at.r = sr; } s.c = c; s.r = r;
      const v = score();
      if (v > best + 1e-9) { best = v; improved = true; break; }
      s.c = sc; s.r = sr; if (at) { at.c = c; at.r = r; }
    }
    if (!improved) break;
  }
}
function pickPerk() {
  const ch = L.perkChoices();
  if (!ch.length) return L.skipPerk();
  let p = ch[Math.random() * ch.length | 0], drop;
  const own = L.ownedPerks(), full = L.perkSlots() >= L.perkCap();
  if (SMART) {
    let best = -1;
    for (const c of ch) {
      const keep = Object.assign({}, G.S.perks), keepPg = G.S.pg && Object.assign({}, G.S.pg);
      let d = null;
      if (!c.once && !L.perk(c.k) && full) { d = own.sort((a, b) => (G.S.perks[a.k] || 0) - (G.S.perks[b.k] || 0))[0].k; delete G.S.perks[d]; }   // 栏位满:换掉等级最低的
      G.S.perks[c.k] = (G.S.perks[c.k] || 0) + 1;
      arrange(); const v = L.quickSim(12);
      G.S.perks = keep; G.S.pg = keepPg;
      if (v > best) { best = v; p = c; drop = d; }
    }
    if (L.takePerk(p, drop) !== 'full') return;
    return L.skipPerk();
  }
  if (L.takePerk(p) !== 'full') return;
  if (Math.random() < .5) L.takePerk(p, own[Math.random() * own.length | 0].k); else L.skipPerk();
}
// 后期花钱:老字号和秘诀升级。会摆的按「估算营业额涨多少 / 花多少钱」挑最划算的一样;随手摆的随便挑一样买得起的
function spendUp() {
  const S = G.S, opts = [];
  for (const s of S.stalls) if (s.lvl === 3 && L.oldCost(s) <= S.money) opts.push({ cost: L.oldCost(s), go: () => { s.lvl = 4; }, back: () => { s.lvl = 3; }, buy: () => L.makeOld(s) });
  for (const p of L.ownedPerks()) if (L.canPerkUp(p) && L.perkUpCost(p) <= S.money) opts.push({ cost: L.perkUpCost(p), go: () => { S.perks[p.k]++; }, back: () => { S.perks[p.k]--; }, buy: () => L.buyPerkUp(p) });
  if (!opts.length) return false;
  let pick = opts[Math.random() * opts.length | 0];
  if (SMART) { const b = score(); let bv = -1; for (const o of opts) { o.go(); const v = (score() - b) / o.cost; o.back(); if (v > bv) { bv = v; pick = o; } } }
  return pick.buy() === 'ok';
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
    if (!did) did = spendUp();   // 货买完了:钱花在老字号和秘诀升级上
    if (!did) { if (S.money >= L.refCost() * 5 && ref < 12) { L.refresh(false); ref++; } else break; }
  }
  if (SMART) arrange();
}
const incs = Array.from({ length: MAXN }, () => []), ratio = Array.from({ length: MAXN }, () => []); let wins = 0;
for (let g = 0; g < NG; g++) {
  L.newGame('none', STAKE); let guard = 0;
  while (guard++ < 40) {
    const S = G.S, n = S.night; day(); const inc = L.quickSim(1), T = L.target();
    incs[n - 1].push(inc); ratio[n - 1].push(inc / T);
    const ok = CAL || inc >= T, res = L.settle(ok, L.quickSim.flow + (inc >= T ? L.overBonus(L.overStars(inc, T), L.quickSim.flow) : 0) + L.interestOf() + (G.S.night >= 2 ? Math.round(L.goalReward(L.quickSim.flow) / 2) : 0));
    if (res === 'win') { wins++; break; }
    if (res === 'over') break;
    if (res === 'perk') pickPerk();
  }
}
const pc = (a, p) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * p)] : 0; };
if (CAL) console.log(incs.map((a, i) => `第${i + 1}晚 p10=${pc(a, .1)} p25=${pc(a, .25)} p50=${pc(a, .5)} p75=${pc(a, .75)} 目标=${L.targetOf(i + 1)}`).join('\n'));
else {
  console.log(`${SMART ? '会摆' : '随手摆'} · 累计 ${G.cleared} 晚 · 难度 ${STAKE} · 通关率 ${(wins / NG * 100).toFixed(0)}%`);
  console.log(ratio.map((a, i) => `第${i + 1}晚 中位 ${pc(a, .5).toFixed(2)} 达标${(a.filter(x => x >= 1).length / Math.max(1, a.length) * 100).toFixed(0)}% ★1.5倍${(a.filter(x => x >= 1.5).length / Math.max(1, a.length) * 100).toFixed(0)}% ★★2倍${(a.filter(x => x >= 2).length / Math.max(1, a.length) * 100).toFixed(0)}%`).join('\n'));
}
