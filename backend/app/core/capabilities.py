from importlib.util import find_spec

# The libraries that investigations and anomaly detection need. The slim server
# deployed for the public demo does not install them.
HEAVY_LIBRARIES = ("scipy", "astropy", "sklearn", "lightkurve")


def full_analysis_available() -> bool:
    return all(find_spec(name) is not None for name in HEAVY_LIBRARIES)