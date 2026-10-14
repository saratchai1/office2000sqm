# OFFICE 2000 — actual O4F P03 model

Public viewer: https://office2000sqm.vercel.app

The owner authorized publishing `O4F_BIM_P03_lod.glb` on 14 October 2026. The initial demo engine is no longer the application entry point. `viewer.js` displays geometry derived from the uploaded model automatically.

## What works

Orbit/pan/zoom, front/right/top cameras, height-slice floor selection, roof cut, per-system hide/show and isolation, MEP-only mode, ceiling visibility, ghosted building, system colors, screenshot, GLB download, and local-only GLB preview.

## Classification limitations — important

The source is one node and one mesh with 88 material primitives. It has no authored system, object, or floor metadata. System labels are **inferred visual groups**, not certified BIM properties. Geometry is partitioned using source materials and connected-component bounding boxes. Architecture and structure remain combined because they share connected geometry. Uncertain ceiling devices remain in a separate unclassified/shared group. Red rooftop VRF units are classified as HVAC, not fire equipment.

There are 97 material/system mesh groups, not 97 devices. All 2,917,791 original triangles are retained, with exact position/normal/UV vertex deduplication. A single oversized texture is resized from 8551×5330 to fit 2048 pixels. No geometry decimation, coordinate quantization, or fabricated building geometry is used. Floors are inferred clipping slices around Y=0,4,8,12,16 m, not restored BIM floor identities. Clipped surfaces are not capped. No engineering sizing, safety compliance, collision check, or quantity takeoff is asserted.

## Asset storage / reproducible build

Original: 190,153,384 bytes. Prepared GLB: 162,451,584 bytes. Gzip transfer: 45,868,812 bytes. `model-config.json` pins SHA-256 and sizes; the build fails rather than deploy a missing or wrong model. The prepared GLB includes per-node `extras.system`, `sourceMaterial`, and inference notes.

The binary asset is hosted on Vercel, **not committed to Git**. A backup gzip is stored in the owner's Drive. For local work download the deployed `assets/O4F_BIM_P03_web.glb.gz` into the same relative local path, or set `MODEL_ASSET_SOURCE` to a valid HTTPS asset source. The default build copies the verified asset from the currently live website into the new deployment, so the published version does not rely on a third-party CDN at runtime. Preserve an offline asset backup before deleting the current Vercel project. If the project is recreated, seed it from the local backup or another authorized asset URL.

```sh
npm install
npm run build
python3 -m http.server 8080 --directory dist
```

Three.js is pinned to 0.168.0. The build copies the required modules to the same origin; no runtime npm CDN is required. Files chosen through Local Preview stay in the browser and do not modify the public project. Plain GLBs without `extras.system` are shown under unclassified; they are not silently given fabricated BIM metadata.

The displayed 2,000 square metres is the owner's approximate project description, not a measured net floor area.
