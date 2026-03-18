# Strategy Paper Trading — Debug Report
_2026-03-14_

---

## TL;DR

Strategy paper trading chưa trade gì lần nào. Không có bug crash hệ thống, nhưng có **3 vấn đề kết hợp** dẫn đến signal không bao giờ được thực thi:

1. **Signal cực kỳ hiếm** do tham số Supertrend quá conservative
2. **Signal timing misalignment** — cycle chạy lệch với giờ đóng nến
3. **Không check error khi `open_trade` thất bại** trong monitor loop

---

## Bằng chứng: Không có trade nào từ trước đến nay

Hai file này không tồn tại:
```
backend/strategy_trades_supertrend_btc.json
backend/strategy_trades_supertrend_eth.json
```
Hệ thống chưa bao giờ mở một strategy trade nào.

---

## Vấn đề #1 — Tham số Supertrend quá slow (nguyên nhân chính)

```python
# strategy_engine.py
"supertrend_btc": { "atr_period": 110, "factor": 5.3 }
"supertrend_eth": { "atr_period": 110, "factor": 3.5 }
```

- ATR period = **110 giờ** ≈ 4.6 ngày smoothing. Đường ST di chuyển cực chậm.
- Factor BTC = **5.3** (rất cao). Band cách giá rất xa → direction flip cực kỳ hiếm.
- Ước tính thực tế: **BREAK signal chỉ xảy ra vài lần/năm** với tham số này.

**TOUCH signal còn strict hơn** — yêu cầu `low[i-1] > st[i-1]`, tức nến trước đó phải không chạm ST line. Nếu giá consolidate gần ST nhiều nến liên tiếp thì điều kiện này liên tục fail.

```python
# strategy_engine.py line 211–216
bull_touch = (curr_d == -1
              and low[i] <= st[i] and close[i] > st[i]
              and low[i-1] > st[i-1])   # ← strict: prev bar không được chạm ST
```

---

## Vấn đề #2 — Signal cycle có thể miss BREAK signal

**Vị trí**: `main.py` `_strategy_monitor_loop`

```python
if now - last_cycle.get(sid, 0) >= 3600:
    last_cycle[sid] = now
    sig = get_signal(sid)  # chỉ check bar -2
```

`last_cycle` khởi tạo rỗng mỗi khi server start → cycle chạy ngay lập tức rồi cứ mỗi 3600s. Không align với giờ đóng nến Binance (`:00` UTC mỗi giờ).

**BREAK signal chỉ valid đúng 1 nến** — nến mà direction flip. Nếu cycle vừa chạy xong rồi 5 phút sau nến đó đóng và flip, cycle tiếp theo chạy sau 60 phút → lúc này bar đó đã là index -3, **không còn được check nữa, miss vĩnh viễn**.

---

## Vấn đề #3 — Monitor loop không check lỗi từ `open_trade`

**Vị trí**: `main.py` line 366–381

```python
t = open_trade(strategy_id=sid, ...)
logger.info(f"Strategy auto-trade [{sid}] {sig['direction']} ...")
# ← không check "error" in t
```

`open_trade` có thể trả về `{"error": "..."}` nếu validation fail. Code không kiểm tra, vẫn log "success", trade không được lưu, và không có cảnh báo nào.

(Với signal hợp lệ từ `strategy_engine`, SL/TP luôn đúng chiều nên bug này ít khi trigger — nhưng vẫn là lỗ hổng cần fix.)

---

## Gợi ý fix

| # | Fix | Priority |
|---|-----|----------|
| 1 | Giảm params để test: `atr_period=14`, `factor=3.0` → signal vài lần/tuần | High |
| 2 | Gọi `GET /api/strategies/supertrend_btc/signal` để xem signal thực tế | High |
| 3 | Thêm log khi cycle check không có signal: `logger.info(f"[{sid}] no signal")` | Medium |
| 4 | Fix monitor loop check error từ `open_trade` | Low |
| 5 | Align cycle với candle close (chạy vào `:05` mỗi giờ thay vì từ startup) | Low |
