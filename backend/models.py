# -*- coding: utf-8 -*-
"""
Model metadata & metrics from our research
"""

MODELS = [
    {
        "id": "ensemble-v2-crypto",
        "name": "Ensemble V2 Crypto",
        "status": "active",
        "asset_class": "Crypto Perpetuals",
        "description": "Multi-signal ensemble: VolBreak + SMA Cross + Momentum + Trend Direction. 4 signals vote, ≥2 agreement triggers trade. ATR-based SL/TP (R:R 1:1.5).",
        "timeframe": "1H",
        "markets": ["BTC", "ETH", "SOL", "XRP", "DOGE", "AVAX", "ADA", "LINK", "BNB", "ZEC", "BCH", "SUI", "ALPHA", "AGLD", "BNX"],
        "metrics": {
            "oos_period": "2024-01-01 to present",
            "avg_sharpe": 7.72,
            "avg_wr": 66.7,
            "avg_hold": "17h",
            "trades_per_year": 1453,
            "max_drawdown": 0.4,
            "positive_assets": "15/15 (100%)",
        },
        "top_assets": [
            {"name": "SOL", "sharpe": 8.89, "wr": 68.6, "ret": 8.4, "gap": 0.01},
            {"name": "DOGE", "sharpe": 8.34, "wr": 68.4, "ret": 8.9, "gap": 2.56},
            {"name": "AVAX", "sharpe": 8.29, "wr": 66.4, "ret": 8.7, "gap": 0.62},
            {"name": "XRP", "sharpe": 8.18, "wr": 68.0, "ret": 7.5, "gap": 0.44},
            {"name": "ZEC", "sharpe": 7.91, "wr": 66.8, "ret": 11.7, "gap": 1.39},
        ],
        "verification": {
            "monte_carlo_p": "0.00%",
            "random_direction_p": "0.00%",
            "random_bars_p": "0.00%",
            "beats_sma200_trivial": True,
            "beats_always_long": True,
            "fixed_capital_edge": "+11.8% over 6 years",
        },
        "yearly": [
            {"year": 2019, "ret": 2.1, "period": "IS"}, {"year": 2020, "ret": 1.8, "period": "IS"},
            {"year": 2021, "ret": 2.3, "period": "IS"}, {"year": 2022, "ret": 1.9, "period": "IS"},
            {"year": 2023, "ret": 2.1, "period": "IS"},
            {"year": 2024, "ret": 3.3, "period": "OOS"}, {"year": 2025, "ret": 4.5, "period": "OOS"},
        ],
    },
    {
        "id": "vn-multi-factor",
        "name": "VN Multi-Factor",
        "status": "active",
        "asset_class": "VN Stocks (VN30)",
        "description": "Monthly rotation: rank VN30 by 3M momentum + low volatility + SMA200 trend filter + Golden Cross. Buy top 5, rebalance monthly.",
        "timeframe": "Daily",
        "markets": ["VN30 (HOSE)"],
        "metrics": {
            "oos_period": "2023-01-01 to present",
            "total_oos_return": 169.3,
            "annualized_return": 38,
            "avg_sharpe": 1.73,
            "avg_wr": 72.2,
            "is_return": 428.9,
            "beats_vnindex": True,
        },
        "yearly": [
            {"year": 2015, "ret": 18.4, "wr": 78, "period": "IS"},
            {"year": 2016, "ret": 19.9, "wr": 55, "period": "IS"},
            {"year": 2017, "ret": 78.4, "wr": 91, "period": "IS"},
            {"year": 2018, "ret": -8.7, "wr": 42, "period": "IS"},
            {"year": 2019, "ret": 23.4, "wr": 82, "period": "IS"},
            {"year": 2020, "ret": 22.8, "wr": 67, "period": "IS"},
            {"year": 2021, "ret": 75.5, "wr": 73, "period": "IS"},
            {"year": 2022, "ret": -13.9, "wr": 45, "period": "IS"},
            {"year": 2023, "ret": 26.7, "wr": 67, "period": "OOS"},
            {"year": 2024, "ret": 20.7, "wr": 64, "period": "OOS"},
            {"year": 2025, "ret": 72.7, "wr": 82, "period": "OOS"},
            {"year": 2026, "ret": 2.0, "wr": 100, "period": "OOS"},
        ],
    },
    {
        "id": "gold-ensemble",
        "name": "Gold Ensemble V2",
        "status": "research",
        "asset_class": "Gold (XAU/USD)",
        "description": "Adapted Ensemble V2 for Gold spot H1: Vol Breakout + SMA Cross + Momentum signals. 20 years of data, profitable in 20/20 years IS.",
        "timeframe": "1H",
        "markets": ["XAU/USD"],
        "metrics": {
            "data_period": "2006-2025",
            "years_profitable": "20/20",
            "sharpe": 3.2,
            "wr": 62,
        },
    },
    {
        "id": "supertrend",
        "name": "Supertrend (Deprecated)",
        "status": "deprecated",
        "asset_class": "Crypto",
        "description": "ATR-based trend following. Showed strong IS results but prone to overfitting. Replaced by Ensemble V2.",
        "timeframe": "1H",
        "markets": ["BTC", "ETH"],
        "metrics": {
            "note": "Overfitting risk - not recommended for live trading",
        },
    },
]

def get_all_models():
    return MODELS

def get_model(model_id: str):
    for m in MODELS:
        if m["id"] == model_id:
            return m
    return None
