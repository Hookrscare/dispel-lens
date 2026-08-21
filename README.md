# Dispel Lens — Real-Time AI Video & Deepfake Verification

**Dispel Lens** (`dispel.cloud/lens`) is the trust, signal analysis, and content intelligence hub for real-time AI and deepfake video verification on YouTube, TikTok, and web streams.

---

## 🏛️ Ecosystem Overview

```
[ dispel.cloud Web Suite ] ── (Magic-Link Auth Bridge) ──► [ Dispel Lens Extension (MV3) ]
           │                                                               │
(Global Trust Registry Search)                               (Ambient In-Player Badge)
           │                                                               │
           ▼                                                               ▼
[ Public Certificate /verify ]                               [ YouTube & TikTok Players ]
           │                                                               │
           └───────────────────────┬───────────────────────────────────────┘
                                   ▼
                [ Dispel Cloud Multi-Layer Gateway ]
                   ├── 🔬 Spatial 2D FFT & Upsampler Lattice
                   ├── 🫀 Biological Pulse & Hemodynamics (rPPG)
                   ├── 🌊 Optical Flow Temporal Warping
                   ├── 💡 Physics & Specular Symmetry
                   ├── 🎙️ Cross-Modal Audio & Vocoder Cutoff
                   └── 🛡️ C2PA & Provenance Attestation
```

---

## 💎 Core Brand & Architectural Innovations

1. **Brand Identity**:
   - **Name**: Dispel Lens (`dispel.cloud/lens`)
   - **Visual Identity**: Stylized aperture lens overlapping an unbroken focal prism in **Deep Obsidian** (`#0B0F17`), **Laser Cyan** (`#00F0FF`), **Emerald Green** (`#10B981`), and **Signal Crimson** (`#EF4444`).
   - **Typography**: Space Grotesk & Inter for high-precision technical feel.

2. **Zero-Friction Extension Installation Flow**:
   - **Automatic Magic-Link Auth Handshake**: If a user is logged into `dispel.cloud`, [`auth-bridge.js`](file:///Users/castro/Documents/ai%20video%20identifier%20tool/extension/auth-bridge.js) synchronizes tokens automatically on the first visit — zero manual API key copy-pasting required.
   - **Guest Tier out-of-the-box**: 5 free daily scans immediately after installation without registration.

3. **In-Player Ambient UI**:
   - Discrete, semi-transparent pill in player controls: `Dispel: Authentic (99%)` or `Dispel: Synthetic Detected`.
   - 1-Click slide-out inspector showing forensic heatmaps, audio vocoder checks, and direct button: `"Export to dispel.cloud"`.

4. **Global Trust Registry (`dispel.cloud/verify`)**:
   - Search bar on the web dashboard where users paste any YouTube/TikTok URL to lookup or generate public cryptographic verification certificates.

---

## 🧪 Verification & Test Suite

Run the full backend test suite:
```bash
source venv/bin/activate
PYTHONPATH=backend pytest backend/tests/ -v
```
All 13 comprehensive unit tests pass with 100% success.

---

## 🚀 Quick Start Guide

### 1. Start the Dispel Gateway Backend
```bash
source venv/bin/activate
cd backend
python server.py
```
*Runs on `http://localhost:8000` with WebSocket stream at `ws://localhost:8000/ws/detect-stream`.*

### 2. Open the Dispel Lens Portal & Testbed
Visit:
```
http://localhost:8000/demo/
```
- **Test Landing Page**: Explore copy, hero CTA, and pricing matrix.
- **Test Magic-Link Handshake**: Click **"⚡ Test Magic-Link Auth Sync"** to test token synchronization.
- **Search Trust Registry**: Search any video ID in the `dispel.cloud/verify` search bar.
- **Live Video Inspector**: Test 1-click synthetic generator, authentic human, and voice clone vocoder cutoff benchmarks.

### 3. Install the Dispel Lens Chrome Extension
1. Go to `chrome://extensions` in Google Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the [`extension/`](file:///Users/castro/Documents/ai%20video%20identifier%20tool/extension) directory.
4. Open YouTube or TikTok — the ambient **Dispel Lens** pill badge will attach automatically.
