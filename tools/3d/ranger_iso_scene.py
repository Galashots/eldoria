"""Deterministic isometric render scene for the Eldoria Ranger (probe artifact).

Track 2(b) TRELLIS/Blender feasibility probe. This script is the "portability
keystone" described in tools/3D_ISO_SPRITE_PIPELINE.md §7: every camera, light,
material and pose knob is a constant at the top of this file, so re-running the
documented command reproduces byte-identical renders on any machine with the
pinned Blender build.

Scope (deliberately small): ONE character (Ranger / `adventurer` profile), FOUR
static isometric facings, and an optional FOUR-frame walk strip for one facing.
No attack, no equipment, no enemies, no eight-facing set.

The Ranger body here is a **scripted blockout**, not a finished character. It
exists to prove the *scene* — camera, facing math, lighting, alpha, foot pivot
and normalization — is correct and reproducible. Identity, palette and silhouette
cues are taken from docs/visual/eldoria-visual-north-star-v1.png (the crouching
Ranger in the pumpkin patch): brown tousled hair, green hooded cloak with gold
hem, brown leather jerkin and bracers, back quiver, slung bow, tall boots.

Pinned toolchain
----------------
Blender 4.2.22 LTS (build 2026-06-23). Blender 5.x does not start on this
machine; stay on 4.2 LTS. Renders are EEVEE Next with a Standard view transform
(NOT AgX/Filmic — a film curve would desaturate the pixel-art palette).

Reproduce
---------
  blender -b --python-exit-code 7 -P tools/3d/ranger_iso_scene.py -- \
      --out _probe_local/renders [--walk]

Outputs (supersampled source proof renders, RGBA, transparent background):
  <out>/source/adventurer-<engine>.png          for engine in right,down,left,up
  <out>/source/adventurer-right-walk-<n>.png    for n in 0..3   (--walk only)

tools/3d/normalize_ranger_proof.py turns those into the 64x64 engine-contract
PNGs; it is a separate step because Blender's bundled Python has no Pillow.
"""

import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

# ---------------------------------------------------------------------------
# 1. PROJECTION CONSTANTS (source of truth: docs/superpowers/specs/
#    2026-07-27-isometric-conversion-design.md §5 and tools/3D_ISO_SPRITE_PIPELINE.md §5E)
# ---------------------------------------------------------------------------

# The engine uses 64x32 diamond tiles (ISO_TW=64, ISO_TH=32) -> a 2:1 pixel-iso
# projection, NOT "true" 30-degree isometric. The matching camera elevation is
# atan(TH/TW) = atan(0.5) = 26.565 degrees. Azimuth is 45 degrees.
ISO_ELEVATION_DEG = math.degrees(math.atan(0.5))   # 26.565051177
ISO_AZIMUTH_DEG = 45.0

# Camera is ORTHOGRAPHIC. Perspective would break tile alignment.
CAMERA_TYPE = "ORTHO"
CAMERA_ORTHO_SCALE = 2.35          # world units across the square frame
CAMERA_DISTANCE = 16.0             # irrelevant to ortho framing; keeps clipping sane
CAMERA_TARGET_Z = 0.95             # aim at mid-body so the whole figure is in frame

# Supersample: render 8x the 64px target, downscale in the normalize step.
RENDER_SIZE = 512
TARGET_FRAME = 64

# Character is authored 1.90 world units tall with its feet on z = 0. The feet
# sitting on the world origin plane is what guarantees a shared foot pivot
# across every facing and every walk frame.
CHARACTER_HEIGHT = 1.90

# ---------------------------------------------------------------------------
# 2. FACING CONTRACT (source of truth: tools/3D_ISO_SPRITE_PIPELINE.md §5E table)
#
#    Engine slot | Grid dir | Iso facing | World heading the model must face
#    ------------+----------+------------+---------------------------------
#    right       | +col     | SE         | +X   (down-right, toward viewer)
#    down        | +row     | SW         | -Y   (down-left,  toward viewer)
#    left        | -col     | NW         | -X   (up-left,    away)
#    up          | -row     | NE         | +Y   (up-right,   away)
#
# The model is authored facing -Y at yaw 0, so `down` is the identity rotation.
# Camera sits at (+X, -Y, +Z), therefore `down` and `right` show the FACE and
# `up` and `left` show the BACK -- that is the sanity check in the pipeline doc.
# ---------------------------------------------------------------------------

