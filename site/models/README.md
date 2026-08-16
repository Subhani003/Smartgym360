# Models

Drop compressed `.glb` files here and they replace the procedural geometry
automatically — no code change needed.

Expected filenames (matching `kind` in src/three/layout.js):

    rack.glb   bench.glb   dumbbell.glb   treadmill.glb   legpress.glb

Any file that is absent falls back to the code-built version, so partial
coverage is fine — add them one at a time.

Target: under 1.5 MB each. See docs/15-3d-asset-pipeline.md.
