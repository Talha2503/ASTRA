import numpy as np
from astropy.timeseries import BoxLeastSquares
from scipy import stats


def run_transit_search(time, flux, min_period_days=1.0, max_period_days=None):
    """Box Least Squares search — the standard algorithm for detecting transit-like dips."""
    time = np.array(time, dtype=float)
    flux = np.array(flux, dtype=float)

    if max_period_days is None:
        max_period_days = (time[-1] - time[0]) / 2

    if max_period_days <= min_period_days:
        max_period_days = min_period_days * 2

    max_duration = min(0.3, min_period_days * 0.4)
    durations = np.linspace(0.01, max_duration, 10)

    # Estimate per-point flux uncertainty from the data itself (needed for depth_snr)
    flux_err_estimate = np.full_like(flux, np.std(flux))

    bls = BoxLeastSquares(time, flux, dy=flux_err_estimate)
    periodogram = bls.autopower(durations, minimum_period=min_period_days, maximum_period=max_period_days)

    best_idx = np.argmax(periodogram.power)
    best_period = periodogram.period[best_idx]
    best_power = periodogram.power[best_idx]
    best_duration = periodogram.duration[best_idx]
    best_t0 = periodogram.transit_time[best_idx]

    stats_result = bls.compute_stats(best_period, best_duration, best_t0)

    def safe_get(key, default=None):
        val = stats_result.get(key)
        if val is None:
            return default
        try:
            return float(val[0])
        except (TypeError, IndexError):
            return float(val)

    depth_odd = safe_get("depth_odd")
    depth_even = safe_get("depth_even")
    odd_even_diff = abs(depth_odd - depth_even) if (depth_odd is not None and depth_even is not None) else None

    return {
        "best_period_days": float(best_period),
        "best_power": float(best_power),
        "best_duration_days": float(best_duration),
        "best_t0": float(best_t0),
        "transit_depth": safe_get("depth"),
        "transit_depth_snr": safe_get("depth_snr"),
        "odd_even_depth_diff": odd_even_diff,
    }


def run_statistical_significance_test(flux, baseline_flux=None):
    """Tests whether flux distribution deviates significantly from normal (Gaussian) noise."""
    flux = np.array(flux, dtype=float)

    shapiro_stat, shapiro_p = stats.shapiro(flux[:5000])  # shapiro test caps at ~5000 samples

    result = {
        "shapiro_statistic": float(shapiro_stat),
        "shapiro_p_value": float(shapiro_p),
        "is_gaussian": bool(shapiro_p > 0.05),
    }

    if baseline_flux is not None:
        baseline_flux = np.array(baseline_flux, dtype=float)
        t_stat, t_p = stats.ttest_ind(flux, baseline_flux)
        result["t_test_statistic"] = float(t_stat)
        result["t_test_p_value"] = float(t_p)
        result["significantly_different_from_baseline"] = bool(t_p < 0.05)

    return result