FACINGS = [
    # (engine slot, iso view, root yaw degrees, expected read)
    ("right", "SE", 90.0, "face"),
    ("down", "SW", 0.0, "face"),
    ("left", "NW", -90.0, "back"),
    ("up", "NE", 180.0, "back"),
]

# ---------------------------------------------------------------------------
# 3. LIGHT RIG (source of truth: docs/VISUAL_NORTH_STAR.md -- "warm upper-left
#    light, down-right shadows"). Directions are expressed in SCREEN space and
#    converted to world space against the camera basis, so the key light stays
#    upper-left no matter what the camera constants are tuned to.
# ---------------------------------------------------------------------------

KEY_SCREEN_DIR = (-1.0, 1.0, 0.35)     # (screen-right, screen-up, toward-camera)
KEY_COLOR = (1.00, 0.94, 0.82)         # warm daylight
KEY_ENERGY = 5.4
KEY_ANGLE_DEG = 6.0                    # soft-ish sun for gentle terminator

FILL_SCREEN_DIR = (0.9, -0.25, 0.6)    # bounce from the down-right, cool
FILL_COLOR = (0.72, 0.80, 1.00)
FILL_ENERGY = 1.6
FILL_ANGLE_DEG = 45.0

RIM_SCREEN_DIR = (0.55, 0.85, -1.0)    # behind and above -> silhouette edge
RIM_COLOR = (0.85, 0.95, 1.00)
RIM_ENERGY = 2.6
RIM_ANGLE_DEG = 12.0

WORLD_AMBIENT = (0.30, 0.36, 0.44)     # keeps shadow sides readable, not black
WORLD_AMBIENT_STRENGTH = 0.45

# ---------------------------------------------------------------------------
# 4. PALETTE -- sampled from docs/visual/eldoria-visual-north-star-v1.png
#    (Ranger crop, full-image pixel coords noted per entry). Values are sRGB hex;
#    they are converted to linear for Blender below.
# ---------------------------------------------------------------------------

PALETTE = {
    "hair":      "6B4326",   # sampled 643A21 @ (1055,620), lifted off the shadow side
    "skin":      "E2A87C",   # sampled D98F50 @ (1063,647), lifted off the shadow side
    "cloak":     "4C7A35",   # lit green; sampled shadow 37521E @ (1100,690)
    "cloak_hem": "C9A24B",   # gold trim read from the hem highlight
    "leather":   "6B4527",   # jerkin / bracers
    "strap":     "7A4A18",   # quiver + belt straps (sampled 613409 @ (1122,672))
    "trouser":   "5C3C25",   # sampled directly @ (1063,725)
    "boot":      "4A3218",
    "eye":       "3E7ACB",
    "arrow":     "D9D2C4",   # fletching
    "bow":       "8A5A2E",
}

MATERIAL_ROUGHNESS = {
    "hair": 0.80, "skin": 0.72, "cloak": 0.85, "cloak_hem": 0.42,
    "leather": 0.62, "strap": 0.58, "trouser": 0.85, "boot": 0.55,
    "eye": 0.25, "arrow": 0.80, "bow": 0.60,
}

# ---------------------------------------------------------------------------
# 5. WALK CYCLE -- 4 display frames, matching WALK_FRAME_MS=110 in index.html.
#    Phase 0 and 2 are the contact poses, 1 and 3 the passing poses.
# ---------------------------------------------------------------------------

