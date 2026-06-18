### Section 1: Outline Letters Text Shadows

Crayon outline effects created using custom HSL values and text shadow layers.


### Section 2: Custom Crayon Border Radii

Wobbly borders implemented using asymmetric border-radius values (e.g. 255px 15px/15px 225px).


### Section 3: Mouse and Touch Coordinate Mapping

Coordinate adjustments calculated using canvas.getBoundingClientRect() and devicePixelRatio scaling.


### Section 4: Canvas Paint Toolbar and Swatches

Drawing paint tools (brush size slider, eraser toggle, color palettes) placed in a floating toolbar.


### Section 5: Canvas Undo and Redo Memory Buffers

25-state undo/redo history stack tracking ImageData arrays inside React useRef buffers.


### Section 6: Offscreen Canvas Compositing

Offscreen canvas paints translucent drawings onto solid white backgrounds prior to AI upload.


### Section 7: Client-Side JPEG Conversion

Canvas exports encoded as JPEG base64 strings to minimize API payloads.


### Section 8: Real-Time Auto-Guess Loop Watcher

Poll loops query guess updates every 2.5 seconds in Sandbox mode when the canvas is dirty.


### Section 9: Creative Interpretation Text Cards

Sandbox results rendered inside crayon paper containers featuring custom generated text descriptions.


### Section 10: Challenge Mode countdown Timers

40-second timers with alert notifications when time falls below 10 seconds.


### Section 11: Real-Time Guess Logs

List panels render guesses in order of confidence, highlighting matches dynamically.


### Section 12: Settings Modal Panel

Drawer layouts include form fields for host configuration and model download list buttons.


### Section 13: Local Download Progress

Background streams pipe NDJSON bytes from Ollama to render local download progress percentage bars.


### Section 14: Lucide Icons Version Resolution

Lucide icon imports resolved for newer version updates (CheckCircle, XCircle).


