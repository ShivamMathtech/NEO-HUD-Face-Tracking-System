# NEO-HUD — Face Tracking System

A working local computer-vision application recreated from the supplied NEO-HUD dashboard reference. Dark cyan panels, green face brackets, single/multi-face modes, live telemetry, radar, motion trail, camera/video input and HUD recording.

## Start on Windows

1. **Extract the whole ZIP** into a normal folder. Do not run inside the ZIP viewer.
2. Install Python **3.10 or newer** if it is not already installed; enable “Add Python to PATH”. Python serves static files only: there are **no pip dependencies**.
3. Double-click **START_WINDOWS.bat**.
4. Open **http://localhost:8765** in desktop **Chrome or Edge** if the browser does not open automatically.
5. Wait for **Model: Loaded**, then click **Start Camera** and allow camera permission, or **Open Video File**.
6. Keep the terminal open while using the app. Press Ctrl+C to shut down the server.

Manual start:

```powershell
python server.py
# If port 8765 is occupied:
python server.py --port 8766
```

On macOS/Linux:

```bash
python3 server.py
# or:
sh start.sh
```

No npm install, build step, GPU, API key or internet connection is required to run the extracted application. The MediaPipe runtime, WebAssembly files and pretrained model are bundled. A recent desktop Chrome/Edge is the supported browser target; other browsers have not been validated.

## Controls

| Control | Behavior |
| --- | --- |
| Camera dropdown | Select an available webcam; permission reveals device names |
| Start / Stop Camera | Start capture at an ideal 1280×720, 30 FPS; stop releases the device |
| Open Video File | Play a local browser-supported video without uploading it |
| Single Face (Auto Lock) | Lock the largest detected face, then retain its spatial track |
| Multiple Faces | Display all detected faces and temporary track IDs |
| Manual Selection | Click a cyan face box to choose the primary track |
| Acquire & Track / TRACK | Enable acquisition again; manual mode waits for a click |
| Release Lock | Continue face detection, but disable automatic lock |
| Smoothing Strength | Increase to reduce box jitter at the cost of visual lag |
| Detection Confidence | Filter detector scores below the chosen threshold |
| Processing Resolution | Limit inference width; preserve the video's aspect ratio |
| RECORD | Start/stop silent WebM capture of the viewport plus HUD; saves to Downloads |
| SETTINGS | Mirror webcam, draw trajectories, fill/crop view, inference FPS cap, PNG snapshot, CSV export |
| − / □ / × | Compact header / browser fullscreen / stop source |
| Video transport | Play/pause, seek, playback speed and loop; appears for files |

The original screenshot's person and example numbers are **not** a static background. Your real camera/video replaces the center view, and telemetry reflects actual detections. Before a source is active, the viewport shows an empty grid. Browser media controls appear only for a file. Native operating-system window controls are represented by useful browser actions.

## Telemetry

- **Confidence:** the actual model detection score; it is not a probability of identity.
- **Target ID:** a temporary session track number, not facial recognition or a stored identity.
- **Face Position:** smoothed face-box center in original source pixels.
- **Center Offset:** center minus the source midpoint. Positive x = source-right; positive y = down.
- **Direction:** movement of the smoothed center between detection updates; `Stable` means under two source pixels. This is not head pose or gaze estimation.
- **FPS:** inference-result rate over a rolling 1.5-second window, not camera FPS.
- **Processing Time:** worker inference time. **Latency:** capture/resize, queue and inference round trip; these can differ.
- **Radar:** normalized 2D frame positions. The red dot marks the primary face, cyan dots other faces, and the green diamond the frame center. It does not measure physical distance.
- **Motion Trail:** recent 2D face-center positions for the primary track; no fabricated history.
- **Bottom ruler:** horizontal face-center offset as a percentage of source width, capped at ±40% on the ruler. Mirroring changes the displayed ruler direction; numeric telemetry and CSV use the original unmirrored source.

## Smooth playback

