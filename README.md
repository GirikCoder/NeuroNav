<div align="center">

# 🖐️ NeuroNav
### High-Fidelity Gesture Control for Chromium Browsers

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Chrome%20%7C%20Edge%20%7C%20Brave-teal.svg?style=flat-square)
![Privacy](https://img.shields.io/badge/privacy-100%25%20Local%20Processing-green.svg?style=flat-square)
![Tech](https://img.shields.io/badge/engine-WASM%20%2B%20TensorFlow.js-orange.svg?style=flat-square)

<br />

**[Live Demo](#)** • **[Installation](#installation)** • **[Architecture](#architecture)** • **[Gesture Library](#gesture-library)**

</div>

---

## ⚡ Overview

**NeuroNav** is a production-ready browser extension that transforms standard webcams into low-latency gesture recognition interfaces. By bridging physical intent with digital execution, it allows users to navigate the web completely touch-free.

Unlike cloud-based solutions, NeuroNav runs a **local inference engine** optimized for WebAssembly (WASM), ensuring zero-latency response times and absolute data privacy.

### Core Value Proposition
* **Zero-Touch Navigation:** Full browser control without peripheral contact.
* **Edge Computing:** All computer vision processing occurs on-device (Client-Side).
* **Privacy First:** No video data is recorded or transmitted.

---

## 🎯 Real-World Applications

NeuroNav is designed for environments where using a keyboard or mouse is impractical, unsanitary, or impossible.

| Scenario | Application |
| :--- | :--- |
| **Culinary & Kitchen** | Scroll through recipes while your hands are covered in dough or oil without dirtying your device. |
| **Sterile Environments** | Ideal for medical research or lab settings where touching non-sterile peripherals is prohibited. |
| **Workshops & Repair** | Navigate datasheets and schematics while holding tools or working with greasy hardware. |
| **Casual Consumption** | Control media playback or read articles while eating or relaxing at a distance from the screen. |
| **Accessibility** | An alternative input method for users with motor impairments or Repetitive Strain Injury (RSI). |

---

## 🖥️ Demo & Usage

![Demo](https://via.placeholder.com/800x400.png?text=Insert+Demo+GIF+Here)

---

## 🛠️ Architecture

NeuroNav utilizes a sophisticated pipeline to handle the complex state management between visual input and DOM manipulation.

1.  **Ingestion:** `OffscreenCanvas` captures the raw video stream.
2.  **Inference:** A quantized **Vision Transformer** extracts 21 3D hand landmarks in real-time (<50ms).
3.  **Vector Analysis:** The geometric engine calculates Euclidean distances between fingertips and knuckles to classify pose topology.
4.  **Action Dispatch:** Validated gestures trigger Chrome Extension APIs (`chrome.tabs`, `chrome.scripting`) to execute the payload.

---

## 🕹️ Gesture Library

NeuroNav maps ergonomic hand signs to specific browser events.

| Command | Trigger Gesture | Visual Description |
| :--- | :--- | :--- |
| **Scroll Down** | **Fist + Thumb Down** | 👎 Classic Thumbs Down |
| **Scroll Up** | **Fist + Thumb Up** | 👍 Classic Thumbs Up |
| **Next Tab** | **Thumb + Index Extended** | 👉 "L" Shape (Right) |
| **Prev Tab** | **Thumb + Index (Inverted)** | 👈 "L" Shape (Left) |
| **Close Tab** | **Index + Middle (V)** | ✌️ Peace Sign |
| **Restore Tab** | **Index + Pinky** | 🤘 Rock & Roll / Horns |
| **New Tab** | **Index + Middle + Ring** | 🖖 Scout Salute |
| **Reload** | **Pinky Extended** | 🤙 "Call Me" / Shaka |
| **Minimize** | **Open Palm** | 🖐️ "Stop" Sign |

> **Optimization Tip:** For best results, ensure your hand is roughly 1-2 feet from the webcam with a contrasting background.

---

## 🔒 Privacy & Security

Security is architected into the core of NeuroNav.

* **No Cloud Transmission:** The `videoCapture` stream is processed in volatile memory (RAM) and immediately discarded. No visual data ever leaves `localhost`.
* **Permission Scoping:**
    * `activeTab`: Used strictly for injecting scroll scripts.
    * `videoCapture`: Used strictly for landmark inference.
* **Offline Capable:** The extension functions without an active internet connection.

---

## 📥 Installation

Currently available for local deployment (Developer Mode).

### Prerequisites
* Google Chrome (v88+), Brave, or MS Edge.
* Standard 720p+ Webcam.

### Quick Start
1.  **Clone the Source**
    ```bash
    git clone [https://github.com/GirikCoder/NeuroNav.git](https://github.com/GirikCoder/NeuroNav.git)
    cd NeuroNav
    ```
2.  **Load Extension**
    * Navigate to `chrome://extensions/`
    * Toggle **Developer Mode** (Top Right)
    * Click **Load Unpacked**
    * Select the `NeuroNav` directory.
3.  **Initialize**
    * Pin the NeuroNav icon to your toolbar.
    * Click the icon and grant **Camera Access**.
    * Refresh any active tabs to inject the content script.

---

## 🛣️ Roadmap

* [ ] **Custom Keybinding:** UI for users to map specific gestures to custom keyboard shortcuts.
* [ ] **Sensitivity Thresholds:** Adjustable debounce timers and scroll velocity.
* [ ] **Head Pose Estimation:** Scroll functionality via head tilt (Assistive Tech).
* [ ] **Low-Light Mode:** Contrast boosting for dim environments.

---

<div align="center">
  <sub>Designed & Engineered by the NeuroNav Team</sub>
</div>
