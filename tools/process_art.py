# -*- coding: utf-8 -*-
"""
把美术交来的原图处理成游戏能直接用的素材。

用法(在放着 night-market-game 的那个文件夹里运行):
    python tools/process_art.py

做的事:
  1. 读 art_raw/ 里的每张图,按文件名开头判断类型:
       stall_<摊位>.png   摊位(可加 _2 / _3 表示二、三级;加 _flip 表示朝向反了,需要水平翻转)
       cust_<名字>_front.png / cust_<名字>_back.png   顾客的正面、背面(土豪用 cust_rich_front / cust_rich_back)
       tile_street.png / tile_walk.png   可平铺的地面贴图
  2. 摊位和顾客:去掉纯色背景 → 裁掉四周空白 → 等比缩放 → 底边居中放到规定大小的透明画布上 → 压缩
     地面贴图:缩到 256x256 存成 JPG
  3. 输出到 night-market-game/assets/,并重写 night-market-game/js/assets.js(游戏按这个清单加载图片)
  4. 生成 art_raw/_检查图.png:把所有摊位按游戏里的实际大小排在深色底上,用来检查大小、角度、亮度是否一致

原图要求:背景是纯色平涂(不要渐变、暗角、地面投影),主体不要贴到图片边缘。已经是透明底的图会跳过抠图。
"""
import os, re, sys, io
from PIL import Image, ImageDraw, ImageChops, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art_raw")
GAME = os.path.join(ROOT, "night-market-game")
OUT = os.path.join(GAME, "assets")
KEY = (255, 0, 255)
THRESH = 40          # 抠图的颜色容差。背景抠不干净就调大,主体被吃掉就调小
KINDS = {            # 类型: (画布宽, 画布高, 四周留白)
    "stall": (320, 320, 8),
    "cust": (96, 128, 4),
}


def stall_ids():
    src = io.open(os.path.join(GAME, "js", "logic.js"), encoding="utf-8").read()
    body = src[src.index("export const DEF = {"):src.index("export const PERKS")]
    return re.findall(r"^\s+(\w+): \{ n:", body, re.M)