Video decoding and display run independently of inference. A dedicated Web Worker performs CPU inference. Only one frame is processed at a time; busy frames are skipped instead of queued. There is no per-frame HTTP upload. Default inference width is 640 and the cap is 30 FPS; the actual rate depends on CPU, browser, camera and source resolution.

For slower laptops, use 480 processing width and a 15–20 inference FPS cap. Reduce the browser window size if recording is slow. Higher smoothing reduces jitter but adds lag. No specific FPS is guaranteed on the user's hardware.

## Video and recording

- Use **H.264 MP4** or **VP8/VP9 WebM**. MOV works only when its codec is supported by the browser. The app does not transcode unsupported codecs.
- Seeking resets spatial tracks; a replay starts a new sequence of IDs. The model receives monotonically increasing wall-clock timestamps even after seeking backwards.
- Tracking data is held in memory for the current source, at up to 10 rows/second, capped at the latest 18,000 rows. Export before changing sources or refreshing.
- WebM recordings include the source image and canvas HUD (boxes, IDs, confidence and ruler), without audio or the side panels. Recording while paused captures a still image. Stop recording to save it before closing the tab.
- Encoded recording chunks remain in memory until saved. A 256 MiB threshold automatically stops and saves a recording; use shorter segments for long sessions. Resizing the browser during recording can affect the recorded canvas dimensions; keep the window size fixed.
- Uploaded video files are opened as local object URLs and do not leave the browser. Only camera access is requested, never microphone access. Source files are not modified.

## Model and tracking scope

The bundled pretrained **MediaPipe BlazeFace short-range** model is designed for nearby faces. Side profiles, very small/distant faces, severe occlusion and poor illumination may be missed. This is a real pretrained neural detector, not a hard-coded rectangle or a screenshot animation.

Track association uses bounding-box overlap, gated center distance and exponential smoothing. Tracks survive short detection gaps (750 ms), but boxes are drawn only for visible detections. After long occlusion, crossing faces or scene cuts, IDs can change. It does not do biometric identification, face re-identification or persistent identity storage.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Python is not recognized | Install Python, enable PATH, reopen the terminal; try `py -3 server.py` |
| Missing files / model error | Extract the entire ZIP; preserve the `web/vendor/wasm` and `web/models` folders |
| Camera denied | Allow camera for localhost via the address-bar permissions; refresh |
| Camera busy | Close Zoom, Teams or other camera apps and start again |
| No webcam | Connect one, select it, or use a video file |
| Blank page using `file://` | Launch `server.py` and use the localhost URL |
| Video won't play | Convert externally to H.264 MP4 or VP8/VP9 WebM |
| No face detected | Use frontal, well-lit, nearby faces; try a 0.35 confidence threshold |
| Recording unsupported | Use desktop Chrome/Edge; allow browser downloads |
| Low FPS | Lower processing width and inference FPS cap; close CPU-heavy programs |
| Port in use | Start with `python server.py --port 8766` |

## Source layout

```text
Neo-HUD-Face-Tracking/
  START_WINDOWS.bat          Windows launcher
  start.sh                  macOS/Linux launcher
  server.py                 Loopback-only standard-library HTTP server
  web/
    index.html              Dashboard structure and icons
    styles.css              Reference-inspired responsive HUD styling
    app.mjs                 Sources, rendering, controls, recording and exports
    tracker.mjs             Spatial association and smoothing
    detector.worker.js      MediaPipe CPU inference in a worker
    vendor/                 Bundled MediaPipe JavaScript/WASM distributions
    models/                 Bundled pretrained detector
  tests/tracker.test.mjs     Automated tracker tests (Node 18+)
  docs/                     Architecture, validation and third-party information
```

Run the tracker tests with `node --test tests/tracker.test.mjs`. Node is optional for development tests and is not needed to use the app.

See `docs/VALIDATION.md` for exactly what was tested and `docs/THIRD_PARTY.md` for model provenance and licenses.
