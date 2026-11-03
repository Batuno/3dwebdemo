# Renders the opening shot, overview and block cameras at each sun time, to renders/stills/<cameraId>/<HHMM>.jpg.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unreal  # noqa: E402
from bair_common import RENDERS, RenderChain, aim, load, render_camera, set_time, show_only_scene, ue, wanted, warm_up  # noqa: E402

WIDTH = int(os.environ.get("BAIR_WIDTH", "3840"))


def configure(config):
    config.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
    warm_up(config, 2, 4)


def task(name, shot, entry, camera):
    def prepare():
        show_only_scene()
        set_time(entry)
        position = ue(shot["pos"])
        aim(camera, position, ue(shot["target"]) - position, shot["fov"])

    return {
        "prepare": prepare,
        "label": "%s_%s" % (name, entry["key"]),
        "folder": os.path.join(RENDERS, "stills", name),
        "stem": entry["key"],
        "size": (WIDTH, WIDTH * 9 // 16),
    }


def main():
    shots = load("cameras.json")
    sun = load("sun.json")
    camera = render_camera()
    names = wanted("BAIR_ONLY", list(shots.keys()))
    keys = wanted("BAIR_TIMES", [t["key"] for t in sun["times"]])
    tasks = [task(n, shots[n], t, camera) for n in names for t in sun["times"] if t["key"] in keys]
    global chain
    chain = RenderChain(tasks, configure, "STILLS")
    chain.start()


main()
