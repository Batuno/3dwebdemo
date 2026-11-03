# Lists everything that has been rendered, for the web app. Plain Python: runs inside or outside Unreal.
# Usage: python unreal/build_manifest.py [renders folder]
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT = os.path.join(os.path.dirname(HERE), "apps", "showroom", "public", "renders")
TIME = re.compile(r"^\d{4}$")


def images(folder):
    if not os.path.isdir(folder):
        return []
    return sorted(f for f in os.listdir(folder) if f.lower().endswith(".jpg"))


def panoramas(root):
    out = {}
    base = os.path.join(root, "pano")
    if not os.path.isdir(base):
        return out
    for spot in sorted(os.listdir(base)):
        names = images(os.path.join(base, spot))
        entry = {}
        for name in names:
            stem = name[:-4]
            if TIME.match(stem):
                entry[stem] = {"full": "pano/%s/%s" % (spot, name)}
                low = stem + "_low.jpg"
                if low in names:
                    entry[stem]["low"] = "pano/%s/%s" % (spot, low)
        if entry:
            out[spot] = entry
    return out


def stills(root):
    out = {}
    base = os.path.join(root, "stills")
    if not os.path.isdir(base):
        return out
    for camera in sorted(os.listdir(base)):
        entry = {n[:-4]: "stills/%s/%s" % (camera, n) for n in images(os.path.join(base, camera)) if TIME.match(n[:-4])}
        if entry:
            out[camera] = entry
    return out


def topviews(root):
    out = {}
    base = os.path.join(root, "topview")
    for name in images(base):
        stem = name[:-4]
        evening = stem.endswith("_evening")
        key = stem[: -len("_evening")] if evening else stem
        out.setdefault(key, {})["evening" if evening else "day"] = "topview/" + name
    for name in images(os.path.join(base, "master")):
        stem = name[:-4]
        if not stem.endswith("_evening"):
            out.setdefault(stem, {})["master"] = "topview/master/" + name
    return out


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BAIR_RENDERS", DEFAULT)
    manifest = {"version": 1, "panoramas": panoramas(root), "stills": stills(root), "topviews": topviews(root)}
    with open(os.path.join(root, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print("BAIR_MANIFEST %d panorama hotspots, %d still cameras, %d top views" % (len(manifest["panoramas"]), len(manifest["stills"]), len(manifest["topviews"])))


main()
