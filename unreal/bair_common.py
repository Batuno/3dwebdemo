# Shared by every script run inside the Unreal editor.
# glTF metres (x, y up, z) become Unreal centimetres (X = x, Y = z, Z = y).
import glob
import json
import math
import os
import unreal

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
EXPORT = os.environ.get("BAIR_EXPORT", os.path.join(REPO, "export"))
RENDERS = os.environ.get("BAIR_RENDERS", os.path.join(REPO, "apps", "showroom", "public", "renders"))
ROOT = "/Game/Bair"
MAP = ROOT + "/Maps/Main"
SEQUENCE = ROOT + "/Sequences/RenderCut"
TOPVIEW_OFFSET = 500000.0

MOON_DIRECTION = (-0.42, 0.82, 0.38)

actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)


def load(name, folder=EXPORT):
    with open(os.path.join(folder, name), encoding="utf-8") as f:
        return json.load(f)


def ue(p):
    return unreal.Vector(p[0] * 100.0, p[2] * 100.0, p[1] * 100.0)


def ue_dir(d):
    return unreal.Vector(d[0], d[2], d[1])


def look_along(direction):
    return unreal.MathLibrary.find_look_at_rotation(unreal.Vector(0, 0, 0), direction)


def by_label(label):
    for a in actors.get_all_level_actors():
        if a.get_actor_label() == label:
            return a
    return None


def actors_with_prefix(prefix):
    return [a for a in actors.get_all_level_actors() if a.get_actor_label().startswith(prefix)]


def show(actor, visible):
    actor.set_actor_hidden_in_game(not visible)
    actor.set_is_temporarily_hidden_in_editor(not visible)


def show_only_scene():
    """Everything real in place, nothing from the top-view studio."""
    for a in actors_with_prefix("Topview_") + actors_with_prefix("Prop_"):
        show(a, False)


def exposure_for(altitude, inside):
    """Exposure compensation in stops. Rooms are far darker than outdoors by day, and brighter at night."""
    if inside:
        return 3.4 if altitude > 6.0 else 1.0 if altitude > -4.0 else 0.8
    if altitude > 10.0:
        return 0.4
    if altitude > -1.0:
        return 5.0 - altitude * 0.45
    return 6.0


def set_exposure(stops, white_kelvin):
    volume = by_label("Bair_Post")
    settings = volume.settings
    # A higher white point warms the picture, offsetting the blue of sky-only light in the shade.
    settings.set_editor_property("override_white_temp", True)
    settings.set_editor_property("white_temp", white_kelvin)
    settings.set_editor_property("override_auto_exposure_method", True)
    settings.set_editor_property("auto_exposure_method", unreal.AutoExposureMethod.AEM_MANUAL)
    settings.set_editor_property("override_auto_exposure_apply_physical_camera_exposure", True)
    settings.set_editor_property("auto_exposure_apply_physical_camera_exposure", False)
    settings.set_editor_property("override_auto_exposure_bias", True)
    settings.set_editor_property("auto_exposure_bias", stops)
    volume.set_editor_property("settings", settings)


def warm_up(config, spatial, temporal):
    """Lumen and the sky capture need many frames to settle before a single image is kept."""
    samples = config.find_or_add_setting_by_class(unreal.MoviePipelineAntiAliasingSetting)
    samples.set_editor_property("spatial_sample_count", spatial)
    samples.set_editor_property("temporal_sample_count", temporal)
    samples.set_editor_property("engine_warm_up_count", 64)
    samples.set_editor_property("render_warm_up_count", 64)
    samples.set_editor_property("render_warm_up_frames", True)


def rgb(r, g, b):
    """unreal.Color takes its channels in the order b, g, r, so name them."""
    return unreal.Color(r=r, g=g, b=b, a=255)


def set_time(entry, inside=False):
    """Sets the sky from a sun.json entry. After dark the moon takes over and room lights come on."""
    daylight = entry["altitude"] > 6.0
    set_exposure(exposure_for(entry["altitude"], inside), 6800.0 if daylight else 6500.0)
    sun = by_label("Bair_Sun")
    alt = entry["altitude"]
    up = alt > -1.0
    to_light = ue_dir(entry["direction"] if up else MOON_DIRECTION)
    sun.set_actor_rotation(look_along(to_light * -1.0), False)
    comp = sun.get_component_by_class(unreal.DirectionalLightComponent)
    comp.set_editor_property("intensity", 10.0 * min(1.0, (alt + 1.0) / 10.0) if up else 0.25)
    comp.set_editor_property("cast_shadows", True)
    comp.set_editor_property("light_color", rgb(255, 244, 228) if alt > 12 else rgb(255, 190, 130) if up else rgb(142, 166, 216))
    # Full in the evening; by day a soft warm fill stands in for light bouncing around a real room.
    for lamp in actors_with_prefix("RoomLight_"):
        lamp.get_component_by_class(unreal.PointLightComponent).set_editor_property("intensity", 2.5 if alt < 6.0 else 0.2)
    # Tower windows light up from dusk, matching the web app.
    for lit in [a for a in actors_with_prefix("Floor_") if a.get_actor_label().endswith("_Lit")]:
        show(lit, alt < 6.0)
    sky = by_label("Bair_SkyLight")
    if sky:
        comp = sky.get_component_by_class(unreal.SkyLightComponent)
        comp.set_editor_property("intensity", (1.6 if inside else 1.0) if alt > 0 else 0.5)
        # Rooms take in sky light and warm bounce together, and sky alone reads too blue indoors.
        comp.set_editor_property("light_color", rgb(255, 246, 235) if inside and alt > 0 else rgb(255, 255, 255))


