// 在电脑上模拟微信小游戏的运行环境,把游戏按「微信模式」跑一遍:走完新手引导、打完第一晚、选秘诀、再开一晚。
// 目的是提前发现微信那条代码路径上的错误(比如用了微信里没有的 window、document、localStorage)。
// 它不能代替真机测试:画面对不对、广告和转发是否正常,仍然要在微信开发者工具和手机上看。
//
// 用法(在放着 night-market-game 的文件夹里运行):  node tools/wx_smoke_test.mjs
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const texts = [];                       // 每一帧画到屏幕上的文字,用来判断游戏走到了哪一步
const calls = { share: 0, vibrate: 0, storageSet: 0, images: 0, audio: 0 };
const grad = { addColorStop() { } };
const ctx = new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'measureText') return s => ({ width: String(s).length * 8 });
    if (k === 'fillText' || k === 'strokeText') return s => { texts.push(String(s)); };
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
    if (k === 'createPattern') return () => ({});
    return () => { };
  },
  set(t, k, v) { t[k] = v; return true; },
});
const store = new Map(); let touchStart, touchEnd, raf;
const audioNode = new Proxy({}, { get: (t, k) => k === 'currentTime' ? 0 : k === 'state' ? 'running' : k === 'frequency' || k === 'gain' ? audioNode : () => audioNode });
globalThis.wx = {
  createCanvas: () => ({ width: 0, height: 0, getContext: () => ctx, toTempFilePathSync: () => 'tmp/share.png' }),
  getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 812, pixelRatio: 3, statusBarHeight: 44 }),
  getMenuButtonBoundingClientRect: () => ({ bottom: 80 }),
  onTouchStart: cb => { touchStart = cb; }, onTouchEnd: cb => { touchEnd = cb; },
  createImage: () => { calls.images++; const im = { width: 320, height: 320 }; Object.defineProperty(im, 'src', { set() { setTimeout(() => im.onload && im.onload(), 0); } }); return im; },
  getStorageSync: k => store.has(k) ? store.get(k) : '', setStorageSync: (k, v) => { calls.storageSet++; store.set(k, v); },
  createWebAudioContext: () => { calls.audio++; return audioNode; },
  vibrateShort: () => { calls.vibrate++; }, showShareMenu() { }, onShareAppMessage() { }, shareAppMessage() { calls.share++; },
  getLaunchOptionsSync: () => ({ query: {} }), onShow() { },
};
globalThis.requestAnimationFrame = cb => { raf = cb; };
let now = 1.7e12; Date.now = () => (now += 16);                      // 每调用一次时间前进 16 毫秒,相当于一帧
for (const k of ['window', 'document', 'localStorage', 'navigator', 'location']) {
  if (k in globalThis) try { Object.defineProperty(globalThis, k, { get() { throw new Error('微信里没有 ' + k + ',但代码用到了它'); }, configurable: true }); } catch (e) { }
}

const frames = n => { for (let i = 0; i < n; i++) { texts.length = 0; const f = raf; f(); } };
const tap = (x, y) => { touchStart({ touches: [{ clientX: x, clientY: y }] }); touchEnd({ changedTouches: [{ clientX: x, clientY: y }] }); frames(2); };
const seen = s => texts.some(t => t.includes(s));
const until = (s, max = 4000) => { for (let i = 0; i < max && !seen(s); i++) frames(1); return seen(s); };
const step = (name, ok) => { console.log((ok ? '  通过  ' : '  失败  ') + name); if (!ok) process.exitCode = 1; };

await import(pathToFileURL(path.resolve('night-market-game/game.js')).href);
await new Promise(r => setTimeout(r, 50));                           // 等图片的 onload
frames(3);
step('启动并画出第一帧', seen('第 1/10 晚'));
step('第一次进入时出现新手引导', seen('欢迎来到夜市'));
// 屏幕 375x812、胶囊按钮底边 80 时的布局:面板顶在 y=592,卡片中心 y≈702,第一格地块中心约 (116,225)
tap(187, 300);                       // 任意处继续
tap(52, 702); tap(116, 225);         // 烤串 → 靠街第一格
tap(142, 702); tap(116, 290);        // 奶茶 → 下一格
tap(232, 702); tap(44, 225);         // 灯牌 → 里排
step('引导走到「开张营业」', seen('准备好了'));
tap(277, 782);
step('进入夜晚', until('今晚热度', 50));
step('夜晚结束并结算', until('今晚达标'));
for (let y = 300; y < 640 && !seen('选一条经营秘诀'); y += 12) tap(187, y);
step('收摊后出现三选一', seen('选一条经营秘诀'));
for (let y = 300; y < 640 && seen('选一条经营秘诀'); y += 12) tap(187, y);
frames(5);
step('选完秘诀进入第 2 晚', seen('第 2/10 晚'));
step('引导说完最后一句', seen('祝生意兴隆'));
tap(187, 300);                                                       // 点任意处,引导结束
step('引导结束后不再遮挡', !seen('祝生意兴隆'));
tap(187, 560);                                                       // 随便点一下空地:每次点击后都会存档
step('存档已写入', store.has('run') && JSON.parse(store.get('run')).night === 2);
step('档案已写入', store.has('prof') && JSON.parse(store.get('prof')).cleared === 1);
// 第二晚起一晚分三波,每波之间有中场:看到「继续营业」就点一下
const nightEnd = () => { for (let i = 0; i < 12000 && !seen('今晚达标') && !seen('没达标'); i++) { frames(1); if (seen('继续营业')) tap(187, 782); } return seen('今晚达标') || seen('没达标'); };
tap(277, 782); step('第二晚能开张', until('今晚热度', 50));
step('第二晚出现中场', until('中场休息', 6000));
step('第二晚能打完并结算', nightEnd());
console.log('  图片加载 ' + calls.images + ' 张 · 存储写入 ' + calls.storageSet + ' 次 · 震动 ' + calls.vibrate + ' 次 · 音频上下文 ' + calls.audio + ' 个');
console.log(process.exitCode ? '有步骤没通过,见上面' : '微信模式下全部步骤通过');
