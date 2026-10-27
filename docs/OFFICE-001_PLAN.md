# Main Workspace — implementation plan

Spec: DESIGN.md and TASKS.md. User continuation on 27 October authorizes the next interactive preview.

Scope: one white isometric Main Workspace, six desks, plants, pan/zoom/reset, and one Akira reference preview that can walk to reachable floor cells. No live AI or full eight-room implementation.

Architecture: lazy-loaded Phaser scene inside React; pure projection/navigation functions; declarative grid and furniture; original character sheet sampled by texture frames at runtime. White background blended with the floor for this preview, not a production transparent atlas. Source files in Img remain unchanged.

Ruling: implement the minimum movement proof alongside the room because the user specifically asked about characters moving. SPRITE-001 and OFFICE-002 remain partial, not production-complete. Use procedural isometric geometry rather than introduce a Tiled editor/export dependency for one room; migrate authoring later if needed. Existing uncommitted workspace is retained; no commit/push.

- [x] Write failing tests for projection round trips, shortest reachable routes, blocked/outside/unreachable destinations and same-cell movement.
- [x] Implement model in apps/web/src/office/model.ts and declarative room data.
- [x] Implement scene and React lifecycle with async-import cancellation, ResizeObserver cleanup, scene destruction, error fallback, DOM movement destinations, reduced motion and camera controls.
- [x] Integrate Kantor page and correct shell scope labels.
- [x] Run tests/typecheck/lint/build; browser check movement, obstruction, zoom, resize, route remount and screenshot; compare original asset hashes. Limits recorded in OFFICE-001_REPORT.md.

Review focus: rapid repeated destination changes must not cut through furniture; resize and route changes must not duplicate canvases; touch must retain page scrolling; stale asynchronous imports must not mount scenes; missing sprite must be reported with an honest placeholder.
