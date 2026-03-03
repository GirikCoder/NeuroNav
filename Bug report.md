# 🚀 Engineering Log: NeuroNav Extension

- **Project:** MediaPipe AI Integration & Gesture Control
- **Version:** Master V5 (Stable) 🛡️
- **Date:** Feb 05, 2026 📅
- **Doc Type:** Engineering Retrospective & Bug Log 📝

---

## 1. 🎯 Executive Summary

### **The Goal**
To integrate Google's **"MediaPipe" AI** into a Chrome Extension, allowing users to control the browser with hand gestures (e.g., *Fist* ✊ to switch tabs, *Swipe Down* 👇 to minimize).

### **The Challenge 🚧**
Standard browser security rules **block AI software** from running on secure sites like YouTube or GitHub. Additionally, the complex timing of gestures caused the extension to misfire (the **"Machine Gun Bug"** 🔫), triggering actions uncontrollably.

### **The Solution 🛠️**
1.  **Security Negotiation:** We implemented a "Skeleton Key" script that allows the AI to run safely everywhere by creating a secure policy.
2.  **Global Clock:** We moved the "Gesture Timer" to the browser's background system, ensuring smooth, controlled actions without accidental double-clicks.

---

## 2. 🏗️ Technical Architecture (Final State)

*Overview of the solved system design.*



* 🧠 **The Brain (Main World):** The AI runs directly on the webpage using a "Skeleton Key" injection. It detects hands and broadcasts raw events (e.g., "FIST DETECTED").
* 🌉 **The Bridge (Content Script):** Listens for AI events via `window.postMessage` and relays them to the browser extension core.
* 🛡️ **The Gatekeeper (Background Service):** The only component with a "Memory." It receives the "FIST" command, checks the **Global Cooldown Timer (1.5s)**, and decides whether to execute the tab switch.

---

## 3. 🐛 Consolidated Bug Matrix

*A definitive record of errors, mapping layman symptoms to technical root causes.*

| ID | 🧐 Layman's Explanation (The "What") | 💻 Technical Symptom | 🔍 Root Cause (The "Why") | ✅ Solution Implemented |
| :--- | :--- | :--- | :--- | :--- |
| **ERR-01** | **📄 Downloaded a webpage instead of code.** We thought we saved the AI file, but we actually saved the "Download Successful" HTML page. | `Uncaught SyntaxError: Unexpected token '<'` | **Content Type Mismatch:** The browser tried to execute HTML tags as JavaScript. | Used `curl` to force a raw binary download, bypassing "Save As". |
| **ERR-02** | **👻 Hidden "Ghost" Characters.** Copy-pasting the massive AI code introduced invisible text formatting that broke the file. | `It isn't UTF-8 encoded` | **Encoding Corruption:** VS Code/Clipboard injected Byte Order Marks (BOM). | Performed a **"File Wash"** (Save as Windows-1252 $\rightarrow$ Save as UTF-8). |
| **ERR-03** | **🏷️ Wrong Name Tag.** We tried to summon the AI using the tutorial name, but the actual file used a different variable. | `render_vision_bundle is not defined` | **Scope/Export Error:** The module exported to `window.vision`, not the expected name. | Updated code to capture the correct `vision` variable. |
| **ERR-04** | **🔗 Typo in the Address.** The code accidentally put two slashes (`//`) in the file path, so the browser couldn't find the file. | `Denying load of ...//vision_wasm_internal.js` | **Path Normalization:** Chrome + Library both added slashes. `path/` + `/file` = `path//file`. | Added a path sanitizer (`.slice(0, -1)`) to remove trailing slashes. |
| **ERR-05** | **🐢 Missing "Slow Mode".** YouTube blocked "Fast Mode" (SIMD), and we crashed because we lacked the "Slow Mode" file. | `Denying load of ..._nosimd_internal.js` | **Hardware Fallback Failure:** High-security sites block SIMD instructions. | Downloaded `nosimd` fallback files and whitelisted them. |
| **ERR-06** | **🔫 The "Machine Gun" Bug.** Switching tabs made the extension "forget" it just clicked, causing it to click again immediately. | **Rapid Tab Switching** | **Local State Isolation:** The "Cooldown Timer" died when the page changed. | Moved the timer to the **Background Service Worker** (Persistent Memory). |
| **ERR-07** | **👮 The "Stranger Danger" Block.** Strict sites like GitHub blocked "unknown" AI code from running. | `Refused to evaluate...` (CSP Violation) | **Trusted Types Security:** Browser policies forbade `unsafe-eval` (WASM). | Implemented a **Policy Negotiator** script to whitelist the extension. |
| **ERR-08** | **🧟 The "Zombie Tab" Issue.** Old open tabs were trying to talk to the new version of the extension, causing a mismatch. | `Extension context invalidated` | **Orphaned Content Scripts:** Open tabs held references to the dead background process. | Added protocol to **Hard Refresh (F5)** tabs after updates. |

---

## 4. 🧠 Logic Evolution Log

*Tracking how the AI got smarter to fix usability issues.*

| Version | 🤖 Gesture Logic | 🚩 Defect Identified | ✨ Fix / Improvement |
| :--- | :--- | :--- | :--- |
| **V1** | **Basic Distance** | **False Positives:** Resting hand triggered "Fist". | Introduced **Motion Tracking** (V2). |
| **V2** | **Motion Tracking** | **Accidental Minimize:** Waving hand triggered "Swipe Down". | Introduced **Two-Stage Arming** (Hold Open Hand ✋ $\rightarrow$ Green Bar 🟩 $\rightarrow$ Swipe 👇). |
| **V3** | **Global State** | **State Amnesia:** Switching tabs reset cooldowns. | Moved state to **Background Service Worker**. |
| **V4** | **Master Logic** | **Gesture Confusion:** "Korean Heart" 🫰 triggered "Minimize". | Relaxed finger curl thresholds (`0.15` $\rightarrow$ `0.2`) and added priority locking. |

---

## 5. 🏥 System Health Check

- **System Status:** 🟢 **Stable (Master V5)**
- **Security:** 🔒 **Compliant** (Works on GitHub/YouTube via Policy Negotiation).
- **Compatibility:** 💻 **Universal** (Windows/Mac, SIMD & No-SIMD supported).
- **Next Steps:** 🎉 None. All critical bugs resolved.
