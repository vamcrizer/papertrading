import scanner

results = scanner.scan_all()

btc = [r for r in results if r["symbol"] == "BTC"][0]
print("=== BTC Signal Check ===")
for k, v in btc.items():
    print(f"  {k}: {v}")

print("\n=== All Coins Signal Summary ===")
print(f"{'COIN':6} {'SIG':4} {'VOTE':>5} {'DIR':6} {'BAR_AGO':>8} {'PRICE':>12}")
print("-" * 50)
for r in sorted(results, key=lambda x: x.get("has_signal", False), reverse=True):
    sig = "YES" if r.get("has_signal") else "no"
    vote = r.get("vote", 0)
    d = r.get("direction", "")
    ba = r.get("signal_bar_ago", -1)
    p = r.get("price", 0)
    print(f"  {r['symbol']:6} {sig:4} {vote:>+4} {d:6} {ba:>8} {p:>12}")
