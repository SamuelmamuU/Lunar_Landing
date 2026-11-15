"""Archivos de datos para el frontend (la UI calcula en el navegador sin servidor).

  ephem.bin / ephem.b64.json : Sol y Tierra vistos desde el centro de la Luna (MOON_ME, km), Float32 N x 6
  ephem.json                 : metadatos de la tabla
  sites.json                 : sitios con su máscara de horizonte (centésimas de grado)
"""
import base64
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import spiceypy as sp

from . import kernels
from .config import ABCORR, FRAME
from .horizon import mask_for
from .sites import load_sites


def export_frontend(out_dir: Path, start: str, end: str, step_min: int, h_obs_m: float) -> dict:
    label = kernels.load()
    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = datetime.fromisoformat(start).replace(tzinfo=timezone.utc)
    t1 = datetime.fromisoformat(end).replace(tzinfo=timezone.utc)
    n = int((t1 - t0) / timedelta(minutes=step_min)) + 1
    et0 = sp.str2et(t0.strftime("%Y-%m-%dT%H:%M:%S"))
    data = np.empty((n, 6))
    for i in range(n):
        et = et0 + i * step_min * 60.0
        data[i, :3] = sp.spkpos("SUN", et, FRAME, ABCORR, "MOON")[0]
        data[i, 3:] = sp.spkpos("EARTH", et, FRAME, ABCORR, "MOON")[0]
    raw = data.astype("<f4").tobytes()
    (out_dir / "ephem.bin").write_bytes(raw)
    (out_dir / "ephem.b64.json").write_text(json.dumps({"b64": base64.b64encode(raw).decode()}))
    meta = {"start_utc": t0.strftime("%Y-%m-%dT%H:%M:%SZ"), "step_min": step_min, "count": n,
            "frame": FRAME, "origin": "MOON", "abcorr": ABCORR, "units": "km", "kernels": label,
            "layout": ["sun_x", "sun_y", "sun_z", "earth_x", "earth_y", "earth_z"]}
    (out_dir / "ephem.json").write_text(json.dumps(meta, indent=2))

    sites = []
    for s in load_sites():
        m = mask_for(s, h_obs_m)
        sites.append({**s.to_dict(), "terrain": m.terrain, "z_m": m.z_m, "h_obs_m": h_obs_m,
                      "az_step_deg": m.step, "horizon_cdeg": [int(round(v * 100)) for v in m.deg]})
    (out_dir / "sites.json").write_text(json.dumps({"sites": sites}, ensure_ascii=False))
    return {"out_dir": str(out_dir), "ephem_rows": n, "sites": len(sites), "kernels": label}
