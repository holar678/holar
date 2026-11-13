// 用自动试玩给每日挑战的每个主题估一个营业额中位数,作为奖牌线的基准。
// 试玩策略很朴素:买得起就买,同名一级就合成,售卖摊放靠街、支援摊放里排,不讲究顺序。真人认真摆会明显高于它。
const L = await import(process.argv[2]);
const { G, DEF, COLS, ROWS } = L;
L.newGame();
function play(day, theme) {
  L.enterArena(null, { day, theme }); const S = G.S; let uid = 1;
  for (let step = 0; step < 80; step++) {
    let did = false;
    for (const o of S.shop) {
      if (o.sold) continue; const d = DEF[o.id], cost = L.costOf(d); if (S.money < cost) continue;
      const same = S.stalls.find(s => s.id === o.id && s.lvl === 1);
      if (same) { S.money -= cost; o.sold = true; same.lvl = 2; did = true; continue; }
      const cols = d.sup ? [0, 3] : [1, 2]; let spot = null;
      for (let r = 0; r < ROWS && !spot; r++) for (const c of cols) if (S.unlocked.has(c + ',' + r) && !L.stallAt(c, r)) { spot = [c, r]; break; }
      if (!spot) for (let r = 0; r < ROWS && !spot; r++) for (const c of cols) if (L.canUnlock(c, r) && S.money >= cost + L.unlockCost()) { L.unlock(c, r); spot = [c, r]; break; }
      if (!spot) continue; S.money -= cost; o.sold = true; S.stalls.push({ uid: uid++, id: o.id, lvl: 1, c: spot[0], r: spot[1] }); did = true;
    }
    for (const a of S.stalls) if (a.lvl === 2) { const b = S.stalls.find(x => x !== a && x.id === a.id && x.lvl === 2); if (b) { a.lvl = 3; S.stalls = S.stalls.filter(x => x !== b); did = true; break; } }
    if (!did) { if (L.refresh() !== 'ok') break; }
  }
  return L.quickSim(8);
}
const out = {};
for (const th of L.DAILY) {
  const xs = []; for (let day = 20000; day < 20200; day++) xs.push(play(day, th));
  xs.sort((a, b) => a - b); const q = p => xs[Math.floor(xs.length * p)];
  out[th.k] = { p25: q(.25), p50: q(.5), p75: q(.75), p90: q(.9) };
}
console.log(JSON.stringify(out));
