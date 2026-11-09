# SpatialJava: Architecture & Design Specification

## 1. Project Overview & Core Philosophy

**SpatialJava** is a Visual Studio Code extension that transforms traditional vertical Java files into an interactive, 2D spatial canvas (Spatial IDE). Instead of scrolling up and down through hundreds of lines of code to trace execution flow, methods are represented as individual rounded cards arranged horizontally from left to right based on their call depth.

### Key Goals
- **Spatial Call-Stack Comprehension:** Utilize horizontal monitor space to visualize the call hierarchy within a single class.
- **Intra-File Focus:** Only visualize and connect function calls that reference methods within the same file/class. External library calls (e.g., `System.out.println()`) are ignored by the graph engine to prevent visual clutter.
- **Live Spatial Editing:** Function cards are not static read-only views; they are live code editors. Modifying code updates the AST/call graph in real-time.
- **Zero-Config Layout:** Automatically organize methods by depth while allowing manual drag-and-drop overrides.

---

## 2. System Architecture (VS Code Extension)

The project is split into a backend Extension Host (TypeScript/Node.js) and a frontend Canvas UI (Vanilla JS/HTML/CSS inside a VS Code Webview).

### 2.1. Extension Host (`src/extension.ts`, `src/VisualizerPanel.ts`)
- **Activation:** Triggered via the command `spatialJava.open` when a `.java` file is active in the editor.
- **Webview Management:** `VisualizerPanel` manages the VS Code Webview lifecycle (`vscode.ViewColumn.Beside`), reading `src/webview.html` and injecting the parsed JSON payload directly into the HTML string by replacing the `// INJECT_DATA_START ... // INJECT_DATA_END` block with `const RAW = ...`.

### 2.2. Lightweight Java Parser (`src/parser.ts`)
Instead of relying on a heavy Language Server Protocol (LSP) or external AST library, SpatialJava uses a fast regex- and brace-counting parser:
- **Signature Extraction:** Uses regex `/((?:(?:public|private|protected|static|final|abstract|synchronized|native|strictfp)\s+)*[\w<>\[\]]+\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*(?:throws\s+[a-zA-Z_$0-9,\s]+)?)\s*\{/g` to locate method headers, filtering out control keywords (`if`, `for`, `while`, `switch`, `catch`).
- **Body Extraction:** Counts opening `{` and closing `}` braces starting from the signature match to accurately extract the full method block.
- **Call Detection:** Scans the extracted method body using `/(?<!\.)\b([a-z][a-zA-Z0-9_$]*)\s*\(/g` (ignoring calls preceded by a dot `.` to filter out external object method calls) to build an adjacency list of intra-file method calls.
- **Visibility Flagging:** Checks if the signature contains `public` to mark the method as an API entry point (`isPublic: true`).

---

## 3. Frontend Canvas Engine (`src/webview.html`)

To keep the extension ultra-fast and dependency-free, the entire frontend is built in a single self-contained HTML file using Vanilla JS, CSS variables, and an SVG overlay.

### 3.1. Infinite Canvas & Coordinate Space
- **Structure:** `#canvas-wrap` acts as the viewport (`position: fixed; overflow: hidden`). Inside it:
  - `#world` holds the cards.
  - `#svg-overlay` holds connection lines.
  - `#ghosts-layer` holds interactive quick-fix buttons.
- **Camera Transform:** Panning and zooming are controlled by a global state object `transform = { x, y, scale }` applied via CSS: `world.style.transform = translate(x, y) scale(scale)` with `transform-origin: 0 0`.
- **Coordinate Mapping:** Because `#world` is scaled via CSS, any DOM measurement using `getBoundingClientRect()` is converted back into `#world` local coordinates before drawing SVG paths:
  $$\text{localX} = \frac{\text{rect.right} - \text{worldRect.left}}{\text{transform.scale}}$$
  $$\text{localY} = \frac{\text{rect.top} + \frac{\text{rect.height}}{2} - \text{worldRect.top}}{\text{transform.scale}}$$

### 3.2. Auto-Layout & The "API Column"
- **Column 0 (API Endpoints):** Methods with `isPublic: true` are treated as the class's public API. Placed in the leftmost column ($x = 60$) and stacked vertically, styled with a distinct green left border (`--green`).
- **Private Methods (BFS Topological Sort):** Non-public methods are assigned horizontal columns ($x = 60 + \text{depth} \times 600$) based on their call depth from public methods using Breadth-First Search (BFS) and in-degree tracking.
- **Full-Height Cards:** Cards do not have internal scrollbars or max-height limits. They expand vertically to fit 100% of the method code (even 200+ line methods), ensuring all outgoing call lines are visible simultaneously. Vertical spacing dynamically accounts for `el.offsetHeight + 60px`.

### 3.3. Two-Part "Laser Beam" Edge Routing
Connections originate from the exact word in the code where the call happens:
- **DOM Anchor Tagging:** The custom syntax highlighter wraps every function call word (`word()`) in `<span class="fn">`.
- **Inner Path (The Laser):** A dashed horizontal SVG line (`stroke-dasharray: 2 4`) is drawn from the right edge of the specific `<span class="fn">` straight to the right border of the parent `.node-card`.
- **Outer Path (The Bridge):** A solid cubic Bezier curve (`M ... C ...`) swoops from the right border of the caller card to the left vertical center of the target `.node-card`, terminating with an SVG `<marker>` arrowhead.
- **Dynamic Color Hashing:** If a single line of code contains nested or chained calls (e.g., `merge(fetchA(), fetchB())`), the engine hashes each target method's name (`getColorForTarget()`) against a 9-color vivid palette (`PALETTE`). The `<span class="fn">` text color, inner dashed line, outer Bezier curve, and arrowhead marker all share that exact hashed color.

