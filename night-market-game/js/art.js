// 美术层。没有图片的东西用代码画占位图;assets/ 里有对应名字的图片,就自动换成图片。
// 图片由 tools/process_art.py 处理并登记到 assets.js,不需要手动改代码。命名规则:
//   摊位 stall_<id>.png(可选分级 stall_<id>_2.png / _3.png),id 见 logic.js 的 DEF
//   顾客 cust_<名字>_front.png / cust_<名字>_back.png,土豪是 cust_rich_front / cust_rich_back
//   地面 tile_street.jpg(街面)、tile_walk.jpg(摊位区)
//   界面 icon_*.png / perk_*.png / medal_*.png(图标)、ui_*.png(九宫格底图)、tile_wood.jpg、gate.png,见美术规格第 11 节
import ASSETS from './assets.js';
// 视角约定(2.5D):摊位是斜侧 3/4 视角,正面朝向右下方,能看到正面、左端面和顶面。
// 素材只画这一个朝向,放在街道左侧;街道右侧的摊位由代码水平镜像,这样两侧都朝向街心。
export const IMAGE_FILES = ASSETS.slice();
const IMG = {};
export const image = name => IMG[name];
// 给一位顾客随机挑一套形象(返回名字);没有顾客图片时返回 null,用代码画的小人
const KID_LOOKS = ['boy', 'girl', 'pupil'];   // 这几个形象是小孩:亲子夜里的小孩优先用它们
export function pickLook(rich, kid) {
  const ids = Object.keys(IMG).map(k => (k.match(/^cust_(.+)_front$/) || [])[1]).filter(Boolean);
  if (rich) return ids.indexOf('rich') >= 0 ? 'rich' : null;
  let normal = ids.filter(i => i !== 'rich'); const kids = normal.filter(i => KID_LOOKS.indexOf(i) >= 0);
  if (kid && kids.length) normal = kids;
  return normal.length ? normal[Math.random() * normal.length | 0] : null;
}
export function loadImages(P) {
  for (const f of IMAGE_FILES) { const im = P.createImage(); im.onload = () => { IMG[f.replace(/\.\w+$/, '')] = im; }; im.src = 'assets/' + f; }
}

