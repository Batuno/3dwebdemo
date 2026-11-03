# Adds a CineCameraActor for every hotspot and named camera, for setting up shots by hand.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unreal  # noqa: E402
from bair_common import actors, actors_with_prefix, aim, levels, load, ue, ue_dir  # noqa: E402


def spawn(label, folder, position, direction, fov):
    cam = actors.spawn_actor_from_class(unreal.CineCameraActor, position)
    cam.set_actor_label(label)
    cam.set_folder_path(folder)
    aim(cam, position, direction, fov)


def main():
    for old in actors_with_prefix("CAM_"):
        actors.destroy_actor(old)
    for h in load("hotspots.json")["hotspots"]:
        spawn("CAM_" + h["id"], "Cameras/" + h["scope"], ue(h["position"]), ue_dir(h["direction"]), h["fov"])
    for name, shot in load("cameras.json").items():
        position = ue(shot["pos"])
        target = ue(shot["target"])
        spawn("CAM_" + name, "Cameras/Shots", position, target - position, shot["fov"])
    levels.save_current_level()
    unreal.log("BAIR_CAMERAS_DONE %d" % len(actors_with_prefix("CAM_")))
    if os.environ.get("BAIR_QUIT"):
        unreal.SystemLibrary.quit_editor()


main()
