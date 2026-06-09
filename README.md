# Cactus Gemma

A multimodal mobile app powered by the [Cactus](https://github.com/cactus-compute/cactus) inference engine, running [Gemma 4 E2B](https://ai.google.dev/gemma) - vision, speech, and text - on-device. Point your camera, ask out loud or type, get a streamed answer.

## Features

- **Snap & ask** - take a photo, speak or type a question, watch a streamed markdown reply.
- **Live mode** - hold to ask; the model captures a frame and your voice prompt on each press.
- **On-device first** - runs locally with automatic cloud handoff when the local model's confidence falls below threshold.

## Quickstart

Requirements: Node 20.19.4+, Yarn, and Xcode (iOS) or Android Studio (Android). A physical android/ios device.

```bash
git clone https://github.com/cactus-compute/cactus-gemma4.git
cd cactus-gemma4
yarn install

# iOS
yarn expo run:ios

# Android
yarn expo run:android
```

On first launch the app downloads 4-bit weights (~5 GB) from [huggingface.co/Cactus-Compute/gemma-4-E2B-it](https://huggingface.co/Cactus-Compute/gemma-4-E2B-it). Apple devices pull the NPU-optimised build; Android pulls the CPU build.

> **iOS signing:** `app.json` ships with a Cactus Compute `appleTeamId`. If you're building from outside that team, replace `expo.ios.appleTeamId` with your own Apple Developer Team ID.

## References

- [Cactus](https://github.com/cactus-compute/cactus) - the on-device inference engine that powers this app
- [Gemma](https://ai.google.dev/gemma) - Google's open model family
- [Cactus-Compute/gemma-4-E2B-it](https://huggingface.co/Cactus-Compute/gemma-4-E2B-it) - 4-bit weights used at runtime