### 3.4. Live Transparent Editor Layering
To allow editing code inside cards without losing syntax highlighting or importing heavy editors like Monaco:
- Each `.editor-container` stacks a `<textarea class="code-editor">` directly on top of a `<pre class="code-view">` using `position: absolute`.
- Both share identical typography (`JetBrains Mono`, `font-size: 11px`, `line-height: 1.6`, `white-space: pre`, `tab-size: 4`).
- The `<textarea>` has `color: transparent; background: transparent; caret-color: var(--text-hi)`. The user types into the invisible textarea while seeing colored HTML rendered in the `<pre>` directly beneath.
- On every `input` event:
  - Textarea auto-resizes to match `<pre>` height.
  - Raw string is re-highlighted via `hl()` and injected into `<pre>`.
  - `parseLocalCalls()` re-extracts method calls in real time.
  - `requestAnimationFrame(drawEdges)` redraws all SVG connections immediately.

### 3.5. Ghost Nodes & Missing Reference Scaffolding
When a user types a function call (e.g., `signDocument();`) that does not exist in `RAW.methods`:
- **Detection:** `drawEdges()` checks if the target call name exists in `definedMethodNames`.
- **Visual Error State:** The `<span class="fn">` is colored red (`#e06c75`) with a line-through. An SVG dashed red bezier curve (`.ghost-edge`) shoots out 150px to the right of the card, ending in an X marker (`#arr-error`).
- **Quick-Fix Scaffolding:** A floating HTML button (`.ghost-btn`) reading `+ Create signDocument()` is spawned in `#ghosts-layer` at the end of the broken line. Clicking it invokes `createMethod()`, which appends a new stub method to `RAW.methods`, renders the new card next to the caller, wires the valid connection, and smoothly pans to the newly created function.

### 3.6. Recursion Handling
- Recursive calls (cycles detected via DFS state tracking or `isRecursive` flags) do not point backward.
- They route forward to a lightweight Stub Node (`.node-card.stub`) placed in the next column, styled with a dashed red border and a `↺ stub` badge.

---

## 4. Interaction & Input Mechanics

### 4.1. Desktop & Trackpad Controls
- **Two-Finger Scroll / Mouse Wheel:** Pans canvas horizontally and vertically (`transform.x -= e.deltaX; transform.y -= e.deltaY`).
- **Pinch-to-Zoom / Ctrl/Cmd + Scroll:** Zooms canvas centered around cursor position.
- **MacBook Trackpad Fix:** Uses smooth exponential decay based on `deltaY`:
  $$d = e^{-\text{deltaY} \times 0.005}$$
- **Background Drag:** Clicking and dragging empty canvas space pans the viewport.
- **Card Dragging:** Strictly bound to `.card-header` (with `e.preventDefault()` to stop native element drag hijacking). Dragging inside `.card-body` is ignored so text can be freely selected inside the `<textarea>`.

### 4.2. Mobile & Touch Controls
- **1-Finger Swipe on Background:** Pans canvas (`touchstart` / `touchmove` on `#canvas-wrap`).
- **2-Finger Pinch:** Zooms canvas around midpoint of fingers using `Math.hypot()` distance ratios.
- **1-Finger Drag on `.card-header`:** Moves individual cards and recalculates SVG edges in real time.

### 4.3. Cmd / Ctrl + Click Smart Navigation
- Holding `Meta` (`Cmd`) or `Ctrl` toggles `.nav-mode` on `<body>`.
- In `.nav-mode`, `<textarea>` gets `pointer-events: none` and `<pre class="code-view">` gets `pointer-events: auto`. Function calls (`.fn`) turn into underlined clickable hyperlinks.
- Clicking a `.fn` span triggers `navigateTo(targetName)`, which activates smooth CSS cubic-bezier transition (`.panning`), centers the camera on the target card, and triggers a `@keyframes flashCard` highlight animation.

---

## 5. Visual Design & Theme Tokens

- **Aesthetic:** Dark, modern, high-contrast developer theme inspired by One Dark / Tokyo Night.
- **Fonts:** `Syne` (800 weight) for UI headers; `JetBrains Mono` for code, signatures, badges, and buttons.
- **Color Tokens:**
  - `--bg`: `#0d0f14` (Canvas background)
  - `--surface`: `#161922` (Card background)
  - `--border`: `#252b3a` / `--border-hi`: `#3a4460`
  - `--accent`: `#5b8af0` (Primary blue)
  - `--accent2`: `#c678dd` (Keywords - purple)
  - `--green`: `#98c379` (Strings & API badges)
  - `--yellow`: `#e5c07b` (Types)
  - `--orange`: `#d19a66` (Numbers)
  - `--red`: `#e06c75` (Recursion, errors, ghost nodes)

---

## 6. Future Roadmap & Known Decisions

1. **Two-Way File Sync (AST Write-Back):** Send `vscode.postMessage()` back to `VisualizerPanel.ts` to reconstruct the Java class and apply a `vscode.WorkspaceEdit` to save changes back to the underlying `.java` file on disk.
2. **Method Overloading:** Upgrade graph keys from simple method names (`m.name`) to normalized signature keys (e.g., `parse(String)` vs `parse(int)`).
3. **Editable Signatures:** Enable editing `.sig-line` and `.method-name` in card headers to modify return types, parameters, and method names dynamically.