def keep_main(alpha):
    """只保留最大的那一块主体,去掉水印文字、角标、飘在外面的小物件。返回 (新的透明度, 去掉了几块)。"""
    small = alpha.resize((max(1, alpha.width // 4), max(1, alpha.height // 4)), Image.BILINEAR).point(lambda v: 255 if v > 60 else 0)
    px = small.load(); w, h = small.size; best = (0, 0); val = 1
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if px[x, y] == 255 and val < 250:
                ImageDraw.floodfill(small, (x, y), val)            # 给这一块涂上一个编号
                area = small.histogram()[val]
                if area > best[0]: best = (area, val)
                val += 1
    if not best[1]: return alpha, 0
    keep = small.point(lambda v: 255 if v == best[1] else 0).filter(ImageFilter.MaxFilter(5)).resize(alpha.size, Image.BILINEAR).point(lambda v: 255 if v > 0 else 0)
    return ImageChops.darker(alpha, keep), val - 2


def cutout(im):
    """去掉和四边相连的纯色背景,返回 RGBA 图和警告列表。"""
    warns = []
    if im.mode == "RGBA" and im.getchannel("A").getextrema()[0] < 250:
        return im, warns                                   # 本来就是透明底
    rgb = im.convert("RGB"); work = rgb.copy(); w, h = work.size
    seeds = [(x, y) for x in range(1, w - 1, max(1, w // 16)) for y in (1, h - 2)] + [(x, y) for y in range(1, h - 1, max(1, h // 16)) for x in (1, w - 2)]
    for s in seeds:
        if work.getpixel(s) != KEY:
            ImageDraw.floodfill(work, s, KEY, thresh=THRESH)
    bg = ImageChops.difference(work, Image.new("RGB", work.size, KEY)).convert("L").point(lambda v: 0 if v == 0 else 255)   # 主体为白
    alpha = bg.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))                                        # 收一圈边,去掉背景色的毛边
    alpha, dropped = keep_main(alpha)
    if dropped: warns.append("去掉了 %d 处和主体不相连的东西(水印、角标或飘在外面的小物件)" % dropped)
    out = rgb.convert("RGBA"); out.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    if not box:
        warns.append("整张图都被当成背景抠掉了,检查背景是不是纯色、主体颜色是不是和背景太接近")
    elif box[0] <= 2 or box[1] <= 2 or box[2] >= w - 2 or box[3] >= h - 2:
        warns.append("主体贴到了图片边缘:可能背景没抠干净(有渐变、暗角或投影),也可能主体被裁掉了")
    return out, warns


def fit(im, cw, ch, pad):
    """裁掉四周空白,等比缩放后底边居中放到透明画布上。"""
    box = im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    if box: im = im.crop(box)
    k = min((cw - 2 * pad) / im.width, (ch - 2 * pad) / im.height)
    small = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.paste(small, ((cw - small.width) // 2, ch - pad - small.height), small)
    return canvas, k


def save_png(im, path):
    im.save(path, optimize=True)
    if os.path.getsize(path) > 60 * 1024:                 # 太大就减色,体积能小一大半
        im.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
    return os.path.getsize(path)


def main():
    os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    ids = stall_ids(); rows = []; stalls = []
    files = sorted(f for f in os.listdir(RAW) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")) and not f.startswith("_"))
    for f in files:
        stem = os.path.splitext(f)[0].lower(); flip = stem.endswith("_flip"); name = stem[:-5] if flip else stem
        kind = name.split("_")[0]; im = Image.open(os.path.join(RAW, f)); warns = []
        if kind == "tile":
            im.convert("RGB").resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, name + ".jpg"), quality=85)
            rows.append((f, name + ".jpg", os.path.getsize(os.path.join(OUT, name + ".jpg")), warns)); continue
        if kind not in KINDS:
            rows.append((f, "跳过", 0, ["文件名要以 stall_、cust_ 或 tile_ 开头"])); continue
        if kind == "stall":
            sid = re.sub(r"_[23]$", "", name[6:])
            if sid not in ids: warns.append("不认识的摊位名「%s」,可用的是:%s" % (sid, "、".join(ids)))
        if kind == "cust" and not re.search(r"_(front|back)$", name):
            warns.append("顾客图的文件名要以 _front 或 _back 结尾")
        cw, ch, pad = KINDS[kind]
        if min(im.size) < cw: warns.append("原图只有 %dx%d,比需要的 %dx%d 小,放大后会糊" % (im.width, im.height, cw, ch))
        rgba, w2 = cutout(im.convert("RGBA") if im.mode != "RGBA" else im); warns += w2
        if flip: rgba = rgba.transpose(Image.FLIP_LEFT_RIGHT)
        canvas, _ = fit(rgba, cw, ch, pad)
        size = save_png(canvas, os.path.join(OUT, name + ".png"))
        rows.append((f, name + ".png", size, warns))
        if kind == "stall": stalls.append(name + ".png")

    # 游戏按这个清单加载图片
    listed = sorted(f for f in os.listdir(OUT) if f.lower().endswith((".png", ".jpg")))
    io.open(os.path.join(GAME, "js", "assets.js"), "w", encoding="utf-8", newline="\n").write(
        "// 这个文件由 tools/process_art.py 自动生成,不要手改。assets/ 里有哪些图片,游戏就加载哪些。\nexport default [%s];\n" % ", ".join("'%s'" % f for f in listed))

    # 检查图:上排大图看细节,下排是游戏里的实际大小
    if stalls:
        n = len(stalls); sheet = Image.new("RGB", (max(1, n) * 170 + 10, 290), (26, 24, 44))
        for i, f in enumerate(stalls):
            im = Image.open(os.path.join(OUT, f)).convert("RGBA")
            big = im.resize((160, 160), Image.LANCZOS); sheet.paste(big, (10 + i * 170, 10), big)
            sm = im.resize((75, 75), Image.LANCZOS); sheet.paste(sm, (10 + i * 170 + 42, 195), sm)
        sheet.save(os.path.join(RAW, "_检查图.png"))

    print("处理了 %d 张原图,assets/ 里现在有 %d 个文件,共 %.0f KB" % (len(files), len(listed), sum(os.path.getsize(os.path.join(OUT, f)) for f in listed) / 1024))
    for src, dst, size, warns in rows:
        print("  %-28s → %-24s %5.0f KB" % (src, dst, size / 1024))
        for w in warns: print("      ! " + w)
    if not files: print("  art_raw/ 里还没有图片。把原图按命名规则放进去再运行。")


if __name__ == "__main__":
    main()
