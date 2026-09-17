import lightkurve as lk
import time

targets = ["Kepler-8", "Kepler-10", "Kepler-11", "Kepler-16", "Kepler-22", "Kepler-37", "Kepler-62", "Kepler-90", "Kepler-186", "Kepler-452"]

for t in targets:
    start = time.time()
    try:
        result = lk.search_lightcurve(t, mission="Kepler", cadence="long")
        print(t, "->", len(result), "products, took", round(time.time() - start, 1), "sec")
    except Exception as e:
        print(t, "-> ERROR:", e)