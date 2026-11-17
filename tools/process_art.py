# -*- coding: utf-8 -*-
"""
把美术交来的原图处理成游戏能直接用的素材。

用法(在放着 night-market-game 的那个文件夹里运行):
    python tools/process_art.py                        全部重新处理(图多的时候要几分钟)
    python tools/process_art.py perk_queue owner_star  只处理这几张(写文件名,不带扩展名和 _flip)

做的事:
  1. 读 art_raw/ 里的每张图,按文件名开头判断类型:
       stall_<摊位>.png   摊位(可加 _2 / _3 表示二、三级;加 _flip 表示朝向反了,需要水平翻转)
       cust_<名字>_front.png / cust_<名字>_back.png   顾客的正面、背面(土豪用 cust_rich_front / cust_rich_back)
       tile_street.png / tile_walk.png / tile_wood.png   可平铺的贴图(街面、摊位区地面、底部面板的木板)
       icon_coin / icon_heart / icon_heart_empty / medal_1~3 / perk_<秘诀> / owner_<摊主>   图标(美术规格 11.1)
       ui_btn_red / ui_btn_green / ui_btn_paper / ui_paper / ui_wood / ui_ribbon_red|gold|gray   九宫格底图(11.2)
       gate.png 街口牌楼,share_cover.png 转发封面,app_icon.png 小游戏图标(11.3)
  2. 摊位和顾客:去掉纯色背景 → 裁掉四周空白 → 等比缩放 → 底边居中放到规定大小的透明画布上 → 压缩
     图标:同样抠图裁边,居中放到 128x128(四周留 8)
     九宫格底图:抠图裁边后拉到规定尺寸(游戏按「四角各 24 像素不动」来拉伸)
     贴图:缩到 256x256 存成 JPG;转发封面缩到 500x400 存成 JPG
     小游戏图标不进游戏包,缩到 512x512 放在 上架素材/ 里,到微信公众平台上传
  3. 输出到 night-market-game/assets/,并重写 night-market-game/js/assets.js(游戏按这个清单加载图片)
  4. 生成 art_raw/_检查图.png:把所有摊位按游戏里的实际大小排在深色底上,用来检查大小、角度、亮度是否一致
     有界面素材时再生成 art_raw/_检查图_界面.png:图标按 40 和 20 像素缩小,底图按游戏里的几种尺寸拉伸

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
    "gate": (200, 176, 4),
    "icon": (128, 128, 8),
    "perk": (128, 128, 8),
    "medal": (128, 128, 8),
    "owner": (128, 128, 8),
}
CENTERED = ("icon", "perk", "medal", "owner")      # 图标居中放;摊位、顾客、牌楼底边对齐
ICON_NAMES = ["icon_coin", "icon_heart", "icon_heart_empty", "medal_1", "medal_2", "medal_3"]
UI_SIZE = {          # 九宫格底图: (宽, 高)。四角各 24 像素在游戏里保持原样,装饰只能放在角上
    "ui_btn_red": (192, 96), "ui_btn_green": (192, 96), "ui_btn_paper": (192, 96),
    "ui_paper": (192, 192), "ui_wood": (192, 96),
    "ui_ribbon_red": (384, 96), "ui_ribbon_gold": (384, 96), "ui_ribbon_gray": (384, 96),
}
SLICE = 24
SLICE_X = {"ui_ribbon_red": 44, "ui_ribbon_gold": 44, "ui_ribbon_gray": 44}   # 横幅两端的卷轴比 24 像素宽:左右多留一些不拉伸(要和 art.js 里的 SLICE_X 一致)
# ---- 个别原图需要的特殊处理(按文件名,不带 _flip 和扩展名) ----
EDGE = 0.12                                       # 贴图四周裁掉多少(水印和角标在边上)
GLOW = {"cust_office_front": 45, "cust_office_back": 45, "cust_boy_front": 45, "cust_rich_front": 22, "cust_rich_back": 22}   # 背景上有一团和四周不一样的蓝(亮光、暗影、石头):顺着偏蓝的颜色多抠一圈。数字是「蓝比红多多少才算偏蓝」,暗影要调小。主体本身有大块蓝色的(蓝裙子、蓝书包)不要登记,会被一起抠掉
THRESH_OF = {"stall_fridge": 22, "cust_rich_back": 20}                  # 主体颜色和背景太接近(深蓝底座配深蓝背景):容差调小
HOLES = ("icon_heart_empty", "medal_1")           # 主体中间镂空、露出背景的地方也要抠掉
CROP_AFTER = {"perk_cheap": (.2, .08, .8, .92), "owner_star": (0, 0, .8, 1)}   # 抠完后只留这一块(左、上、右、下,占整张图的比例):握手图两边的袖子伸到了图片外;网红店主右边挂着一串装饰
MULTI = {"perk_queue": .25}                       # 主体本来就是分开的几块(并排的三个小人):面积不小于最大块这个比例的都留下,不只留最大的一块


def stall_ids():
    src = io.open(os.path.join(GAME, "js", "logic.js"), encoding="utf-8").read()
    body = src[src.index("export const DEF = {"):src.index("export const PERKS")]
    return re.findall(r"^\s+(\w+): \{ n:", body, re.M)


def perk_ids():
    src = io.open(os.path.join(GAME, "js", "logic.js"), encoding="utf-8").read()
    body = src[src.index("export const PERKS"):]
    return re.findall(r"\{ k: '(\w+)'", body[:body.index("];")])


def owner_ids():
    src = io.open(os.path.join(GAME, "js", "logic.js"), encoding="utf-8").read()
    if "export const OWNERS" not in src: return []
    body = src[src.index("export const OWNERS"):]
    return re.findall(r"\{ k: '(\w+)'", body[:body.index("];")])


def keep_main(alpha, ratio=None):
    """只保留最大的那一块主体,去掉水印文字、角标、飘在外面的小物件。返回 (新的透明度, 去掉了几块)。
    ratio: 主体本来就是分开的几块时(比如并排的几个小人)传一个比例,面积不小于最大块这个比例的都留下。"""
    small = alpha.resize((max(1, alpha.width // 4), max(1, alpha.height // 4)), Image.BILINEAR).point(lambda v: 255 if v > 60 else 0)
    px = small.load(); w, h = small.size; best = (0, 0); val = 1; areas = {}
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if px[x, y] == 255 and val < 250:
                ImageDraw.floodfill(small, (x, y), val)            # 给这一块涂上一个编号
                area = small.histogram()[val]; areas[val] = area
                if area > best[0]: best = (area, val)
                val += 1
    if not best[1]: return alpha, 0
    ok = set(v for v, a in areas.items() if v == best[1] or (ratio and a >= best[0] * ratio))
    keep = small.point(lambda v: 255 if v in ok else 0).filter(ImageFilter.MaxFilter(5)).resize(alpha.size, Image.BILINEAR).point(lambda v: 255 if v > 0 else 0)
    return ImageChops.darker(alpha, keep), val - 1 - len(ok)


def near(rgb, color, tol):
    """和某个颜色接近的像素为白(三个通道的差加起来不超过 tol)。"""
    r, g, b = ImageChops.difference(rgb, Image.new("RGB", rgb.size, color)).split()
    return ImageChops.add(ImageChops.add(r, g), b).point(lambda v: 255 if v <= tol else 0)


def cutout(im, name="", glow=0):
    """去掉和四边相连的纯色背景,返回 RGBA 图和警告列表。glow: 背景上有一团比四周亮的蓝光时(人物图常见),把这团光也去掉。"""
    warns = []
    if im.mode == "RGBA" and im.getchannel("A").getextrema()[0] < 250:
        return im, warns                                   # 本来就是透明底
    rgb = im.convert("RGB"); work = rgb.copy(); w, h = work.size
    seeds = [(x, y) for x in range(1, w - 1, max(1, w // 16)) for y in (1, h - 2)] + [(x, y) for y in range(1, h - 1, max(1, h // 16)) for x in (1, w - 2)]
    cols = [rgb.getpixel(s) for s in seeds]
    ref = tuple(sorted(c[i] for c in cols)[len(cols) // 2] for i in range(3))     # 背景色:四边取样的中位数
    for s, c in zip(seeds, cols):
        if sum(abs(c[i] - ref[i]) for i in range(3)) > 110: continue              # 这个取样点落在了伸到图片边缘的主体上,不能从这里开始抠
        if work.getpixel(s) != KEY:
            ImageDraw.floodfill(work, s, KEY, thresh=THRESH_OF.get(name, THRESH))
    bg = ImageChops.difference(work, Image.new("RGB", work.size, KEY)).convert("L").point(lambda v: 0 if v == 0 else 255)   # 主体为白
    if name in HOLES: bg = ImageChops.darker(bg, ImageChops.invert(near(rgb, ref, 90)))
    if glow:   # 从已经抠掉的背景出发,顺着「明显偏蓝」的像素继续往里抠
        r, g, b = rgb.split(); blue = ImageChops.subtract(b, r).point(lambda v: 255 if v >= glow else 0)
        reach = ImageChops.lighter(ImageChops.invert(bg), blue)
        for s in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)):
            if reach.getpixel(s) == 255: ImageDraw.floodfill(reach, s, 128)
        bg = ImageChops.darker(bg, reach.point(lambda v: 0 if v == 128 else 255))
    alpha = bg.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))                                        # 收一圈边,去掉背景色的毛边
    alpha, dropped = keep_main(alpha, MULTI.get(name))
    if dropped: warns.append("去掉了 %d 处和主体不相连的东西(水印、角标或飘在外面的小物件)" % dropped)
    out = rgb.convert("RGBA"); out.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    if not box:
        warns.append("整张图都被当成背景抠掉了,检查背景是不是纯色、主体颜色是不是和背景太接近")
    elif box[0] <= 2 or box[1] <= 2 or box[2] >= w - 2 or box[3] >= h - 2:
        warns.append("主体贴到了图片边缘:可能背景没抠干净(有渐变、暗角或投影),也可能主体被裁掉了")
    return out, warns


def cut_pegs(im):
    """按钮底图:裁掉顶上比板子窄的部分(挂板子的木桩)。它们在边的中间,拉伸时会被拉成一长条。"""
    a = im.getchannel("A"); rows = list(a.resize((1, a.height), Image.BOX).tobytes()); top = 0
    while top < len(rows) // 2 and rows[top] < .8 * max(rows): top += 1
    return im.crop((0, top, im.width, im.height))


def mirror_top(im):
    """纸签底图:顶边中间有缺口,拉伸后会变成一道怪线。把下半张上下翻转过来当上半张用。"""
    half = im.crop((0, im.height - im.height // 2, im.width, im.height)).transpose(Image.FLIP_TOP_BOTTOM)
    out = im.copy(); out.paste(half, (0, 0)); return out


def trim(im):
    box = im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    return im.crop(box) if box else im


def nine_slice(im, w, h, d, sxw=SLICE):
    """按游戏里的规则把九宫格底图拉到 w x h,角画成 d 像素(sxw: 左右两端各留多宽不拉伸)。用来出检查图。"""
    s = SLICE; iw, ih = im.size; d = int(min(d, w // 2, h // 2)); e = int(min(d * sxw / s, w // 2)); out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sx = [0, sxw, iw - sxw, iw]; sy = [0, s, ih - s, ih]; dx = [0, e, w - e, w]; dy = [0, d, h - d, h]
    for r in range(3):
        for c in range(3):
            tw, th = dx[c + 1] - dx[c], dy[r + 1] - dy[r]
            if tw <= 0 or th <= 0: continue
            piece = im.crop((sx[c], sy[r], sx[c + 1], sy[r + 1])).resize((tw, th), Image.LANCZOS)
            out.paste(piece, (dx[c], dy[r]), piece)
    return out


def fit(im, cw, ch, pad, centered=False):
    """裁掉四周空白,等比缩放后底边居中(图标是正中)放到透明画布上。"""
    box = im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    if box: im = im.crop(box)
    k = min((cw - 2 * pad) / im.width, (ch - 2 * pad) / im.height)
    small = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.paste(small, ((cw - small.width) // 2, (ch - small.height) // 2 if centered else ch - pad - small.height), small)
    return canvas, k


def save_png(im, path):
    im.save(path, optimize=True)
    if os.path.getsize(path) > 60 * 1024:                 # 太大就减色,体积能小一大半
        im.quantize(colors=256, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
    return os.path.getsize(path)


def main():
    os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    ids = stall_ids(); perks = perk_ids(); owners = owner_ids(); rows = []; stalls = []
    files = sorted(f for f in os.listdir(RAW) if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")) and not f.startswith("_"))
    only = set(a.lower() for a in sys.argv[1:])   # 命令行后面写了名字(比如 perk_queue owner_star)就只重新处理这几张,省时间
    for f in files:
        stem = os.path.splitext(f)[0].lower(); flip = stem.endswith("_flip"); name = stem[:-5] if flip else stem
        if only and name not in only: continue
        kind = name.split("_")[0]; im = Image.open(os.path.join(RAW, f)); warns = []
        if kind == "tile":
            # 贴图:四周各裁掉 12%(水印和角标都在边上),缩到 256,再上下左右各镜像一份拼成 512。镜像拼出来的图怎么平铺都没有接缝
            rgb = im.convert("RGB"); w, h = rgb.size
            t = rgb.crop((int(w * EDGE), int(h * EDGE), int(w * (1 - EDGE)), int(h * (1 - EDGE)))).resize((256, 256), Image.LANCZOS)
            big = Image.new("RGB", (512, 512)); big.paste(t, (0, 0)); big.paste(t.transpose(Image.FLIP_LEFT_RIGHT), (256, 0))
            big.paste(t.transpose(Image.FLIP_TOP_BOTTOM), (0, 256)); big.paste(t.transpose(Image.ROTATE_180), (256, 256))
            big.save(os.path.join(OUT, name + ".jpg"), quality=82)
            rows.append((f, name + ".jpg", os.path.getsize(os.path.join(OUT, name + ".jpg")), warns)); continue
        if name == "share_cover":
            # 转发封面要 5:4:比它宽就裁左右,比它高就裁上下,取正中
            rgb = im.convert("RGB"); w, h = rgb.size
            if w / h > 1.25: cw2 = int(h * 1.25); rgb = rgb.crop(((w - cw2) // 2, 0, (w - cw2) // 2 + cw2, h)); warns.append("原图比 5:4 宽,左右各裁掉了一些")
            elif w / h < 1.25: ch2 = int(w / 1.25); rgb = rgb.crop((0, (h - ch2) // 2, w, (h - ch2) // 2 + ch2)); warns.append("原图比 5:4 高,上下各裁掉了一些")
            rgb.resize((500, 400), Image.LANCZOS).save(os.path.join(OUT, name + ".jpg"), quality=85)
            rows.append((f, name + ".jpg", os.path.getsize(os.path.join(OUT, name + ".jpg")), warns)); continue
        if name == "app_icon":
            pub = os.path.join(ROOT, "上架素材"); os.makedirs(pub, exist_ok=True); w, h = im.size
            im.convert("RGB").crop((int(w * .1), int(h * .1), int(w * .9), int(h * .9))).resize((512, 512), Image.LANCZOS).save(os.path.join(pub, "app_icon.png"), optimize=True)   # 四周裁掉一成:水印和角标在边上
            rows.append((f, "上架素材/app_icon.png", os.path.getsize(os.path.join(pub, "app_icon.png")), ["不进游戏包,到微信公众平台上传"])); continue
        if kind == "ui":
            if name not in UI_SIZE:
                rows.append((f, "跳过", 0, ["不认识的底图名,可用的是:" + "、".join(UI_SIZE)])); continue
            cw, ch = UI_SIZE[name]
            rgba, w2 = cutout(im.convert("RGBA") if im.mode != "RGBA" else im, name); warns += w2
            rgba = trim(rgba)
            if name.startswith("ui_btn_"): rgba = cut_pegs(rgba)
            if name == "ui_paper": rgba = mirror_top(rgba)
            if abs(rgba.width / rgba.height - cw / ch) > .25 * cw / ch:
                warns.append("抠出来的主体是 %dx%d,和规定的 %dx%d 比例差得多,拉伸后会变形" % (rgba.width, rgba.height, cw, ch))
            if min(rgba.size) < min(cw, ch) * .8: warns.append("原图太小,放大后会糊")
            size = save_png(rgba.resize((cw, ch), Image.LANCZOS), os.path.join(OUT, name + ".png"))
            rows.append((f, name + ".png", size, warns)); continue
        if kind not in KINDS:
            rows.append((f, "跳过", 0, ["文件名开头要是 stall_、cust_、tile_、icon_、perk_、medal_、owner_、ui_、gate 之一"])); continue
        if kind in ("icon", "medal") and name not in ICON_NAMES:
            warns.append("不认识的图标名,可用的是:" + "、".join(ICON_NAMES))
        if kind == "owner" and name[6:] not in owners:
            warns.append("不认识的摊主名「%s」,可用的是:%s" % (name[6:], "、".join(owners)))
        if kind == "perk" and name[5:] not in perks:
            warns.append("不认识的秘诀名「%s」,可用的是:%s" % (name[5:], "、".join(perks)))
        if kind == "stall":
            sid = re.sub(r"_[23]$", "", name[6:])
            if sid not in ids: warns.append("不认识的摊位名「%s」,可用的是:%s" % (sid, "、".join(ids)))
        if kind == "cust" and not re.search(r"_(front|back)$", name):
            warns.append("顾客图的文件名要以 _front 或 _back 结尾")
        cw, ch, pad = KINDS[kind]
        if min(im.size) < cw: warns.append("原图只有 %dx%d,比需要的 %dx%d 小,放大后会糊" % (im.width, im.height, cw, ch))
        rgba, w2 = cutout(im.convert("RGBA") if im.mode != "RGBA" else im, name, GLOW.get(name, 0)); warns += w2
        if name in CROP_AFTER:
            l, t, r, b = CROP_AFTER[name]; rgba = rgba.crop((int(l * rgba.width), int(t * rgba.height), int(r * rgba.width), int(b * rgba.height)))
        if flip: rgba = rgba.transpose(Image.FLIP_LEFT_RIGHT)
        canvas, _ = fit(rgba, cw, ch, pad, kind in CENTERED)
        size = save_png(canvas, os.path.join(OUT, name + ".png"))
        rows.append((f, name + ".png", size, warns))
        if kind == "stall": stalls.append(name + ".png")

    # 游戏按这个清单加载图片
    listed = sorted(f for f in os.listdir(OUT) if f.lower().endswith((".png", ".jpg")))
    io.open(os.path.join(GAME, "js", "assets.js"), "w", encoding="utf-8", newline="\n").write(
        "// 这个文件由 tools/process_art.py 自动生成,不要手改。assets/ 里有哪些图片,游戏就加载哪些。\nexport default [%s];\n" % ", ".join("'%s'" % f for f in listed))

    # 检查图:上排大图看细节,下排是游戏里的实际大小
    stalls = sorted(f for f in listed if f.startswith("stall_"))
    if stalls:
        n = len(stalls); sheet = Image.new("RGB", (max(1, n) * 170 + 10, 290), (26, 24, 44))
        for i, f in enumerate(stalls):
            im = Image.open(os.path.join(OUT, f)).convert("RGBA")
            big = im.resize((160, 160), Image.LANCZOS); sheet.paste(big, (10 + i * 170, 10), big)
            sm = im.resize((75, 75), Image.LANCZOS); sheet.paste(sm, (10 + i * 170 + 42, 195), sm)
        sheet.save(os.path.join(RAW, "_检查图.png"))

    # 界面检查图:图标按 128 / 40 / 20 像素各放一次;底图按游戏里常见的几种尺寸拉伸(放大两倍看),检查拉长后边和角是否自然
    icons = sorted(f for f in listed if f.startswith(("icon_", "perk_", "medal_", "owner_")))
    uis = sorted(f for f in listed if f.startswith("ui_"))
    if icons or uis:
        sheet = Image.new("RGB", (max(len(icons) * 140 + 10, 1060), 230 + len(uis) * 130), (26, 24, 44))
        for i, f in enumerate(icons):
            im = Image.open(os.path.join(OUT, f)).convert("RGBA"); x = 10 + i * 140
            sheet.paste(im, (x, 10), im)
            for sz, oy in ((40, 150), (20, 198)):
                sm = im.resize((sz, sz), Image.LANCZOS); sheet.paste(sm, (x + 64 - sz // 2, oy), sm)
        for j, f in enumerate(uis):
            im = Image.open(os.path.join(OUT, f)).convert("RGBA"); y = 235 + j * 130; x = 10; paper = f == "ui_paper.png"
            for w, h in ((52, 23), (84, 52), (300, 56)) if paper else ((52, 21), (84, 40), (300, 44)):
                d = max(6, min(14, min(w, h) / 8)) if paper else h / 4
                piece = nine_slice(im, w * 2, h * 2, d * 2, SLICE_X.get(f[:-4], SLICE)); sheet.paste(piece, (x, y), piece); x += w * 2 + 20
        sheet.save(os.path.join(RAW, "_检查图_界面.png"))

    print("处理了 %d 张原图,assets/ 里现在有 %d 个文件,共 %.0f KB" % (len(files), len(listed), sum(os.path.getsize(os.path.join(OUT, f)) for f in listed) / 1024))
    for src, dst, size, warns in rows:
        print("  %-28s → %-24s %5.0f KB" % (src, dst, size / 1024))
        for w in warns: print("      ! " + w)
    if not files: print("  art_raw/ 里还没有图片。把原图按命名规则放进去再运行。")


if __name__ == "__main__":
    main()
