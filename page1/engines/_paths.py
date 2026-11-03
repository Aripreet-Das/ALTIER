"""
ALTIER · page1/engines/_paths.py
--------------------------------
Makes the EXISTING face-parsing modules importable from page1 without copying them.

face-parsing/ is vendored from an upstream repo, not written here. parse_face.py, colorimetry.py,
contrast_engine.py and palette_engine.py live there and import each other by bare module name
(`import colorimetry`, `from contrast_engine import ...`). Copying them into page1/ would fork
them: two colour engines drifting apart is the failure mode this file exists to prevent. So we
put that directory on sys.path instead and import the originals. There is one colorimetry.py in
this project and it stays there.

WHY cv-service/ IS ONLY EVER APPENDED
    page1 needs three modules from cv-service/: body_geometry.py (imported by name, because a
    spawned child has to re-import it), and gemini_util.py / face_shape.py (loaded by absolute
    file path). body_geometry is the reason the directory goes on sys.path at all.

    Ours goes on at index 0 and cv-service/ is appended, so face-parsing/ wins every name
    collision. That matters because a sibling cv-service checkout can ship its own
    `contrast_engine.py` — the older Rec.601-luma version, with no `coloring_contrast` in it.
    With an insert, `from contrast_engine import coloring_contrast` would resolve by whichever
    directory happened to come first; with an append it cannot.
"""

import importlib.util
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
ALTIER_ROOT = os.path.dirname(os.path.dirname(_HERE))          # repo root
PAGE1_ROOT = os.path.dirname(_HERE)                            # <repo>/page1
FACE_PARSING = os.path.join(ALTIER_ROOT, "face-parsing")

#: Where the CV service lives. It ships INSIDE this repo at cv-service/, holding the two
#: modules page 1 reuses (body_geometry.py and gemini_util.py). The older two-directory
#: checkout kept it beside the project instead, so fall back to the sibling location.
CV_SERVICE = os.path.join(ALTIER_ROOT, "cv-service")
if not os.path.isdir(CV_SERVICE):
    CV_SERVICE = os.path.join(os.path.dirname(ALTIER_ROOT), "cv-service")

DEFAULT_FACE_MODEL = os.path.join(FACE_PARSING, "weights", "resnet34.onnx")


def install():
    """Put face-parsing/ on sys.path so its modules import each other as they expect.
    Idempotent, and safe to call from any engine."""
    if os.path.isdir(FACE_PARSING) and FACE_PARSING not in sys.path:
        sys.path.insert(0, FACE_PARSING)


def load_module_from(path, name):
    """Import a single .py file by absolute path, WITHOUT putting its directory on sys.path.

    Used for cv-service/gemini_util.py. Returns None if the file is not there, because a
    missing helper should degrade the feature that wanted it, not break the import graph."""
    if not os.path.isfile(path):
        return None
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


install()


def install_cv_service():
    """APPEND cv-service/ to sys.path, for body_geometry.py only. Returns True if it is there.

    Appended, never inserted, and the two reasons matter:

      1. PRECEDENCE. face-parsing/ sits at index 0, so it wins every name collision — notably
         `contrast_engine`, which a sibling cv-service checkout may also define. Ours must win.
         Appending makes that a guarantee rather than a race between whichever engine happened
         to import first.

      2. THE SUBPROCESS. body_geometry.extract_geometry() runs MediaPipe in a spawned child
         (a native abort there kills the child instead of the API). multiprocessing's spawn
         start method ships the parent's sys.path to that child so it can re-import the module
         holding the worker function. Loading body_geometry by file path instead — the way
         gemini_util is loaded — would leave the child unable to find it, and the isolation
         that makes the module safe would break on first use.
    """
    if not os.path.isdir(CV_SERVICE):
        return False
    if CV_SERVICE not in sys.path:
        sys.path.append(CV_SERVICE)
    return True
