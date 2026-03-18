# -*- coding: utf-8 -*-
"""
QuantDesk — One-click launcher
Usage: python run.py
"""
import subprocess, sys, os, time, webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.join(ROOT, 'backend')
FRONTEND = os.path.join(ROOT, 'frontend')

print("=" * 50)
print("  QuantDesk — Trading Intelligence")
print("=" * 50)

# Start backend
print("\n[1/2] Starting FastAPI backend (port 8006)...")
backend = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8006"],
    cwd=BACKEND,
)

# Start frontend
print("[2/2] Starting Vite frontend (port 5175)...")
frontend = subprocess.Popen(
    ["npm", "run", "dev"],
    cwd=FRONTEND,
    shell=True,
)

time.sleep(3)
print("\n" + "=" * 50)
print("  QuantDesk is running!")
print("  http://localhost:5175")
print("  API: http://localhost:8006/api/health")
print("  Press Ctrl+C to stop")
print("=" * 50)

webbrowser.open("http://localhost:5175")

try:
    backend.wait()
except KeyboardInterrupt:
    print("\n\nShutting down...")
    backend.terminate()
    frontend.terminate()
    print("Done.")
