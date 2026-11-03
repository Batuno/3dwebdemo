# Imports export/*.glb, applies material_map.json, and builds the level everything renders from.
import glob
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import unreal  # noqa: E402
from bair_common import EXPORT, HERE, MAP, ROOT, SEQUENCE, TOPVIEW_OFFSET, actors, levels, load, ue  # noqa: E402

library = unreal.EditorAssetLibrary
tools = unreal.AssetToolsHelpers.get_asset_tools()


def import_glb(path):
    stem = os.path.splitext(os.path.basename(path))[0]
    dest = "%s/%s" % (ROOT, stem)
    task = unreal.AssetImportTask()
    task.filename = path
    task.destination_path = dest
    task.automated = True
    task.save = True
    task.replace_existing = True
    tools.import_asset_tasks([task])
    library.save_directory(dest)
    return stem, dest


def meshes_in(folder):
    found = []
    for path in library.list_assets(folder, recursive=True):
        asset = library.load_asset(path)
        if isinstance(asset, unreal.StaticMesh):
            found.append(asset)
    return found


WINDOW_GLOW = unreal.LinearColor(0.04, 0.03, 0.019, 1.0)


def tune(mesh, material_map):
    # Nanite needs a DX12 SM6 machine, and these meshes are light enough without it.
    settings = mesh.get_editor_property("nanite_settings")
    if settings.enabled:
        settings.enabled = False
        mesh.set_editor_property("nanite_settings", settings)
    for i, slot in enumerate(mesh.get_editor_property("static_materials")):
        current = slot.material_interface.get_name() if slot.material_interface else ""
        # Reimporting keeps a material instance's old values, so the window glow is set here.
        if "M_WindowLit" in current:
            unreal.MaterialEditingLibrary.set_material_instance_vector_parameter_value(slot.material_interface, "EmissiveFactor", WINDOW_GLOW)
        for key, target in material_map.items():
            if target and key in current:
                replacement = library.load_asset(target)
                if replacement:
                    mesh.set_material(i, replacement)
                else:
                    unreal.log_warning("material_map: %s not found" % target)
                break


def place(mesh, location, rotation, folder):
    actor = actors.spawn_actor_from_object(mesh, location, rotation)
    actor.set_actor_label(mesh.get_name())
    actor.set_folder_path(folder)
    return actor


def add_sky():
    sun = actors.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 100000))
    sun.set_actor_label("Bair_Sun")
    comp = sun.get_component_by_class(unreal.DirectionalLightComponent)
    comp.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    comp.set_editor_property("atmosphere_sun_light", True)
    atmosphere = actors.spawn_actor_from_class(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0))
    atmosphere.set_actor_label("Bair_Atmosphere")
    sky = actors.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 500))
    sky.set_actor_label("Bair_SkyLight")
    sc = sky.get_component_by_class(unreal.SkyLightComponent)
    sc.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
    sc.set_editor_property("real_time_capture", True)
    fog = actors.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0))
    fog.set_actor_label("Bair_Haze")
    fc = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    fc.set_editor_property("fog_density", 0.004)
    fc.set_editor_property("fog_height_falloff", 0.05)
    pp = actors.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0))
    pp.set_actor_label("Bair_Post")
    pp.set_editor_property("unbound", True)
    for a in (sun, atmosphere, sky, fog, pp):
        a.set_folder_path("Lighting")


def add_room_lights(hotspots, interiors):
    for type_id, placement in hotspots["placements"].items():
        origin = ue(placement["origin"])
        yaw = math.radians(-placement["rotYDeg"])
        for i, light in enumerate(interiors[type_id]["lights"]):
            local = ue(light["position"])
            world = origin + unreal.Vector(
                local.x * math.cos(yaw) - local.y * math.sin(yaw),
                local.x * math.sin(yaw) + local.y * math.cos(yaw),
                local.z,
            )
            lamp = actors.spawn_actor_from_class(unreal.PointLight, world)
            lamp.set_actor_label("RoomLight_%s_%d" % (type_id, i))
            lamp.set_folder_path("Interiors/%s/Lights" % type_id)
            comp = lamp.get_component_by_class(unreal.PointLightComponent)
            comp.set_editor_property("mobility", unreal.ComponentMobility.MOVABLE)
            comp.set_editor_property("intensity", 2.5)
            comp.set_editor_property("attenuation_radius", 450.0)
            comp.set_editor_property("use_temperature", True)
            comp.set_editor_property("temperature", float(light["kelvin"]))
            comp.set_editor_property("cast_shadows", False)


def build_sequence(camera):
    path, name = SEQUENCE.rsplit("/", 1)
    if library.does_asset_exist(SEQUENCE):
        library.delete_asset(SEQUENCE)
    sequence = tools.create_asset(name, path, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    sequence.set_display_rate(unreal.FrameRate(24, 1))
    sequence.set_playback_start(0)
    sequence.set_playback_end(1)
    binding = sequence.add_possessable(camera)
    track = sequence.add_track(unreal.MovieSceneCameraCutTrack)
    section = track.add_section()
    section.set_range(0, 1)
    section.set_camera_binding_id(unreal.MovieSceneSequenceExtensions.get_binding_id(sequence, binding))
    library.save_loaded_asset(sequence)


def main():
    material_map = load("material_map.json", HERE)["materials"]
    hotspots = load("hotspots.json")
    interiors = load("interiors.json")
    groups = {}
    # BAIR_KEEP_IMPORTS=1 rebuilds the level from meshes already in the project, which takes seconds.
    keep = os.environ.get("BAIR_KEEP_IMPORTS")
    for path in sorted(glob.glob(os.path.join(EXPORT, "*.glb"))):
        if keep:
            stem = os.path.splitext(os.path.basename(path))[0]
            dest = "%s/%s" % (ROOT, stem)
        else:
            stem, dest = import_glb(path)
        meshes = meshes_in(dest)
        for mesh in meshes:
            tune(mesh, material_map)
        library.save_directory(dest)
        groups[stem] = meshes
        unreal.log("BAIR_IMPORT %s: %d meshes" % (stem, len(meshes)))

    if library.does_asset_exist(MAP):
        levels.load_level(MAP)
        actors.destroy_actors(actors.get_all_level_actors())
    else:
        levels.new_level(MAP)
    zero = unreal.Vector(0, 0, 0)
    upright = unreal.Rotator(0, 0, 0)
    for stem, meshes in groups.items():
        if stem == "site" or stem.startswith("block_"):
            for mesh in meshes:
                place(mesh, zero, upright, "Site/" + stem)
        elif stem.startswith("interior_"):
            placement = hotspots["placements"][stem[len("interior_"):]]
            for mesh in meshes:
                place(mesh, ue(placement["origin"]), unreal.Rotator(0, 0, -placement["rotYDeg"]), "Interiors/" + stem)
        elif stem.startswith("topview_"):
            for mesh in meshes:
                actor = place(mesh, unreal.Vector(TOPVIEW_OFFSET, 0, 0), upright, "Studio/" + stem)
                actor.set_actor_label("Topview_%s__%s" % (stem[len("topview_"):], mesh.get_name()))
    add_sky()
    add_room_lights(hotspots, interiors)

    camera = actors.spawn_actor_from_class(unreal.CineCameraActor, zero)
    camera.set_actor_label("Bair_RenderCam")
    camera.set_folder_path("Cameras")
    levels.save_current_level()
    build_sequence(camera)
    levels.save_current_level()
    unreal.log("BAIR_IMPORT_DONE")
    if os.environ.get("BAIR_QUIT"):
        unreal.SystemLibrary.quit_editor()


main()
