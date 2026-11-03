# Renders each unit type and its mirror from directly above, walls cut at 1.2 m in black with a white
# outline, by day and in the evening, to renders/topview/master/<unitType>[_mirror][_evening].jpg.
# apps/showroom/scripts/optimize-renders.mjs then makes the 4096 px web versions.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unreal  # noqa: E402
from bair_common import HERE, RENDERS, TOPVIEW_OFFSET, RenderChain, actors, actors_with_prefix, by_label, load, render_camera, set_exposure, set_time, show, wanted, warm_up  # noqa: E402

LONG_SIDE = int(os.environ.get("BAIR_WIDTH", "8192"))
# Daylight must read in plan whatever the real sun does at this hour, so light comes from a fixed high angle.
STUDIO_LIGHTS = 16.0
DAY = {"key": "day", "direction": [-0.35, 0.82, 0.45], "altitude": 55.0}
EVENING = {"key": "evening", "direction": [-0.35, 0.82, 0.45], "altitude": -12.0}


def configure(config):
    config.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
    warm_up(config, 2, 4)


def white_material():
    """The plan's own white outline, so the backdrop stays pure white in any light."""
    for actor in actors_with_prefix("Topview_"):
        comp = actor.get_component_by_class(unreal.StaticMeshComponent)
        for material in comp.get_materials():
            if material and "M_PlanOutline" in material.get_name():
                return material
    return None


def stand_ins(props, interiors):
    """Backdrop, fittings, and plants and figures for scale: your assets from topview_props.json, or simple shapes."""
    for old in actors_with_prefix("Prop_"):
        actors.destroy_actor(old)
    plate = actors.spawn_actor_from_object(unreal.load_asset("/Engine/BasicShapes/Plane"), unreal.Vector(TOPVIEW_OFFSET, 0, -20))
    plate.set_actor_label("Prop_Backdrop")
    plate.set_folder_path("Studio/Props")
    plate.set_actor_scale3d(unreal.Vector(400, 400, 1))
    white = white_material()
    if white:
        plate.get_component_by_class(unreal.StaticMeshComponent).set_material(0, white)
    made = {}
    shapes = {"plant": props.get("plantAsset") or "/Engine/BasicShapes/Sphere", "figure": props.get("figureAsset") or "/Engine/BasicShapes/Cylinder"}
    for type_id, unit in props["units"].items():
        made[type_id] = []
        for kind, items, height in (("plant", unit["plants"], 1.0), ("figure", [f["at"] for f in unit["figures"]], 1.7)):
            for i, at in enumerate(items):
                actor = actors.spawn_actor_from_object(unreal.load_asset(shapes[kind]), unreal.Vector(0, 0, height * 50.0))
                actor.set_actor_label("Prop_%s_%s_%d" % (type_id, kind, i))
                actor.set_folder_path("Studio/Props")
                if not props.get(kind + "Asset"):
                    actor.set_actor_scale3d(unreal.Vector(0.45, 0.45, height) if kind == "figure" else unreal.Vector(0.6, 0.6, 0.8))
                made[type_id].append((actor, at, height * 50.0, False))
        for i, light in enumerate(interiors[type_id]["lights"]):
            lamp = actors.spawn_actor_from_class(unreal.PointLight, unreal.Vector(0, 0, 0))
            lamp.set_actor_label("Prop_%s_light_%d" % (type_id, i))
            lamp.set_folder_path("Studio/Props")
            comp = lamp.get_component_by_class(unreal.PointLightComponent)
            comp.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
            comp.set_editor_property("intensity", STUDIO_LIGHTS)
            comp.set_editor_property("attenuation_radius", 500.0)
            comp.set_editor_property("use_temperature", True)
            comp.set_editor_property("temperature", float(light["kelvin"]))
            comp.set_editor_property("cast_shadows", False)
            p = light["position"]
            made[type_id].append((lamp, [p[0], p[2]], 110.0, True))
    return made


def task(type_id, mirrored, mood, info, camera, props):
    width = info["width"] * 100.0
    depth = info["depth"] * 100.0
    parts = actors_with_prefix("Topview_%s__" % type_id)
    suffix = "_mirror" if mirrored else ""
    suffix += "_evening" if mood["key"] == "evening" else ""

    def prepare():
        for a in actors_with_prefix("Topview_") + actors_with_prefix("Prop_"):
            show(a, False)
        scale = unreal.Vector(-1 if mirrored else 1, 1, 1)
        origin_x = TOPVIEW_OFFSET + (width if mirrored else 0.0)
        for a in parts:
            a.set_actor_location(unreal.Vector(origin_x, 0, 0), False, False)
            a.set_actor_scale3d(scale)
            show(a, True)
        evening = mood["key"] == "evening"
        show(by_label("Prop_Backdrop"), True)
        for actor, at, z, evening_only in props:
            x = at[0] * 100.0
            actor.set_actor_location(unreal.Vector(TOPVIEW_OFFSET + (width - x if mirrored else x), at[1] * 100.0, z), False, False)
            show(actor, evening or not evening_only)
            if evening_only:
                actor.get_component_by_class(unreal.PointLightComponent).set_visibility(evening)
        set_time(mood, False)
        # A plan must stay readable, so the shade is filled far more than a real room's would be.
        set_exposure(0.6 if evening else 1.2, 6500.0)
        sun = by_label("Bair_Sun").get_component_by_class(unreal.DirectionalLightComponent)
        sun.set_editor_property("intensity", 0.4 if evening else 1.8)
        sun.set_editor_property("cast_shadows", False)
        by_label("Bair_SkyLight").get_component_by_class(unreal.SkyLightComponent).set_editor_property("intensity", 0.6 if evening else 4.0)
        comp = camera.get_cine_camera_component()
        camera.set_actor_location_and_rotation(unreal.Vector(TOPVIEW_OFFSET + width / 2, depth / 2, 3000.0), unreal.Rotator(0, -90, -90), False, False)
        comp.set_editor_property("projection_mode", unreal.CameraProjectionMode.ORTHOGRAPHIC)
        comp.set_editor_property("ortho_width", width)

    if width >= depth:
        size = (LONG_SIDE, int(LONG_SIDE * depth / width))
    else:
        size = (int(LONG_SIDE * width / depth), LONG_SIDE)
    return {
        "prepare": prepare,
        "label": "%s%s" % (type_id, suffix),
        "folder": os.path.join(RENDERS, "topview", "master"),
        "stem": type_id + suffix,
        "size": size,
    }


def main():
    interiors = load("interiors.json")
    props = load("topview_props.json", HERE)
    camera = render_camera()
    made = stand_ins(props, interiors)
    types = wanted("BAIR_ONLY", list(interiors.keys()))
    tasks = []
    for type_id in types:
        for mirrored in (False, True):
            for mood in (DAY, EVENING):
                tasks.append(task(type_id, mirrored, mood, interiors[type_id], camera, made[type_id]))
    global chain
    chain = RenderChain(tasks, configure, "TOPVIEWS")
    chain.start()


main()
