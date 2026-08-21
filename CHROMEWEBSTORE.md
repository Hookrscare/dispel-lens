# Chrome Web Store Listing — Dispel Lens: AI Video Detector

## Store Listing Metadata

- **Name**: Dispel Lens - AI Video Detector
- **Version**: 1.0.0
- **Summary / Short Description**: Real-time AI, deepfake, and synthetic voice detection for YouTube & TikTok with frame-level forensic heatmaps by dispel.cloud.
- **Category**: Productivity / Tools
- **Developer / Publisher**: dispel.cloud
- **Support & Web Portal**: https://dispel.cloud/lens
- **Language**: English

---

## Detailed Store Description

**Dispel Lens** (`dispel.cloud/lens`) is a real-time, explainable AI and deepfake detection extension that provides sub-second verification directly over YouTube and TikTok video players.

Rather than a black-box percentage score, Dispel Lens uses a multi-layer content intelligence pipeline inspecting spatial, temporal, biological, physical, and acoustic signals simultaneously.

### Key Features:
- **Ambient In-Player Badges**: Discrete, semi-transparent status pills injected directly into video players (`Dispel: Authentic 99%` or `Dispel: Synthetic Detected`).
- **Explainable Forensic Heatmaps**: Interactive overlays that pinpoint exact anomalies directly on the video player (e.g. latent diffusion upsampler lattice artifacts, phase warping, or asymmetric eye reflections).
- **Two-Tier Latency Routing**: Sub-50ms preliminary Fast Tier assessment followed by a deep multi-layer ensemble verification.
- **Multi-Vector Analysis Pipeline**:
  1. *Spatial FFT & Neural Signatures*: 2D Fast Fourier Transform power spectrum analysis exposes high-frequency checkerboard grid artifacts left by generative diffusion upsamplers (Sora, Kling, Gen-3, Flux).
  2. *Biological Pulse Tracking (rPPG)*: Remote photoplethysmography measures subtle cardiac blood volume pulse (BVP) fluctuations across facial skin. AI faces lack coherent hemodynamics.
  3. *Optical Flow & Temporal Coherence*: Inter-frame motion vector tracking exposes boundary edge shimmering and phase desynchronization.
  4. *Physics & Lighting Symmetry*: Evaluates 3D ambient illumination vectors and bilateral corneal specular reflection symmetry.
  5. *Cross-Modal Audio & Voice Clone Check*: Identifies artificial 16kHz/22kHz vocoder cutoffs and lip-sync viseme latency.
  6. *C2PA & Watermarking Attestation*: Scans for cryptographic provenance metadata and synthetic digital watermarks (SynthID).
- **Global Trust Registry & Collaborative Caching**: Viral videos verified once are cached globally—subsequent users get instant 0ms verification at zero GPU compute cost.
- **Zero-Friction Magic-Link Auth**: Automatic token synchronization with dispel.cloud without manual API key entry. 5 free daily guest scans out-of-the-box.

---

## Permissions Justification

| Permission | Scope | Plain-English Justification |
| :--- | :--- | :--- |
| `storage` | Browser Local Storage | Used to persist user configuration (auto-scan preferences, sensitivity), local scan history, and synchronized dispel.cloud session tokens. |

### Host Permissions Justification

| Host Pattern | Plain-English Justification |
| :--- | :--- |
| `*://dispel.cloud/*` | Enables the extension to synchronize authentication tokens and subscription tiers automatically via the dispel.cloud web portal without manual API key entry. |
| `*://*.dispel.cloud/*` | Covers dispel.cloud subdomains (e.g., lens.dispel.cloud, verify.dispel.cloud) for session sync. |
| `*://*.youtube.com/*` | Enables the extension to hook into the YouTube video player (`#movie_player`, `ytd-watch-flexy`, and YouTube Shorts) to extract sample frame bursts and display ambient verification badges. |
| `*://*.tiktok.com/*` | Enables the extension to detect active video elements in TikTok's web feed and attach the verification HUD overlay. |
| `http://localhost:8000/*` | Allows local communication between the extension and the local AI inference detection server during development and private on-device processing. |
| `http://127.0.0.1:8000/*` | Loopback address fallback for local detection server communication. |

---

## Privacy & Data Use Disclosures

- **Data Collection**: The extension only captures short, sequential frame bursts (5–10 frames) and optional audio samples from the active HTML5 `<video>` element on supported platforms (YouTube and TikTok) when a video is being played.
- **Data Transmission**: Frame bursts are compressed client-side into WebP images and sent to the configured inference server endpoint solely for real-time verification analysis. No video frames or personal user identities are stored or used for tracking.
- **Single Purpose**: All functionality is dedicated to detecting AI-generated synthetic video content and displaying verification badges.

---

## Version History

- **v1.0.0** (2026-08-21):
  - Initial release featuring Manifest V3 architecture under the Dispel Lens brand identity.
  - Multi-layer ensemble detection: Spatial FFT, rPPG biological pulse, optical flow, physics/lighting, cross-modal audio, and C2PA attestation.
  - Support for YouTube, YouTube Shorts, and TikTok web feed.
  - Dispel Cloud zero-friction auth handshake bridge.
  - Interactive Dispel Inspector panel with public Global Trust Registry certificate export.
