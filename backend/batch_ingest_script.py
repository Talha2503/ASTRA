from app.core.database import SessionLocal
from app.services.ingestion import fetch_and_store_light_curve
import time

targets = ["Kepler-8", "Kepler-10", "Kepler-11", "Kepler-16", "Kepler-22", "Kepler-37", "Kepler-62", "Kepler-90", "Kepler-186", "Kepler-452"]

db = SessionLocal()

results = []
for t in targets:
    start = time.time()
    try:
        lc = fetch_and_store_light_curve(db, t, mission="Kepler")
        elapsed = round(time.time() - start, 1)
        print(t, "-> SUCCESS, id:", lc.id, ", n_points:", lc.meta["n_points"], ", took", elapsed, "sec")
        results.append({"target_id": t, "status": "success", "id": lc.id})
    except Exception as e:
        elapsed = round(time.time() - start, 1)
        print(t, "-> FAILED:", e, ", took", elapsed, "sec")
        results.append({"target_id": t, "status": "failed", "error": str(e)})

db.close()

print("\n--- Summary ---")
for r in results:
    print(r)