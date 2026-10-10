# Validation — 2026-10-09

## Tested environment

Linux, Python 3.12, Chromium Headless Shell 134.0.6998.35, Playwright 1.51.1, CPU MediaPipe inference. Desktop viewport: 1536×1024. Narrow viewport: 390×844. These checks exercise the real bundled model, not mocked detector outputs.

## Passed

- Model initialized from bundled JavaScript, WASM and TFLite files.
- No external HTTP requests were needed by the running application.
- Actual model inference detected a face from a local video fixture.
- Actual model inference detected two faces in a two-face video fixture.
- Auto acquisition, release and reacquisition.
- Manual click-to-select face lock.
- Pause, backward seeking and resumed inference without timestamp errors.
- Camera access and inference through getUserMedia with a simulated camera feed.
- Stopping a camera released its stream and cleared the video source.
- WebM recording produced a non-empty VP9 video, independently inspected with ffprobe.
- PNG snapshot download and CSV export containing measured tracking rows.
- No-face footage cleared the previous target and telemetry.
- End-of-file state, unsupported-video handling and unavailable-camera handling.
- Desktop layout fits the viewport; mobile layout has no horizontal overflow.
- No uncaught JavaScript page errors during the tested media workflows.
- Five tracker unit tests passed: IoU, smoothing/ID continuity, one-to-one multi-face association, brief disappearance and expiration/reset.
- Python and JavaScript syntax checks passed.

## Not verified here

- A physical USB or built-in webcam on the user's computer. The browser camera path was tested with Chromium's simulated video input.
- Native Windows/macOS execution, other browser engines or every possible media codec.
- Long-duration recordings, crowded scenes, very low light, distant faces or identity continuity through occlusion.
- A guaranteed frame rate on the user's CPU. Actual processing depends on hardware and settings.

Dashboard-preview.png shows the final idle interface. The running app replaces the center viewport with live media. Test fixtures were created from the supplied reference for testing only and are not bundled as a pretend live camera.
