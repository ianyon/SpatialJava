# ⬡ SpatialJava

SpatialJava is a spatial IDE extension for VS Code that transforms Java development into a 2D architectural experience. Instead of scrolling through long vertical files, SpatialJava maps your methods onto an infinite canvas, allowing you to visualize and edit the logic flow of your classes in real-time.

🎮 **[Live Interactive Demo](https://ianyon.github.io/SpatialJava/)**

## ✨ Features

- **Spatial Editing:** Edit Java methods directly within 2D nodes. No more vertical scrolling.
- **Live Call Graph:** Real-time SVG connections track method calls within the same file directly from the exact line and word of invocation.
- **Ghost Scaffolding:** Detects missing method calls and provides "Quick Fix" buttons to generate and wire them up instantly.
- **API Highlighting:** Public methods are automatically organized in the primary left column to maintain architectural clarity.
- **Smart Navigation:** Hold Cmd/Ctrl and click any function call to smoothly fly the camera to its definition.
- **Trackpad & Mobile Optimized:** Full two-finger pan, smooth pinch-to-zoom, and touch support for desktop and mobile devices.

## 🚀 Getting Started

1. Clone this repository.
2. Run `npm install`.
3. Run `npm run compile`.
4. Press `F5` in VS Code to launch the Extension Development Host.
5. Open any `.java` file and run the command **"SpatialJava: Open Spatial Editor"** (or click the button in the top-right editor title bar).

*Tip:* You can also open `src/webview.html` directly in any web browser to try out the standalone interactive demo!

## 🛠 Project Structure

- `src/extension.ts`: Main entry point and command registration.
- `src/parser.ts`: Lightweight Java method and intra-file call parser.
- `src/VisualizerPanel.ts`: Manages the VS Code Webview lifecycle and data injection.
- `src/webview.html`: The self-contained spatial UI, editor, and SVG rendering engine.
- `DESIGN.md`: Complete architectural specification and design decisions.

## ⚖️ License

Distributed under the Apache License 2.0. See [LICENSE](LICENSE) for more information.
