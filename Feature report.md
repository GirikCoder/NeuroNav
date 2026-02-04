# 🚀 NeuroNav: Feature Report & Technical Specification

## 1. Feature Overview

**NeuroNav** acts as a privacy-centric, gesture-based interface layer for web browsers. By bypassing traditional input devices, it allows users to navigate the web using hand movements captured via webcam. The system  execute high-performance computer vision tasks entirely on the client side.

**Core Capabilities:**
* ✋ **Real-Time Gesture Recognition:** Sophisticated hand tracking using machine learning.
* 💻 **Browser Automation:** Converting recognized gestures into actionable browser commands (e.g., closing tabs).
* 👁️ **Visual Feedback System:** On-screen overlays to indicate gesture detection status.
* 🛡️ **Local Inference Engine:** Zero-latency, privacy-first processing without server dependency.

---

## 2. Feature-by-Feature Breakdown

### ✋ Feature A: Client-Side Gesture Recognition

**🎯 Purpose (Value)**
Eliminates the need for physical contact with peripherals, enabling touch-free navigation. This provides accessibility benefits and modernizes the browsing experience.

**⚙️ Technical Explanation**
The system injects an **AI Bridge** into the webpage context. This bridge utilizes `vision_bundle.js` to load the `hand_landmarker.task` model. It processes the webcam stream via a `requestAnimationFrame` loop, leveraging WebAssembly (WASM) binaries to calculate **21 distinct hand landmarks** in 3D space. Vector algebra is used to calculate Euclidean distances between coordinates to classify poses (e.g., specific finger extensions).

**💡 Layman Explanation**
The extension acts as a "smart mirror." It uses your webcam to look at your hand 30 times a second. Using a specialized digital brain, it connects the dots on your fingers to understand if you are making a specific shape, like a "Peace" sign or a "Thumbs Up."

**📂 Files Involved**
* `ai_bridge.js`: Core logic for landmark detection and vector math.
* `vision_bundle.js`: MediaPipe/TensorFlow.js library functions.
* `vision_wasm_internal.wasm`: Accelerated machine code for matrix calculations.
* `hand_landmarker.task`: The pre-trained neural network weights.

**⚠️ Edge Cases & Limitations**
* **Lighting/Occlusion:** Extreme lighting or hidden fingers may affect landmark accuracy.
* **Dwell Time:** A "Hold/Dwell" mechanism (550ms) is enforced to prevent accidental triggers from jittery movements.

---

### ⚡ Feature B: Browser Command Execution

**🎯 Purpose (Value)**
Translates abstract hand shapes into concrete browser actions, allowing users to manage their workspace (tabs, windows) efficiently without a mouse.

**⚙️ Technical Explanation**
This feature utilizes the **Bridge Pattern**. Once `ai_bridge.js` confirms a gesture, it posts a message to `content.js`, which relays it to the `background.js` Service Worker. The Service Worker listens for these messages and executes Chrome Extension APIs (specifically `chrome.tabs`, `chrome.windows`, and `chrome.sessions`). A cooldown state (`lastActionTime`) is implemented to prevent command spamming.

**💡 Layman Explanation**
This is the "invisible hand" of the software. When the AI sees the correct hand signal, it sends a command to the browser manager saying, *"The user wants to close this tab now."* The browser manager then pushes the button to make it happen.

**📂 Files Involved**
* `background.js`: The central controller with permissions to modify browser tabs.
* `content.js`: Acts as the messenger between the webpage and the background controller.

**⚠️ Edge Cases & Limitations**
* **Scope:** Actions are limited to what the Chrome API permits (e.g., closing tabs, window management).

---

### 👁️ Feature C: Visual Feedback Interface

**🎯 Purpose (Value)**
Provides immediate system status to the user, ensuring they know when the camera is active and when a gesture is being successfully registered/held.

**⚙️ Technical Explanation**
`content.js` manipulates the DOM (Document Object Model) of the current page. It creates a hidden `<video>` element for the raw stream capture and renders a visual **"Loading Bar"** or progress overlay on the screen. This UI updates in real-time based on the "Dwell" status calculated in `ai_bridge.js`.

**💡 Layman Explanation**
Since you aren't clicking a physical button, you need to know if the computer "sees" you. This feature draws a progress bar on the screen that fills up as you hold a gesture, showing you that the action is about to happen.

**📂 Files Involved**
* `content.js`: Handles all DOM manipulation and UI drawing.

---

## 3. 👥 User Value Matrix

| User Persona | Relevant Feature | Benefit Description | Real-World Scenario |
| :--- | :--- | :--- | :--- |
| **🧑‍🍳 The Multitasker** | **Gesture Recognition** | Allows control when hands are dirty, wet, or occupied with other tasks. | A user cooking in the kitchen can scroll a recipe or close a pop-up without touching their laptop with dough-covered hands. |
| **♿ Accessibility User** | **Command Execution** | Provides a viable alternative to fine-motor peripherals like mice or trackpads. | A user with limited hand mobility can close tabs using broad, simple hand shapes rather than aiming for a tiny "x" button. |
| **🔐 Privacy Advocate** | **Local Inference** | Ensures peace of mind knowing biometric data never leaves the machine. | A security-conscious user can use the webcam features confidently, knowing no video stream is ever sent to a cloud server. |
| **⚡ Power User** | **Browser Automation** | Increases workflow speed by reducing friction in repetitive tasks. | A developer or researcher with many tabs open can rapidly "slash" through them to close unwanted pages without moving the mouse cursor. |
| **📺 The Presenter** | **Visual Feedback** | Allows for remote control of a screen during a demonstration. | A user presenting to a team can stand away from the keyboard and use gestures to navigate, with the UI confirming their actions to the audience. |

---

## 4. 🗺️ Feature-to-Code Mapping

| Feature | Primary File(s) | Specific Responsibility |
| :--- | :--- | :--- |
| **Vision/Inference** | `ai_bridge.js` | Loads model, runs loop, calculates vector distances. |
| | `hand_landmarker.task` | Contains the neural network weights (the "brain"). |
| | `vision_wasm_internal.*` | Provides high-speed calculation capabilities. |
| **Browser Control** | `background.js` | Executes `chrome.tabs.remove` and manages cooldowns. |
| | `manifest.json` | Declares permissions (`tabs`, `activeTab`) required. |
| **Stream & UI** | `content.js` | Captures `navigator.mediaDevices`, draws loading UI. |
| **Communication** | `content.js` | Relays messages from AI Bridge to Background Worker. |

---

## 5. 📈 Scalability & Maintainability Notes

**🚀 Scalability (User Base)**
* **Infinite Scaling:** Because the architecture relies on **Local Inference**, there is zero dependency on backend servers. Increasing the user base from 1 to 1 million incurs no additional server costs or latency penalties for the developer.

**🛠️ Maintainability (Codebase)**
* **Modular Separation:** The project adheres to a strict separation of concerns. "Vision Logic" is isolated in `ai_bridge.js`, while "Browser Logic" resides in `background.js`. This allows developers to upgrade the AI model without risking bugs in the tab management features, and vice versa.
* **Dependency Management:** The project relies on tight coupling between `vision_bundle.js` and `vision_wasm_internal.wasm`. Any updates to the vision libraries must ensure version parity between the JS bundle and the WASM binaries to prevent runtime errors.
