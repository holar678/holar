// 平台适配:同一套代码在浏览器(调试)和微信小游戏里运行。
const isWx = typeof wx !== 'undefined' && typeof wx.createCanvas === 'function';
// 上线前必须填:开通流量主后,把微信后台的激励视频广告位 ID 填在这里。
// 留空时没有真广告:点「看广告」的按钮会直接发奖励,并提示广告位未配置,只适合测试
const AD_UNIT_ID = '';

// w/h: 屏幕大小;scale: 设计稿(宽 375)到屏幕的缩放;offX: 画面左边留出的空白(宽屏、平板上画面居中,两侧留边)
const P = { isWx, canvas: null, w: 375, h: 667, dpr: 1, scale: 1, offX: 0, safeTop: 10, hasAd: isWx && !!AD_UNIT_ID };
const MIN_H = 667;   // 设计稿的最小高度。屏幕比这个更「矮胖」时(平板、折叠屏、电脑上的微信),按高度缩放并左右留边

function size() {
  if (isWx) {
    const i = wx.getSystemInfoSync(); P.w = i.windowWidth; P.h = i.windowHeight; P.dpr = Math.min(2, i.pixelRatio);   // 最多按 2 倍像素渲染:3 倍屏上像素少一半多,低端机更流畅,肉眼差别很小
    // 避开右上角的胶囊按钮
    try { P.safeTop = wx.getMenuButtonBoundingClientRect().bottom + 8; } catch (e) { P.safeTop = (i.statusBarHeight || 20) + 44; }
  } else {
    P.w = Math.min(window.innerWidth, 440); P.h = window.innerHeight; P.dpr = Math.min(2, window.devicePixelRatio || 1);
    P.canvas.style.width = P.w + 'px'; P.canvas.style.height = P.h + 'px';
  }
  P.scale = Math.min(P.w / 375, P.h / MIN_H); P.offX = Math.round((P.w - 375 * P.scale) / 2);
  P.canvas.width = Math.round(P.w * P.dpr); P.canvas.height = Math.round(P.h * P.dpr);
}
if (isWx) P.canvas = wx.createCanvas();
else { P.canvas = document.getElementById('game'); window.addEventListener('resize', size); }
size();

// 点击:按下和抬起位置相近才算一次点击,坐标为屏幕像素
P.onTap = fn => {
  let sx = 0, sy = 0;
  if (isWx) {
    wx.onTouchStart(e => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; });
    wx.onTouchEnd(e => { const t = e.changedTouches[0]; if (Math.hypot(t.clientX - sx, t.clientY - sy) < 14) fn(t.clientX, t.clientY); });
  } else {
    const c = P.canvas;
    c.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    c.addEventListener('pointerup', e => { if (Math.hypot(e.clientX - sx, e.clientY - sy) < 14) { const r = c.getBoundingClientRect(); fn(e.clientX - r.left, e.clientY - r.top); } });
  }
};

// 激励视频:完整看完才回调 onReward
let ad = null, pending = null;
P.showRewardedAd = (onReward, onFail) => {
  if (!ad) {
    ad = wx.createRewardedVideoAd({ adUnitId: AD_UNIT_ID });
    ad.onClose(r => { const cb = pending; pending = null; if (cb && (!r || r.isEnded)) cb(); });
    ad.onError(() => { });
  }
  pending = onReward;
  ad.show().catch(() => ad.load().then(() => ad.show()).catch(() => { pending = null; if (onFail) onFail(); }));
};

// 本地存储(存档、擂台最高分)
P.store = {
  get: k => { try { return isWx ? wx.getStorageSync(k) : localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { if (isWx) wx.setStorageSync(k, v); else localStorage.setItem(k, v); } catch (e) { } },
};

// 分享。微信里拉起转发,卡片图用当前画面的截图;浏览器里把带参数的链接复制到剪贴板,方便调试。
// shot: 截图区域(画布像素),由界面层在分享前设置
P.shot = null;
P.share = ({ title, query }) => {
  if (isWx) {
    let imageUrl;
    try { if (P.shot) imageUrl = P.canvas.toTempFilePathSync({ x: 0, y: P.shot.y, width: P.canvas.width, height: P.shot.h, destWidth: 500, destHeight: 400 }); } catch (e) { }
    wx.shareAppMessage({ title, query, imageUrl }); return 'sent';
  }
  P.lastShareUrl = location.origin + location.pathname + '?' + query;
  try { navigator.clipboard.writeText(P.lastShareUrl).catch(() => console.log('挑战链接:' + P.lastShareUrl)); } catch (e) { console.log('挑战链接:' + P.lastShareUrl); }
  return 'copied';
};
// 右上角菜单里的「转发」
P.initShare = getInfo => { if (!isWx) return; try { wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }); wx.onShareAppMessage(() => getInfo()); } catch (e) { } };
// 从好友的战书卡片进入游戏时,把参数 ar 交给界面层
P.onChallenge = fn => {
  if (isWx) {
    try {
      const q = wx.getLaunchOptionsSync().query; if (q && q.ar) fn(q.ar);
      wx.onShow(r => { if (r && r.query && r.query.ar) fn(r.query.ar); });
    } catch (e) { }
  } else { const v = new URLSearchParams(location.search).get('ar'); if (v) fn(v); }
};

// 离屏画布,用来缓存反复画的东西(比如光晕)。微信里第一次 createCanvas 是屏幕,之后的都是离屏
P.createCanvas = (w, h) => { const c = isWx ? wx.createCanvas() : document.createElement('canvas'); c.width = w; c.height = h; return c; };
P.createImage = () => isWx ? wx.createImage() : new Image();
P.createAudio = () => {
  try {
    if (isWx) return wx.createWebAudioContext ? wx.createWebAudioContext() : null;
    const AC = window.AudioContext || window.webkitAudioContext; return AC ? new AC() : null;
  } catch (e) { return null; }
};
P.vibrate = () => { try { if (isWx) wx.vibrateShort({ type: 'light' }); else if (navigator.vibrate) navigator.vibrate(8); } catch (e) { } };

export default P;
