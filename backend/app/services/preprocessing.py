import numpy as np


def clean_light_curve(time_data, flux_data, flux_err_data=None):
    """Remove NaNs and non-finite values, keeping arrays aligned."""
    time = np.array(time_data, dtype=float)
    flux = np.array(flux_data, dtype=float)
    err = np.array(flux_err_data, dtype=float) if flux_err_data is not None else None

    mask = np.isfinite(time) & np.isfinite(flux)
    if err is not None:
        mask = mask & np.isfinite(err)

    time_clean = time[mask]
    flux_clean = flux[mask]
    err_clean = err[mask] if err is not None else None

    return time_clean, flux_clean, err_clean


def remove_outliers(time, flux, err=None, sigma=5.0):
    """Sigma-clip flux outliers (e.g. cosmic ray hits, instrument glitches)."""
    median = np.median(flux)
    std = np.std(flux)
    mask = np.abs(flux - median) < sigma * std

    time_out = time[mask]
    flux_out = flux[mask]
    err_out = err[mask] if err is not None else None

    return time_out, flux_out, err_out


def normalize_flux(flux):
    """Normalize flux to relative brightness around 1.0 (standard for light curves)."""
    median = np.median(flux)
    return flux / median


def preprocess_light_curve(time_data, flux_data, flux_err_data=None, sigma=5.0):
    """Full preprocessing pipeline: clean -> remove outliers -> normalize."""
    time, flux, err = clean_light_curve(time_data, flux_data, flux_err_data)
    time, flux, err = remove_outliers(time, flux, err, sigma=sigma)
    flux_norm = normalize_flux(flux)

    return {
        "time": time.tolist(),
        "flux": flux_norm.tolist(),
        "flux_err": err.tolist() if err is not None else None,
        "n_points_original": len(time_data),
        "n_points_after_cleaning": len(time),
    }