// 棚顶颜色代表品类:小吃红、饮品蓝、甜品紫、玩具黄、杂货绿(和美术素材一致)
export const CAT_COLOR = { food: '#e8553d', drink: '#3da9e8', sweet: '#9b6bf2', game: '#f2b233', goods: '#3fbf8f' };
export const AURA = { lamp: '255,120,60', fridge: '110,210,255', grill: '255,150,40', cat: '255,215,90' };

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export function ell(ctx, x, y, rx, ry) { ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry); ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.restore(); }
// 光晕。每种颜色只在离屏画布上画一次,之后每帧按需要的大小和透明度贴上去;一帧里有几十个光晕,这样比每次现算渐变省得多
const GLOW = {}; let makeCanvas = null;
export function setCanvasFactory(f) { makeCanvas = f; }
export function glow(ctx, x, y, r, rgb, a) {
  if (a <= 0) return;
  let sp = GLOW[rgb];
  if (!sp && makeCanvas) {
    try {
      sp = makeCanvas(64, 64); const c = sp.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(0, 0, 64, 64); GLOW[rgb] = sp;
    } catch (e) { sp = null; makeCanvas = null; }   // 离屏画布用不了就退回现算渐变
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (sp) { ctx.globalAlpha = ctx.globalAlpha * Math.min(1, a); ctx.drawImage(sp, x - r, y - r, r * 2, r * 2); }
  else { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.restore();
}
// 表情符号始终正着画:所在的坐标系被镜像时,这里再翻回来
function emoji(ctx, e, x, y, px, flip) {
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.font = `${px}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff'; ctx.fillText(e, 0, 0); ctx.restore();
}

// ---------- 斜侧投影 ----------
// 摊位的本地坐标:u 沿正面从左到右,v 从正面到背面,z 向上;(0,0,0) 是离镜头最近的那个底角。
// 返回把 (u,v,z) 换成屏幕偏移的函数,原点在地块底边中点。
function proj(w) {
  const L = w * .80, D = w * .54, x0 = (.42 * D - .80 * L) / 2;
  return (u, v, z) => [x0 + u * .80 * L - v * .42 * D, -(u * .28 * L + v * .26 * D) - z];
}
function quad(ctx, pts, fill) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
// 一个立方体的三个可见面:左端面、正面、顶面
function box(ctx, p, u0, u1, v0, v1, z0, z1, front, side, top) {
  quad(ctx, [p(u0, v0, z0), p(u0, v1, z0), p(u0, v1, z1), p(u0, v0, z1)], side);
  quad(ctx, [p(u0, v0, z0), p(u1, v0, z0), p(u1, v0, z1), p(u0, v0, z1)], front);
  quad(ctx, [p(u0, v0, z1), p(u1, v0, z1), p(u1, v1, z1), p(u0, v1, z1)], top);
}
function booth(ctx, w, h, def, lvl, dark, flip) {
  // 棚顶只盖住摊位靠后的大半,前沿退到台面后面,这样从斜上方看,台面上的商品不会被棚顶挡住
  const p = proj(w), col = CAT_COLOR[def.cat], zc = h * .24, zf = h * .60, zb = h * .70;
  const U0 = -.06, U1 = 1.06, V0 = .2, V1 = 1.05, roofZ = v => zf + (zb - zf) * (v - V0) / (V1 - V0);
  const post = (u, v) => { const a = p(u, v, zc), b = p(u, v, roofZ(v)); ctx.strokeStyle = '#4a3327'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  post(0, 1); post(1, 1);                                                               // 后立柱
  box(ctx, p, 0, 1, 0, 1, 0, zc, '#96592f', '#5f381f', '#dba765');                      // 柜台
  quad(ctx, [p(.06, 0, zc * .24), p(.94, 0, zc * .24), p(.94, 0, zc * .74), p(.06, 0, zc * .74)], col);   // 招牌色带
  quad(ctx, [p(0, 0, zc), p(1, 0, zc), p(1, 0, zc - 2), p(0, 0, zc - 2)], 'rgba(255,255,255,.28)');       // 台沿高光
  const c = p(.5, .22, zc);
  ctx.fillStyle = `rgba(255,196,120,${.15 + .3 * dark})`; ell(ctx, c[0], c[1] - h * .14, w * .34, h * .2); ctx.fill();  // 棚内暖光
  emoji(ctx, def.e, c[0], c[1] + 2, h * .34, flip);                                     // 商品,摆在台面靠前的位置
  post(0, V0); post(1, V0);                                                             // 前立柱
  const n = 6;
  for (let i = 0; i < n; i++) {                                                         // 条纹棚顶,前低后高
    const ua = U0 + (U1 - U0) * i / n, ub = U0 + (U1 - U0) * (i + 1) / n, fill = i % 2 ? '#fff3e0' : col;
    quad(ctx, [p(ua, V0, zf), p(ub, V0, zf), p(ub, V1, zb), p(ua, V1, zb)], fill);
    quad(ctx, [p(ua, V0, zf), p(ub, V0, zf), p(ub, V0, zf - 5), p(ua, V0, zf - 5)], fill);   // 前檐垂边
  }
  quad(ctx, [p(U0, V0, zf), p(U1, V0, zf), p(U1, V0, zf - 5), p(U0, V0, zf - 5)], 'rgba(0,0,0,.14)');   // 垂边比棚顶略暗
  const side = [p(U0, V0, zf), p(U0, V1, zb), p(U0, V1, zb - 6), p(U0, V0, zf - 6)];    // 左侧垂边(背光面)
  quad(ctx, side, col); quad(ctx, side, 'rgba(0,0,0,.32)');
  const a = p(U0, V1, zb), b = p(U1, V0, zf), g = ctx.createLinearGradient(0, a[1], 0, b[1]); g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(0,0,0,.16)');
  quad(ctx, [p(U0, V0, zf), p(U1, V0, zf), p(U1, V1, zb), p(U0, V1, zb)], g);           // 棚顶明暗
  if (lvl >= 2) for (let i = 0; i <= n; i++) { const q = p(U0 + (U1 - U0) * i / n, V0, zf - 9); ctx.fillStyle = lvl >= 3 ? '#ffe27a' : '#ffd0a0'; ctx.beginPath(); ctx.arc(q[0], q[1], 1.8, 0, 7); ctx.fill(); }
  if (lvl >= 3) { const e0 = p(U0, V1, zb), e1 = p(U1, V1, zb); ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.stroke(); }
}
function support(ctx, w, h, def, s, t, flip) {
  const p = proj(w), zc = h * .2;
  box(ctx, p, .22, .78, .2, .8, 0, zc, '#8a5a36', '#55341f', '#b98452');                // 小木箱
  const c = p(.5, .5, zc);
  emoji(ctx, def.e, c[0], c[1] + 4 + Math.sin(t * 2 + s.uid) * 1.5, h * .48, flip);
  if (s.lvl >= 2) for (let i = 0; i < s.lvl; i++) { const q = p(.36 + i * .14, .2, zc * .5); ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(q[0], q[1], 2.2, 0, 7); ctx.fill(); }
}
// 在地块 (x,y,w,h) 上画一个摊位。锚点在底边中点;摊位可以略高出地块,靠前排遮挡后排形成纵深。
// 第 2、3 列在街道右侧,整体水平镜像。
export function drawStall(ctx, x, y, w, h, s, def, dark, t) {
  const cx = x + w / 2, base = y + h - 4, sc = 1 + (s.bounce || 0) * .16, flip = s.c >= 2, sw = w * .96;
  ctx.fillStyle = 'rgba(0,0,0,.34)'; ell(ctx, cx, base - h * .13, w * .47, h * .17); ctx.fill();          // 地面投影
  if (def.sup) glow(ctx, cx, base - h * .4, w * (.75 + .08 * Math.sin(t * 2 + s.uid)), AURA[s.id], .22 + .06 * s.lvl);
  ctx.save(); ctx.translate(cx, base); ctx.scale(flip ? -sc : sc, 2 - sc);
  const img = IMG['stall_' + s.id + '_' + s.lvl] || IMG['stall_' + s.id];
  // 图片等比缩放到「宽不超过地块 1.08 倍、高不超过地块 1.12 倍」,底边居中对齐;所有排同一尺寸,不按远近缩放
  if (img) { const k = Math.min(w * 1.08 / img.width, h * 1.12 / img.height), iw = img.width * k, ih = img.height * k; ctx.drawImage(img, -iw / 2, -ih, iw, ih); }
  else if (def.sup) support(ctx, sw, h, def, s, t, flip); else booth(ctx, sw, h, def, s.lvl, dark, flip);
  ctx.restore();
  if (!def.sup) glow(ctx, cx, base - h * .45, w * .8, '255,170,80', .2 * dark + (s.bounce || 0) * .25);
}

export const SHIRTS = ['#ff7a7a', '#6ab7ff', '#7fe0a0', '#ffd166', '#c79bff', '#ff9f6a', '#8ee3e8'];
export const HAIRS = ['#2b2230', '#4a3020', '#1d1d2b', '#6b4a2a', '#8a8a96'];
export const SKINS = ['#ffd9b8', '#f5c49a', '#e8b088'];
// 顾客:锚点在脚底
export function drawPerson(ctx, c, t) {
  const x = c.x, y = c.y, ph = Math.sin(t * 11 + c.seed), bob = Math.abs(ph) * 1.6;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(ctx, x, y, 7, 2.6); ctx.fill();
  // 有图片就用图片:往街尾走用正面,折返用背面(没有背面图就还用正面)
  const im = c.look && (IMG['cust_' + c.look + (c.dir > 0 ? '_front' : '_back')] || IMG['cust_' + c.look + '_front']);
  if (im) { const h = 42, w = h * im.width / im.height; ctx.drawImage(im, x - w / 2, y - h - bob + 2, w, h); }
  else {
  ctx.fillStyle = '#2c2a45'; ctx.fillRect(x - 4, y - 8, 3, 7 + ph * 1.5); ctx.fillRect(x + 1, y - 8, 3, 7 - ph * 1.5);
  rr(ctx, x - 6.5, y - 22 - bob, 13, 15, 5); ctx.fillStyle = c.rich ? '#ffcf4a' : c.shirt; ctx.fill();
  ctx.fillStyle = c.skin; ctx.beginPath(); ctx.arc(x, y - 27 - bob, 6.5, 0, 7); ctx.fill();
  ctx.fillStyle = c.hair; ctx.beginPath();
  if (c.dir > 0) ctx.arc(x, y - 28.5 - bob, 6.8, Math.PI, 0); else ctx.arc(x, y - 27 - bob, 6.9, 0, 7);
  ctx.fill();
  if (c.dir > 0) { ctx.fillStyle = '#2b2230'; ctx.fillRect(x - 3, y - 27 - bob, 1.5, 2); ctx.fillRect(x + 1.5, y - 27 - bob, 1.5, 2); }
  }
  if (c.balloon) {   // 买过气球的顾客手里牵一只气球
    const bx = x + 9, by = y - 40 - bob + Math.sin(t * 3 + c.seed) * 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 5, y - 16 - bob); ctx.lineTo(bx, by + 6); ctx.stroke();
    ctx.fillStyle = '#ff6b6b'; ell(ctx, bx, by, 5, 6); ctx.fill(); ctx.strokeStyle = '#2b1a12'; ctx.lineWidth = 1.2; ctx.stroke();
  }
  const iy = y - (im ? 49 : 40) - bob; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (c.rich) { glow(ctx, x, y - 20, 16, '255,215,90', .35); ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#ffe680'; ctx.fillText('¥¥', x, iy); }
  else if (c.thirsty) { ctx.fillStyle = '#7fd6ff'; ctx.beginPath(); ctx.moveTo(x, iy - 5); ctx.quadraticCurveTo(x + 5, iy + 2, x, iy + 4); ctx.quadraticCurveTo(x - 5, iy + 2, x, iy - 5); ctx.fill(); }
  else if (c.happy) { ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#ffe680'; ctx.fillText('♪', x, iy); }
  else if (c.full) { ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = '#ffb38a'; ctx.fillText('饱', x, iy); }
}
// ---------- 界面素材(美术规格第 11 节) ----------
// 图标:美术给的是 128×128、四周留 8 像素的方图。有图就以 (x,y) 为中心画成 size 大小,返回 true;没图返回 false,由调用方画占位
export function icon(ctx, name, x, y, size) {
  const im = IMG[name]; if (!im) return false;
  ctx.drawImage(im, x - size / 2, y - size / 2, size, size); return true;
}
// 九宫格拉伸:原图四个角各 SLICE 像素保持原样,四条边和中间拉长。corner 是角在屏幕上画多大(设计稿单位)。
// 有图返回 true;没图返回 false,由调用方用代码画
const SLICE = 24;
// 横幅两端的卷轴比 24 像素宽:左右各留 44 像素不拉伸(要和 tools/process_art.py 里的 SLICE_X 一致)
const SLICE_X = { ui_ribbon_red: 44, ui_ribbon_gold: 44, ui_ribbon_gray: 44 };
export function nine(ctx, name, x, y, w, h, corner) {
  const im = IMG[name]; if (!im) return false;
  const s = SLICE, t = SLICE_X[name] || s, iw = im.width, ih = im.height, d = Math.min(corner, w / 2, h / 2), e = Math.min(d * t / s, w / 2), o = .5;   // o:相邻两块互相压住半个单位,缩放后不露缝
  const sx = [0, t, iw - t], sw = [t, iw - 2 * t, t], sy = [0, s, ih - s], sh = [s, ih - 2 * s, s];
  const dx = [x, x + e, x + w - e], dw = [e, w - 2 * e, e], dy = [y, y + d, y + h - d], dh = [d, h - 2 * d, d];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    if (dw[c] <= 0 || dh[r] <= 0) continue;
    const ex = c === 1 ? o : 0, ey = r === 1 ? o : 0;
    ctx.drawImage(im, sx[c], sy[r], sw[c], sh[r], dx[c] - ex, dy[r] - ey, dw[c] + 2 * ex, dh[r] + 2 * ey);
  }
  return true;
}
// 奖牌:1 铜 2 银 3 金。有 medal_<n>.png 用图片,没有就画一枚带绶带的圆牌
const MEDAL_COL = ['', '#c8793a', '#c9cdd6', '#ffc94a'];
export function drawMedal(ctx, x, y, size, n) {
  if (icon(ctx, 'medal_' + n, x, y, size)) return;
  const r = size * .3, cy = y + size * .14, INK = '#2b1a12';
  ctx.lineWidth = Math.max(1, size * .06); ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  for (const k of [-1, 1]) {   // 两条绶带
    const top = y - size * .42, bot = cy - r * .4;
    ctx.beginPath(); ctx.moveTo(x + k * r * .95, top); ctx.lineTo(x + k * r * .15, top); ctx.lineTo(x - k * r * .3, bot); ctx.lineTo(x + k * r * .45, bot); ctx.closePath();
    ctx.fillStyle = k < 0 ? '#d24a35' : '#3d7fc4'; ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = MEDAL_COL[n] || MEDAL_COL[3]; ctx.beginPath(); ctx.arc(x, cy, r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(43,26,18,.45)'; ctx.lineWidth = Math.max(.8, size * .035); ctx.beginPath(); ctx.arc(x, cy, r * .62, 0, 7); ctx.stroke();
}
// 「看广告」的播放标记:一个实心三角。不用 ▶ 字符,它在一些手机上会被显示成表情
export function drawPlay(ctx, x, y, size, col) {
  const a = size * .42; ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x - a * .7, y - a); ctx.lineTo(x + a, y); ctx.lineTo(x - a * .7, y + a); ctx.closePath(); ctx.fill();
}

export function drawHeart(ctx, x, y, s, on) {
  if (icon(ctx, on ? 'icon_heart' : 'icon_heart_empty', x, y, s * 2.9)) return;
  ctx.fillStyle = on ? '#ff5a6e' : '#3a3658'; ctx.beginPath(); ctx.moveTo(x, y + s * .9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * .1, x - s * .7, y - s * 1.1, x, y - s * .3);
  ctx.bezierCurveTo(x + s * .7, y - s * 1.1, x + s * 1.5, y - s * .1, x, y + s * .9); ctx.fill();
}
export function drawCoin(ctx, x, y, r) {
  if (icon(ctx, 'icon_coin', x, y, r * 2.4)) return;
  ctx.fillStyle = '#c98a1a'; ctx.beginPath(); ctx.arc(x, y + 1, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff1b0'; ctx.beginPath(); ctx.arc(x - r * .3, y - r * .3, r * .35, 0, 7); ctx.fill();
}