WALK_FRAMES = 4
WALK_LEG_SWING_DEG = 22.0
WALK_ARM_SWING_DEG = 16.0
WALK_BOB = 0.030            # world units of vertical body bob


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgba(value):
    r, g, b = (int(value[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects,
                  bpy.data.lights, bpy.data.cameras):
        for item in list(block):
            block.remove(item)


def make_material(name):
    mat = bpy.data.materials.new(f"ranger_{name}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hex_rgba(PALETTE[name])
    bsdf.inputs["Roughness"].default_value = MATERIAL_ROUGHNESS[name]
    # Kill metallic/specular sheen: this is stylised matte art, not PBR product viz.
    bsdf.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs:          # Blender 4.x naming
        bsdf.inputs["Specular IOR Level"].default_value = 0.25
    return mat


MATERIALS = {}


def shade(obj, name):
    obj.data.materials.append(MATERIALS[name])
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def smooth(obj, levels=2):
    mod = obj.modifiers.new("subsurf", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    return obj


def add_cube(name, size, location, material, subsurf=2):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    if subsurf:
        smooth(obj, subsurf)
    return shade(obj, material)


def add_sphere(name, radius, location, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=location,
                                         segments=24, ring_count=16)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return shade(obj, material)


def add_cylinder(name, radius, depth, location, material, rotation=(0, 0, 0),
                 scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth,
                                        location=location, rotation=rotation,
                                        vertices=20)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return shade(obj, material)


def add_torus(name, major, minor, location, material, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     location=location, rotation=rotation,
                                     major_segments=32, minor_segments=8)
    obj = bpy.context.object
    obj.name = name
    return shade(obj, material)


def add_cape(name, rings, material, thickness=0.012):
    """Parametric back-drape cape: an open shell wrapping the back ~260 degrees.

    `rings` is a list of (z, radius) from the shoulders down to the hem. The
    shell is open at the FRONT so the jerkin, belt and legs stay readable in the
    SE/SW facings -- a closed cone would swallow the whole silhouette.
    """
    span = math.radians(105.0)          # +/- from straight-back (+Y)
    steps = 24
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    grid = []
    for z, radius in rings:
        row = []
        for i in range(steps + 1):
            theta = -span + (2 * span) * i / steps
            # theta measured from +Y (the character's back)
            row.append(bm.verts.new((radius * math.sin(theta),
                                     radius * math.cos(theta), z)))
        grid.append(row)
    bm.verts.ensure_lookup_table()
    for r in range(len(grid) - 1):
        for i in range(steps):
            bm.faces.new((grid[r][i], grid[r][i + 1],
                          grid[r + 1][i + 1], grid[r + 1][i]))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    solid = obj.modifiers.new("solidify", "SOLIDIFY")
    solid.thickness = thickness
    solid.offset = 0.0
    smooth(obj, 1)
    return shade(obj, material)


# ---------------------------------------------------------------------------
# 6. THE RANGER BLOCKOUT
#     Authored facing -Y. Proportions ~3.7 heads: the North Star heroes read as
#     stylised kids, not realistic adults, and the Ranger must stay clearly
#     OLDER than the Mage without becoming an over-armoured adult.
# ---------------------------------------------------------------------------

def build_ranger():
    parts = {}
    root = bpy.data.objects.new("ranger_root", None)
    bpy.context.collection.objects.link(root)

    body = bpy.data.objects.new("ranger_body", None)   # bobs during the walk
    bpy.context.collection.objects.link(body)
    body.parent = root

    def attach(obj, parent=None):
        obj.parent = parent or body
        return obj

    # --- legs / boots -----------------------------------------------------
    for side, sx in (("l", -1), ("r", 1)):
        hip = bpy.data.objects.new(f"hip_{side}", None)   # rotation pivot
        bpy.context.collection.objects.link(hip)
        hip.location = (0.098 * sx, 0.0, 0.90)
        attach(hip)
        parts[f"leg_{side}"] = hip

        leg = add_cylinder(f"leg_{side}", 0.072, 0.62, (0, 0, -0.31), "trouser")
        attach(leg, hip)
        boot = add_cube(f"boot_{side}", (0.115, 0.185, 0.155), (0, -0.022, -0.70), "boot")
        attach(boot, hip)
        cuff = add_torus(f"cuff_{side}", 0.082, 0.022, (0, 0, -0.50), "strap",
                         rotation=(0, 0, 0))
        attach(cuff, hip)

    # --- hips / torso -----------------------------------------------------
    attach(add_cube("hips", (0.30, 0.20, 0.16), (0, 0, 0.93), "trouser"))
    attach(add_cube("torso", (0.36, 0.235, 0.46), (0, 0, 1.16), "leather"))
    attach(add_torus("belt", 0.185, 0.030, (0, 0, 0.985), "strap"))
    attach(add_cube("pouch", (0.085, 0.055, 0.085), (0.14, -0.10, 0.95), "strap"))
    # chest strap for the quiver -- reads as a diagonal dark line at 64px
    attach(add_torus("baldric", 0.185, 0.020, (0, 0, 1.18), "strap",
                     rotation=(0, math.radians(28), 0)))

    # --- arms -------------------------------------------------------------
    for side, sx in (("l", -1), ("r", 1)):
        shoulder = bpy.data.objects.new(f"shoulder_{side}", None)
        bpy.context.collection.objects.link(shoulder)
        # Corrective pass: arms pushed outboard of the cloak edge (cape half-width
        # is ~0.215 at shoulder height) and canted out, so the bracers and hands
        # survive the 64px downscale instead of hiding inside the drape.
        shoulder.location = (0.238 * sx, -0.020, 1.34)
        shoulder.rotation_euler = (0, math.radians(9 * sx), 0)
        attach(shoulder)
        parts[f"arm_{side}"] = shoulder

        upper = add_cylinder(f"arm_{side}", 0.056, 0.40, (0, 0, -0.20), "leather")
        attach(upper, shoulder)
        # bracer -- a Ranger cue from the North Star, not full armour
        bracer = add_cylinder(f"bracer_{side}", 0.064, 0.13, (0, 0, -0.33), "strap")
        attach(bracer, shoulder)
        hand = add_sphere(f"hand_{side}", 0.062, (0, 0, -0.42), "skin")
        attach(hand, shoulder)

    # --- head -------------------------------------------------------------
    attach(add_cylinder("neck", 0.075, 0.10, (0, 0, 1.42), "skin"))
    head = attach(add_sphere("head", 0.255, (0, 0, 1.63), "skin", scale=(1.0, 0.96, 1.06)))
    parts["head"] = head

    # Hair sits just proud of the skull and slightly back, so the face pokes
    # through at the front-bottom instead of being swallowed by the cap.
    attach(add_sphere("hair_cap", 0.278, (0, 0.035, 1.685), "hair", scale=(1.02, 1.0, 0.94)))
    # Corrective pass: the first fringe sphere projected forward as a beak. It
    # now hugs the brow, and the tufts are flatter so they read as tousled hair
    # rather than horns.
    attach(add_sphere("hair_fringe", 0.115, (0, -0.135, 1.745), "hair",
                      scale=(1.55, 0.85, 0.42)))
    for i, (tx, ty, tz, tilt) in enumerate((
            (-0.11, 0.01, 1.845, -22), (0.05, 0.06, 1.855, 14), (0.15, -0.03, 1.815, 30))):
        tuft = add_sphere(f"tuft_{i}", 0.062, (tx, ty, tz), "hair",
                          scale=(1.0, 1.15, 0.55))
        tuft.rotation_euler = (0, math.radians(tilt), math.radians(tilt * 0.5))
        attach(tuft)

    for side, sx in (("l", -1), ("r", 1)):
        attach(add_sphere(f"eye_{side}", 0.040, (0.085 * sx, -0.225, 1.655), "eye",
                          scale=(0.85, 0.6, 1.15)))

    # --- cloak + hood -----------------------------------------------------
    # Corrective pass: the first render made the cloak a bell that swallowed the
    # arms, legs and belt. Hem raised to knee height and the flare cut back so
    # the boots, bracers and pouch stay in the 64px silhouette.
    cape = add_cape("cloak", [(1.40, 0.200), (1.22, 0.223), (1.00, 0.252),
                              (0.82, 0.278), (0.70, 0.292)], "cloak")
    attach(cape)
    hem = add_cape("cloak_hem", [(0.735, 0.288), (0.70, 0.294)], "cloak_hem",
                   thickness=0.018)
    attach(hem)
    attach(add_sphere("hood", 0.185, (0, 0.185, 1.44), "cloak", scale=(1.25, 1.0, 0.9)))
    attach(add_torus("collar", 0.145, 0.028, (0, 0.045, 1.415), "cloak_hem",
                     rotation=(math.radians(8), 0, 0)))

    # --- quiver + arrows (over the right shoulder, per the North Star) -----
    q_rot = (math.radians(-16), math.radians(-20), 0)
    attach(add_cylinder("quiver", 0.072, 0.44, (0.145, 0.215, 1.20), "strap",
                        rotation=q_rot))
    for i, (ax, az) in enumerate(((-0.035, 0.0), (0.0, 0.02), (0.035, -0.01))):
        attach(add_cylinder(f"arrow_{i}", 0.009, 0.30, (0.185 + ax, 0.235, 1.50 + az),
                            "bow", rotation=q_rot))
        attach(add_cube(f"fletch_{i}", (0.014, 0.030, 0.075),
                        (0.196 + ax, 0.240, 1.58 + az), "arrow", subsurf=0))

    # --- bow slung across the back ---------------------------------------
    # Corrective pass: the bow was a thin wire hoop reading as noise. Smaller,
    # thicker, and lifted onto the shoulder line so it reads as a slung bow.
    attach(add_torus("bow", 0.265, 0.021, (-0.105, 0.235, 1.24), "bow",
                     rotation=(math.radians(90), 0, math.radians(-30))))

    parts["root"] = root
    parts["body"] = body
    return parts


# ---------------------------------------------------------------------------
# 7. CAMERA + LIGHTS
# ---------------------------------------------------------------------------

def camera_basis():
    """World-space (right, up, toward-camera) unit vectors for the iso camera."""
    elev = math.radians(ISO_ELEVATION_DEG)
    azim = math.radians(ISO_AZIMUTH_DEG)
    # Camera sits at (+X, -Y, +Z); view direction points back at the target.
    view = Vector((-math.cos(elev) * math.sin(azim),
                   math.cos(elev) * math.cos(azim),
                   -math.sin(elev))).normalized()
    right = view.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(view).normalized()
    return right, up, -view


def setup_camera():
    right, up, toward = camera_basis()
    target = Vector((0, 0, CAMERA_TARGET_Z))
    cam_data = bpy.data.cameras.new("iso_cam")
    cam_data.type = CAMERA_TYPE
    cam_data.ortho_scale = CAMERA_ORTHO_SCALE
    cam_data.clip_start = 0.1
    cam_data.clip_end = CAMERA_DISTANCE * 4
    cam = bpy.data.objects.new("iso_cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = target + toward * CAMERA_DISTANCE
    cam.rotation_euler = (math.radians(90.0 - ISO_ELEVATION_DEG), 0.0,
                          math.radians(ISO_AZIMUTH_DEG))
    bpy.context.scene.camera = cam
    return cam


def add_sun(name, screen_dir, color, energy, angle_deg):
    right, up, toward = camera_basis()
    direction = (right * screen_dir[0] + up * screen_dir[1] + toward * screen_dir[2])
    direction.normalize()
    data = bpy.data.lights.new(name, "SUN")
    data.color = color
    data.energy = energy
    data.angle = math.radians(angle_deg)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = Vector((0, 0, CAMERA_TARGET_Z)) + direction * 10.0
    # Point the sun back at the character.
    obj.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    return obj


def setup_lights():
    add_sun("key", KEY_SCREEN_DIR, KEY_COLOR, KEY_ENERGY, KEY_ANGLE_DEG)
    add_sun("fill", FILL_SCREEN_DIR, FILL_COLOR, FILL_ENERGY, FILL_ANGLE_DEG)
    add_sun("rim", RIM_SCREEN_DIR, RIM_COLOR, RIM_ENERGY, RIM_ANGLE_DEG)

    world = bpy.data.worlds.new("iso_world")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*[srgb_to_linear(c) for c in WORLD_AMBIENT], 1.0)
    bg.inputs["Strength"].default_value = WORLD_AMBIENT_STRENGTH
    bpy.context.scene.world = world


def setup_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = RENDER_SIZE
    scene.render.resolution_y = RENDER_SIZE
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True          # transparent background
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    # Standard, NOT AgX -- a film curve would wash out the pixel-art palette.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.eevee.taa_render_samples = 64
    if hasattr(scene.eevee, "use_shadows"):
        scene.eevee.use_shadows = True
    if hasattr(scene.eevee, "use_raytracing"):
        scene.eevee.use_raytracing = True


# ---------------------------------------------------------------------------
# 8. POSE + RENDER
# ---------------------------------------------------------------------------

def set_walk_pose(parts, frame_index):
    """Deterministic 4-frame walk: contact, pass, contact (mirrored), pass."""
    phase = 2.0 * math.pi * frame_index / WALK_FRAMES
    swing = math.sin(phase)
    parts["leg_l"].rotation_euler = (math.radians(WALK_LEG_SWING_DEG * swing), 0, 0)
    parts["leg_r"].rotation_euler = (math.radians(-WALK_LEG_SWING_DEG * swing), 0, 0)
    parts["arm_l"].rotation_euler = (math.radians(-WALK_ARM_SWING_DEG * swing), 0, 0)
    parts["arm_r"].rotation_euler = (math.radians(WALK_ARM_SWING_DEG * swing), 0, 0)
    # Body rises on the passing poses (frames 1 and 3), lowest on contact.
    parts["body"].location = (0, 0, WALK_BOB * abs(swing))


def clear_pose(parts):
    for key in ("leg_l", "leg_r", "arm_l", "arm_r"):
        parts[key].rotation_euler = (0, 0, 0)
    parts["body"].location = (0, 0, 0)


def render_to(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="output directory for source renders")
    ap.add_argument("--walk", action="store_true",
                    help="also render the 4-frame walk proof for the SE facing")
    args = ap.parse_args(argv)

    out_dir = os.path.join(os.path.abspath(args.out), "source")
    os.makedirs(out_dir, exist_ok=True)

    reset_scene()
    for name in PALETTE:
        MATERIALS[name] = make_material(name)
    parts = build_ranger()
    setup_camera()
    setup_lights()
    setup_render()

    print(f"[iso] elevation={ISO_ELEVATION_DEG:.6f} azimuth={ISO_AZIMUTH_DEG} "
          f"ortho_scale={CAMERA_ORTHO_SCALE} render={RENDER_SIZE}x{RENDER_SIZE}")

    clear_pose(parts)
    for engine, view, yaw, expected in FACINGS:
        parts["root"].rotation_euler = (0, 0, math.radians(yaw))
        target = os.path.join(out_dir, f"adventurer-{engine}.png")
        print(f"[iso] {engine:5s} -> {view}  yaw={yaw:+7.1f}  expect={expected}")
        render_to(target)

    if args.walk:
        walk_engine, _, walk_yaw, _ = FACINGS[0]        # right / SE
        parts["root"].rotation_euler = (0, 0, math.radians(walk_yaw))
        for i in range(WALK_FRAMES):
            set_walk_pose(parts, i)
            print(f"[iso] walk {walk_engine} frame {i}")
            render_to(os.path.join(out_dir, f"adventurer-{walk_engine}-walk-{i}.png"))
        clear_pose(parts)

    print(f"[iso] done -> {out_dir}")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    main(argv)
