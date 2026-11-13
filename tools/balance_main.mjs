// 主线难度检查:让自动试玩从第 1 晚打到第 10 晚,看每晚营业额相对目标的倍数,以及能不能在 3 颗心内通关。
// 试玩策略很朴素(买得起就买、同名一级就合成、售卖摊放靠街、支援摊放里排、不讲究顺序),真人认真摆会明显好于它。
// 用法(在放着 night-market-game 的文件夹里运行): node tools/balance_main.mjs file:///完整路径/night-market-game/js/logic.js 0   (最后的数字是累计过关晚数,0 = 新玩家)
const L = await import(process.argv[2]);
const { G, DEF, ROWS, MAXN, PERKS } = L;
G.cleared = +process.argv[3] || 0;
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
    if (!did) { if (S.money >= L.refCost() * 5 && ref < 12) { L.refresh(false); ref++; } else break; }
  }
}
const N = 400, ratio = Array.from({ length: MAXN }, () => []); let wins = 0; const reach = Array(MAXN + 1).fill(0);
for (let g = 0; g < N; g++) {
  L.newGame(); let guard = 0;
  while (guard++ < 40) {
    const S = G.S, n = S.night; day(); const inc = L.quickSim(1), T = L.targetOf(n); ratio[n - 1].push(inc / T);
    const res = L.settle(inc >= T, inc);
    if (res === 'win') { wins++; reach[MAXN]++; break; }
    if (res === 'over') { reach[n - 1]++; break; }
    if (res === 'perk') L.takePerk(PERKS[Math.random() * PERKS.length | 0]);
  }
}
const q = (a, p) => { a = a.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * p)].toFixed(2) : '-'; };
console.log('累计过关 ' + G.cleared + ' 晚的玩家 · 自动试玩通关率 ' + (wins / N * 100).toFixed(0) + '%');
console.log('每晚「营业额/目标」的中位数(括号里是较差的四分之一):');
console.log(ratio.map((a, i) => `第${i + 1}晚 ${q(a, .5)}(${q(a, .25)}) 达标${(a.filter(x => x >= 1).length / Math.max(1, a.length) * 100).toFixed(0)}%`).join('\n'));
