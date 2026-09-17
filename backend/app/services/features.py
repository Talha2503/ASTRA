import numpy as np
from scipy import stats
from astropy.timeseries import LombScargle


def extract_statistical_features(flux):
    flux = np.array(flux, dtype=float)
    return {
        "mean": float(np.mean(flux)),
        "std": float(np.std(flux)),
        "median": float(np.median(flux)),
        "min": float(np.min(flux)),
        "max": float(np.max(flux)),
        "skewness": float(stats.skew(flux)),
        "kurtosis": float(stats.kurtosis(flux)),
        "mad": float(stats.median_abs_deviation(flux)),
        "range": float(np.max(flux) - np.min(flux)),
    }


def extract_signal_features(time, flux, min_period_days=0.1, max_period_days=None):
    """Lomb-Scargle periodogram to find dominant periodicity (e.g. transits, pulsations, rotation).
    Period search is bounded to avoid aliasing noise near the sampling cadence."""
    time = np.array(time, dtype=float)
    flux = np.array(flux, dtype=float)

    if max_period_days is None:
        max_period_days = (time[-1] - time[0]) / 2  # can't reliably detect periods longer than half the baseline

    min_frequency = 1.0 / max_period_days
    max_frequency = 1.0 / min_period_days

    frequency, power = LombScargle(time, flux).autopower(minimum_frequency=min_frequency, maximum_frequency=max_frequency)
    best_idx = np.argmax(power)
    best_frequency = frequency[best_idx]
    best_period = 1.0 / best_frequency if best_frequency > 0 else None
    best_power = float(power[best_idx])

    return {
        "dominant_period_days": float(best_period) if best_period else None,
        "dominant_power": best_power,
        "mean_power": float(np.mean(power)),
        "max_power": float(np.max(power)),
    }


def extract_temporal_features(time):
    time = np.array(time, dtype=float)
    diffs = np.diff(time)
    return {
        "duration_days": float(time[-1] - time[0]),
        "n_points": len(time),
        "median_cadence_days": float(np.median(diffs)) if len(diffs) > 0 else None,
        "max_gap_days": float(np.max(diffs)) if len(diffs) > 0 else None,
        "n_gaps_over_1day": int(np.sum(diffs > 1.0)) if len(diffs) > 0 else 0,
    }


def extract_all_features(time, flux):
    features = {}
    features.update(extract_statistical_features(flux))
    features.update(extract_signal_features(time, flux))
    features.update(extract_temporal_features(time))
    return features