def render_camera():
    cam = by_label("Bair_RenderCam")
    if not cam:
        raise RuntimeError("Run import_scene.py first: Bair_RenderCam is missing from the level")
    return cam


def set_fov(cam, vertical_fov):
    comp = cam.get_cine_camera_component()
    filmback = comp.get_editor_property("filmback")
    comp.set_editor_property("current_focal_length", (filmback.sensor_height / 2.0) / math.tan(math.radians(vertical_fov) / 2.0))


def aim(cam, position, direction, vertical_fov=None):
    cam.set_actor_location_and_rotation(position, look_along(direction), False, False)
    if vertical_fov:
        set_fov(cam, vertical_fov)


def wanted(env, values):
    """BAIR_ONLY and BAIR_TIMES narrow a render to a comma-separated list, for test runs."""
    text = os.environ.get(env, "")
    if not text:
        return list(values)
    keep = set(x.strip() for x in text.split(","))
    return [v for v in values if v in keep]


def tidy(folder, stem):
    """Movie Render Queue adds a frame number and repeats outputs; keep one clean file."""
    found = sorted(glob.glob(os.path.join(folder, stem + "*.jpeg")) + glob.glob(os.path.join(folder, stem + "*.jpg")))
    final = os.path.join(folder, stem + ".jpg")
    if not found:
        unreal.log_warning("No output for " + final)
        return False
    keep = max(found, key=os.path.getmtime)
    if keep != final:
        if os.path.exists(final):
            os.remove(final)
        os.replace(keep, final)
    for extra in found[:-1]:
        if os.path.exists(extra) and extra != final:
            os.remove(extra)
    return True


class RenderChain:
    """Runs jobs one at a time. Each job changes the level first, so they cannot share one queue run."""

    def __init__(self, tasks, configure, name):
        self.tasks = list(tasks)
        self.configure = configure
        self.name = name
        self.total = len(self.tasks)
        self.done = 0
        self.current = None
        self.failed = 0
        self.subsystem = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)

    def start(self):
        unreal.log("%s: %d renders" % (self.name, self.total))
        self.next()

    def next(self):
        if not self.tasks:
            self.finish()
            return
        self.current = self.tasks.pop(0)
        # A failed render must not leave an old image looking like a new one.
        for stale in glob.glob(os.path.join(self.current["folder"], self.current["stem"] + "*.jp*g")):
            if not stale.endswith("_low.jpg"):
                os.remove(stale)
        self.current["prepare"]()
        levels.save_current_level()
        queue = self.subsystem.get_queue()
        queue.delete_all_jobs()
        job = queue.allocate_new_job(unreal.MoviePipelineExecutorJob)
        job.sequence = unreal.SoftObjectPath(SEQUENCE)
        job.map = unreal.SoftObjectPath(MAP)
        job.job_name = self.current["label"]
        config = job.get_configuration()
        output = config.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
        os.makedirs(self.current["folder"], exist_ok=True)
        output.output_directory = unreal.DirectoryPath(self.current["folder"].replace("\\", "/"))
        output.file_name_format = self.current["stem"]
        output.output_resolution = unreal.IntPoint(*self.current["size"])
        output.override_existing_output = True
        output.zero_pad_frame_numbers = 1
        config.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_JPG)
        self.configure(config)
        self.executor = self.subsystem.render_queue_with_executor(unreal.MoviePipelinePIEExecutor)
        self.executor.on_executor_finished_delegate.add_callable_unique(self.on_finished)

    def on_finished(self, executor, success):
        ok = bool(success) and tidy(self.current["folder"], self.current["stem"])
        self.done += 1
        if not ok:
            self.failed += 1
        unreal.log("%s %d/%d %s %s" % (self.name, self.done, self.total, self.current["label"], "ok" if ok else "FAILED"))
        # This callback fires while play mode is still closing, and the level can't be edited until it has.
        self.ticker = unreal.register_slate_post_tick_callback(self.when_idle)

    def when_idle(self, _delta):
        if self.subsystem.is_rendering() or levels.is_in_play_in_editor():
            return
        unreal.unregister_slate_post_tick_callback(self.ticker)
        self.next()

    def finish(self):
        status = "%s_DONE %d rendered, %d failed" % (self.name, self.total - self.failed, self.failed)
        unreal.log(status)
        with open(os.path.join(RENDERS, self.name.lower() + "_status.txt"), "w") as f:
            f.write(status)
        if os.environ.get("BAIR_QUIT"):
            unreal.SystemLibrary.quit_editor()
