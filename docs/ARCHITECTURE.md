# Architecture

Browser camera or local file → native video decoder → display canvas.
The display runs on requestAnimationFrame independently of the detector.
At the configured inference interval, if the worker is idle, a resized ImageBitmap is transferred to the worker. MediaPipe runs detectForVideo with CPU delegation and returns normalized boxes and scores. The main thread filters by confidence, associates boxes with spatial tracks and smooths their coordinates. This drives the overlay, primary target, radar, trail and telemetry.

The worker closes each transferred bitmap. The main thread never queues additional inference frames while busy. Source generation tokens discard results belonging to a replaced source or a seek. Camera promises also use tokens so a delayed permission response cannot reactivate a source that was stopped. Source changes stop all media tracks, revoke old object URLs and finalize any active recording.

MediaPipe's unmodified CommonJS browser-compatible distribution loads in a classic worker using a local `exports` shim. Its WASM resolver selects SIMD when supported, with the non-SIMD files available as fallback. All runtime URLs are relative to the included server root. No network CDN or remote model request occurs at application runtime.

The HTTP server binds to 127.0.0.1 and only serves the `web` directory. It has no video upload endpoint, database, accounts or remote inference service. The browser owns local media and downloads. localStorage stores display/performance preferences only.

## Tracking and limits

The tracker constructs candidate pairs using IoU and a size-gated center distance. Greedy association ensures one detection per track per update. Coordinates are exponentially smoothed; scores are the current raw detector scores. Only visible detections are rendered; unmatched tracks stay internally for at most 750 ms. This design is lightweight, not an identity-preserving appearance model. Faces crossing or re-entering may receive different IDs.

The radar is normalized screen-space plotting, not a physical radar sensor. The movement trail is spatial, not a time-series confidence graph. No head-angle estimation, emotion classification or person identification is implemented.

## Development

Edit the files directly and refresh the browser; there is no compilation step. JavaScript modules are deliberately separated into UI orchestration, reusable tracker and worker inference. Python exists only to supply HTTP and correct MIME types. The downloaded vendor files remain unmodified; application files are readable source.
