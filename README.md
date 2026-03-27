# CodeVault — On-Device AI Code Reviewer

> **Built for the GPT Challenge Hackathon by Singularity x RunAnywhere**

CodeVault is a mobile AI code reviewer that runs **100% on your device** — no internet, no API calls, no cost per review. Paste your code, pick a review mode, and get a detailed security/quality analysis powered by a local LLM.

---

## The Problem

Every existing AI code reviewer (GitHub Copilot, Claude, GPT-4) sends your code to a remote server. That means:

- **Your proprietary code leaves your device**
- **You pay per API call** — costs add up fast
- **You need internet** — useless offline or on a plane
- **Latency** — round-trips to cloud add seconds of delay

CodeVault eliminates all four problems by running inference directly on the phone.

---

## What It Does

| Feature | Description |
|---|---|
| **Security Review** | Finds SQL injection, XSS, hardcoded secrets, and other OWASP vulnerabilities |
| **Bug Detection** | Spots logic errors, unhandled edge cases, and off-by-one mistakes |
| **Quality Analysis** | Readability, performance, and maintainability suggestions |
| **Code Explainer** | Line-by-line walkthrough for onboarding or code review |
| **Privacy Proof** | Live demo showing 0 network requests made during inference |
| **Review History** | Last 5 reviews saved locally, collapsible, with full output |
| **Share Review** | Export any review as formatted text via the native share sheet |

---

## On-Device AI Benefits

### Complete Privacy
Your source code never leaves the device. No logs, no telemetry, no training data. Verified by the in-app Privacy Proof screen — it shows a live network request counter that stays at **0** even after running a full review.

### Zero Cost Per Review
No API key. No monthly bill. No per-token pricing. Download the model once (~1–4 GB), and every review after that is free forever.

### Low Latency
No round-trip to a cloud server. Inference runs on the device's NPU/GPU via LlamaCpp, giving fast responses without waiting on a network.

### Works Fully Offline
No WiFi, no cellular, no problem. Works on a plane, in a basement, at a conference with bad reception — anywhere.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React Native (Expo) |
| **On-Device AI SDK** | [RunAnywhere SDK](https://runanywhere.ai) (`runanywhere-react-native`) |
| **LLM Runtime** | LlamaCpp (GGUF models from Hugging Face) |
| **Model Format** | GGUF — quantized, optimized for mobile |
| **UI** | Custom warm dark theme, Claude-inspired design system |
| **Build** | EAS Build (Expo Application Services) |

---

## Install

### Android APK (Recommended for Hackathon Demo)

1. Download the latest APK:

   **[Download CodeVault APK](#)** *(replace with EAS build link)*

2. On your Android device: **Settings → Install unknown apps** → allow your browser/file manager.

3. Open the downloaded APK and tap **Install**.

4. Launch **CodeVault**, select a model, download it (one-time, ~1–4 GB), then start reviewing code.

### Build from Source

```bash
# Prerequisites: Node 18+, EAS CLI, Expo account
npm install -g eas-cli

git clone https://github.com/suhanijindal/codevault.git
cd codevault
npm install

# Development build (requires physical device)
eas build --platform android --profile development

# Production APK
eas build --platform android --profile production
```

---

## Sample Vulnerabilities Included

CodeVault ships with 3 pre-loaded vulnerable code samples to demo instantly:

**SQL Injection (Python)**
```python
query = f"SELECT * FROM users WHERE username = '{username}'"
```

**XSS Vulnerability (JavaScript)**
```javascript
res.send(`<h1>Results for: ${req.query.q}</h1>`);
```

**Hardcoded Secrets (Python)**
```python
API_KEY = "sk-1234567890abcdef"
DB_PASSWORD = "admin123"
```

Run a Security review on any of these to see CodeVault catch the issues — all on-device, offline, instantly.

---

## Screenshots

| Model Selection | Review Modes | Security Analysis | Privacy Proof |
|---|---|---|---|
| *(placeholder)* | *(placeholder)* | *(placeholder)* | *(placeholder)* |

---

## How It Works

```
User pastes code
      |
Selects review mode (Security / Bugs / Quality / Explain)
      |
CodeVault builds a structured prompt
      |
RunAnywhere SDK passes prompt to local LlamaCpp runtime
      |
GGUF model runs inference on-device (NPU/GPU)
      |
Response parsed and rendered in-app
      |
0 bytes sent to any external server
```

---

## Privacy Architecture

```
+-------------------------------------+
|           Your Device               |
|                                     |
|  CodeVault App                      |
|       |                             |
|  RunAnywhere SDK                    |
|       |                             |
|  LlamaCpp Runtime                   |
|       |                             |
|  GGUF Model (stored locally)        |
|                                     |
|  No outbound network calls          |
|  No API keys required               |
|  No telemetry or logging            |
+-------------------------------------+
```

---

## Team

Built at the **GPT Challenge Hackathon** — Singularity x RunAnywhere.

| Name | Role |
|---|---|
| Suhani Jindal | Developer |

---

## Hackathon Context

**Event:** GPT Challenge Hackathon — Singularity x RunAnywhere
**Theme:** On-device AI applications that preserve privacy and eliminate cloud dependency
**Category:** Developer Tools / Privacy

CodeVault demonstrates that AI-powered developer tooling doesn't need to compromise on privacy or cost. With RunAnywhere SDK and LlamaCpp, a full LLM-based code review pipeline runs entirely within the constraints of a consumer Android device.

---

## License

MIT License — Copyright (c) 2026 Suhani Jindal

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

---

**CodeVault — Your code stays on your device. Always.**

Powered by RunAnywhere SDK · LlamaCpp · React Native
