# Renders a 360° panorama for each hotspot at each sun time, to renders/pano/<hotspotId>/<HHMM>.jpg.
# Test run: BAIR_ONLY=4R_living-1 BAIR_TIMES=1200 BAIR_WIDTH=2048
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unreal  # noqa: E402
from bair_common import RENDERS, RenderChain, actors_with_prefix, aim, load, render_camera, set_time, show, show_only_scene, ue, ue_dir, wanted, warm_up  # noqa: E402

WIDTH = int(os.environ.get("BAIR_WIDTH", "6144"))


def configure(config):
    # The camera faces the image centre, so following its orientation keeps plan north in the middle.
    panorama = config.find_or_add_setting_by_class(unreal.MoviePipelinePanoramicPass)
    panorama.set_editor_property("num_horizontal_steps", 8)
    panorama.set_editor_property("num_vertical_steps", 3)
    panorama.set_editor_property("follow_camera_orientation", True)
    # Lumen needs frame history, and without its own per pane it returns no indirect or sky light at all.
    panorama.set_editor_property("allocate_history_per_pane", True)
    warm_up(config, 2, 1)


def task(hotspot, entry, camera, floors):
    def prepare():
        show_only_scene()
        set_time(entry, hotspot["scope"] == "interior")
        # The flat replaces its storey's facade, whose window glass is opaque in the export.
        for floor in floors:
            show(floor, hotspot["scope"] != "interior")
        aim(camera, ue(hotspot["position"]), ue_dir(hotspot["panoramaNorth"]))

    return {
        "prepare": prepare,
        "label": "%s_%s" % (hotspot["id"], entry["key"]),
        "folder": os.path.join(RENDERS, "pano", hotspot["id"]),
        "stem": entry["key"],
        "size": (WIDTH, WIDTH // 2),
    }


def main():
    spots = load("hotspots.json")
    sun = load("sun.json")
    camera = render_camera()
    ids = wanted("BAIR_ONLY", [h["id"] for h in spots["hotspots"] if h["panorama"]])
    keys = wanted("BAIR_TIMES", [t["key"] for t in sun["times"]])
    storey = next(iter(spots["placements"].values()))
    floors = actors_with_prefix("Floor_%s_%d" % (storey["block"], storey["storey"]))
    tasks = [task(h, t, camera, floors) for h in spots["hotspots"] if h["id"] in ids for t in sun["times"] if t["key"] in keys]
    global chain
    chain = RenderChain(tasks, configure, "PANORAMAS")
    chain.start()


main()
