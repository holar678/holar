// 美术层。现在全部用代码画占位图;AI 出的图放进 assets/ 并登记在 IMAGE_FILES 里,就会自动替换对应的占位图。
// 命名规则:摊位 stall_<id>.png(可选分级 stall_<id>_2.png / _3.png),id 见 logic.js 的 DEF。
// 视角约定(等距 2.5D):整条街从右上斜向左下。素材只画一个朝向:等距视角,正面朝向右下方,
// 能看到正面(右下)、侧面(左下)和顶面。街道远侧的摊位直接用;近侧的摊位由代码水平镜像,正面变成朝左下。
export const IMAGE_FILES = []; // 例:['stall_kebab.png', 'stall_tea.png']
const IMG = {};
export function loadImages(P) {
  for (const f of IMAGE_FILES) { const im = P.createImage(); im.onload = () => { IMG[f.replace(/\.\w+$/, '')] = im; }; im.src = 'assets/' + f; }
}

export const CAT_COLOR = { food: '#e8553d', drink: '#3da9e8', sweet: '#f08ac0', game: '#9b6bf2', goods: '#3fbf8f' };
export const AURA = { lamp: '255,120,60', fridge: '110,210,255', grill: '255,150,40', cat: '255,215,90' };

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function ell(ctx, x, y, rx, ry) { ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry); ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.restore(); }
export function glow(ctx, x, y, r, rgb, a) {
  if (a <= 0) return; const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
// 表情符号始终正着画:所在的坐标系被镜像时,这里再翻回来
function emoji(ctx, e, x, y, px, flip) {
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.font = `${px}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff'; ctx.fillText(e, 0, 0); ctx.restore();
}

// ---------- 等距投影 ----------
// 摊位的本地坐标(单位:格,原点在地块中心的地面上):x 指向屏幕右下(摊位正面朝这边),y 指向屏幕左下,z 向上(像素)。
function isoP(tw) { const hw = tw / 2, hh = tw / 4; return (x, y, z) => [(x - y) * hw, (x + y) * hh - z]; }
function quad(ctx, pts, fill) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
// 一个立方体在等距视角下的三个可见面:右下的面(+x)、左下的面(+y)、顶面
function box(ctx, p, x0, x1, y0, y1, z0, z1, fx, fy, top) {
  quad(ctx, [p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)], fx);
  quad(ctx, [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)], fy);
  quad(ctx, [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)], top);
}
function booth(ctx, tw, def, lvl, dark, flip) {
  // 柜台沿正面(+x 一侧)摆,商品放在台面上;棚顶前低后高、架得够高,从斜上方能看到台面上的商品
  const p = isoP(tw), col = CAT_COLOR[def.cat], zc = tw * .22, zf = tw * .60, zb = tw * .72;
  const X0 = -.42, X1 = .44, Y0 = -.44, Y1 = .44, roofZ = x => zb + (zf - zb) * (x - X0) / (X1 - X0);
  const post = (x, y) => { const a = p(x, y, 0), b = p(x, y, roofZ(x)); ctx.strokeStyle = '#4a3327'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  quad(ctx, [p(-.4, -.42, 0), p(.4, -.42, 0), p(.4, .42, 0), p(-.4, .42, 0)], '#3b2a24');   // 地台
  post(-.38, -.4); post(-.38, .4); post(.38, -.4);                                         // 立柱(最靠近镜头的那根不画,免得挡住商品)
  box(ctx, p, .1, .4, -.4, .4, 0, zc, '#96592f', '#6e4222', '#dba765');                    // 柜台
  quad(ctx, [p(.4, -.34, zc * .24), p(.4, .34, zc * .24), p(.4, .34, zc * .76), p(.4, -.34, zc * .76)], col);   // 招牌色带
  const c = p(.25, 0, zc);
  ctx.fillStyle = `rgba(255,196,120,${.14 + .3 * dark})`; ell(ctx, c[0] - tw * .06, c[1] - tw * .12, tw * .3, tw * .18); ctx.fill();   // 棚内暖光
  const n = 6;
  for (let i = 0; i < n; i++) {                                                            // 条纹棚顶
    const ya = Y0 + (Y1 - Y0) * i / n, yb = Y0 + (Y1 - Y0) * (i + 1) / n, fill = i % 2 ? '#fff3e0' : col;
    quad(ctx, [p(X0, ya, zb), p(X0, yb, zb), p(X1, yb, zf), p(X1, ya, zf)], fill);
    quad(ctx, [p(X1, ya, zf), p(X1, yb, zf), p(X1, yb, zf - 5), p(X1, ya, zf - 5)], fill); // 前檐垂边
  }
  quad(ctx, [p(X1, Y0, zf), p(X1, Y1, zf), p(X1, Y1, zf - 5), p(X1, Y0, zf - 5)], 'rgba(0,0,0,.14)');
  const side = [p(X0, Y1, zb), p(X1, Y1, zf), p(X1, Y1, zf - 6), p(X0, Y1, zb - 6)];       // 侧面垂边(背光)
  quad(ctx, side, col); quad(ctx, side, 'rgba(0,0,0,.32)');
  const a = p(X0, Y0, zb), b = p(X1, Y1, zf), g = ctx.createLinearGradient(0, a[1], 0, b[1]); g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(0,0,0,.16)');
  quad(ctx, [p(X0, Y0, zb), p(X0, Y1, zb), p(X1, Y1, zf), p(X1, Y0, zf)], g);              // 棚顶明暗
  if (lvl >= 2) for (let i = 0; i <= n; i++) { const q = p(X1, Y0 + (Y1 - Y0) * i / n, zf - 9); ctx.fillStyle = lvl >= 3 ? '#ffe27a' : '#ffd0a0'; ctx.beginPath(); ctx.arc(q[0], q[1], 1.8, 0, 7); ctx.fill(); }
  const q = p(-.06, 0, zb + tw * .2), rad = tw * .19;                                      // 棚顶招牌
  ctx.strokeStyle = '#4a3327'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(q[0], q[1] + rad); ctx.lineTo(q[0], q[1] + rad + tw * .1); ctx.stroke();
  ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, 7); ctx.fillStyle = '#fff6e2'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
  emoji(ctx, def.e, q[0], q[1] + tw * .09, tw * .25, flip);
  if (lvl >= 3) { const e0 = p(X0, Y0, zb), e1 = p(X0, Y1, zb); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.stroke(); }
}
function support(ctx, tw, def, s, t, flip) {
  // 支援摊:小木箱上立一根高杆,顶上是带光晕色圆环的招牌。杆子够高,即使摆在前排摊位的后面,招牌也能从棚顶上方露出来
  const p = isoP(tw), zc = tw * .18, top = tw * (1.02 + Math.sin(t * 2 + s.uid) * .012), rad = tw * .17, c = p(0, 0, zc), q = p(0, 0, top);
  box(ctx, p, -.2, .2, -.2, .2, 0, zc, '#8a5a36', '#5f3c22', '#b98452');
  ctx.strokeStyle = '#4a3327'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(q[0], q[1] + rad); ctx.stroke();
  ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, 7); ctx.fillStyle = '#2a2444'; ctx.fill(); ctx.strokeStyle = `rgb(${AURA[s.id]})`; ctx.lineWidth = 2.5; ctx.stroke();
  emoji(ctx, def.e, q[0], q[1] + tw * .085, tw * .23, flip);
  if (s.lvl >= 2) for (let i = 0; i < s.lvl; i++) { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(q[0] + (i - (s.lvl - 1) / 2) * 7, q[1] - rad - 5, 2.2, 0, 7); ctx.fill(); }
}
// 在地块中心 (cx,cy) 画一个摊位,tw 是地块菱形的宽度。flip 为 true 时整体水平镜像(街道近侧的摊位)。
// 图片的锚点:图片底边中点对齐地块菱形最下面的那个角。
export function drawStall(ctx, cx, cy, tw, s, def, dark, t, flip) {
  const sc = 1 + (s.bounce || 0) * .16, foot = tw * .25 * .84;   // foot: 地块中心到摊位最低点的距离
  quad(ctx, [[cx, cy - tw * .23 + 3], [cx + tw * .46, cy + 3], [cx, cy + tw * .23 + 3], [cx - tw * .46, cy + 3]], 'rgba(0,0,0,.3)');   // 地面投影
  if (def.sup) { glow(ctx, cx, cy - tw * .1, tw * (.7 + .06 * Math.sin(t * 2 + s.uid)), AURA[s.id], .2 + .05 * s.lvl); glow(ctx, cx, cy - tw * 1.02, tw * .4, AURA[s.id], .3); }
  ctx.save(); ctx.translate(cx, cy + foot); ctx.scale(flip ? -sc : sc, 2 - sc); ctx.translate(0, -foot);   // 以最低点为轴做弹跳和镜像
  const img = IMG['stall_' + s.id + '_' + s.lvl] || IMG['stall_' + s.id];
  // 图片等比缩放到「宽不超过地块 1.04 倍、高不超过地块宽的 1.45 倍」
  if (img) { const k = Math.min(tw * 1.04 / img.width, tw * 1.45 / img.height), iw = img.width * k, ih = img.height * k; ctx.drawImage(img, -iw / 2, tw * .25 - ih, iw, ih); }
  else if (def.sup) support(ctx, tw, def, s, t, flip); else booth(ctx, tw, def, s.lvl, dark, flip);
  ctx.restore();
  if (!def.sup) glow(ctx, cx, cy - tw * .32, tw * .8, '255,170,80', .2 * dark + (s.bounce || 0) * .25);
}

export const SHIRTS = ['#ff7a7a', '#6ab7ff', '#7fe0a0', '#ffd166', '#c79bff', '#ff9f6a', '#8ee3e8'];
export const HAIRS = ['#2b2230', '#4a3020', '#1d1d2b', '#6b4a2a', '#8a8a96'];
export const SKINS = ['#ffd9b8', '#f5c49a', '#e8b088'];
// 顾客:锚点在脚底
export function drawPerson(ctx, c, t) {
  const x = c.x, y = c.y, ph = Math.sin(t * 11 + c.seed), bob = Math.abs(ph) * 1.6;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y, 7, 2.6); ctx.fill();
  ctx.fillStyle = '#2c2a45'; ctx.fillRect(x - 4, y - 8, 3, 7 + ph * 1.5); ctx.fillRect(x + 1, y - 8, 3, 7 - ph * 1.5);
  rr(ctx, x - 6.5, y - 22 - bob, 13, 15, 5); ctx.fillStyle = c.rich ? '#ffcf4a' : c.shirt; ctx.fill();
  ctx.fillStyle = c.skin; ctx.beginPath(); ctx.arc(x, y - 27 - bob, 6.5, 0, 7); ctx.fill();
  ctx.fillStyle = c.hair; ctx.beginPath();
  if (c.dir > 0) ctx.arc(x, y - 28.5 - bob, 6.8, Math.PI, 0); else ctx.arc(x, y - 27 - bob, 6.9, 0, 7);
  ctx.fill();
  if (c.dir > 0) { ctx.fillStyle = '#2b2230'; ctx.fillRect(x - 3, y - 27 - bob, 1.5, 2); ctx.fillRect(x + 1.5, y - 27 - bob, 1.5, 2); }
  const iy = y - 40 - bob; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (c.rich) { glow(ctx, x, y - 20, 16, '255,215,90', .35); ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#ffe680'; ctx.fillText('¥¥', x, iy); }
  else if (c.thirsty) { ctx.fillStyle = '#7fd6ff'; ctx.beginPath(); ctx.moveTo(x, iy - 5); ctx.quadraticCurveTo(x + 5, iy + 2, x, iy + 4); ctx.quadraticCurveTo(x - 5, iy + 2, x, iy - 5); ctx.fill(); }
  else if (c.happy) { ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#ffe680'; ctx.fillText('♪', x, iy); }
  else if (c.full) { ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = '#ffb38a'; ctx.fillText('饱', x, iy); }
}
export function drawHeart(ctx, x, y, s, on) {
  ctx.fillStyle = on ? '#ff5a6e' : '#3a3658'; ctx.beginPath(); ctx.moveTo(x, y + s * .9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * .1, x - s * .7, y - s * 1.1, x, y - s * .3);
  ctx.bezierCurveTo(x + s * .7, y - s * 1.1, x + s * 1.5, y - s * .1, x, y + s * .9); ctx.fill();
}
export function drawCoin(ctx, x, y, r) {
  ctx.fillStyle = '#c98a1a'; ctx.beginPath(); ctx.arc(x, y + 1, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff1b0'; ctx.beginPath(); ctx.arc(x - r * .3, y - r * .3, r * .35, 0, 7); ctx.fill();
}
