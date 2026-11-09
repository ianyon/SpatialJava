# SpatialJava

An interactive 2D spatial canvas for Java intra-file call hierarchy visualization and live editing inside Visual Studio Code.

## Overview

SpatialJava is a Visual Studio Code extension that transforms traditional vertical Java files into an interactive, 2D spatial canvas (Spatial IDE). Instead of scrolling up and down through hundreds of lines of code to trace execution flow, methods are represented as individual rounded cards arranged horizontally from left to right based on their call depth.

## Key Features

- **Spatial Call-Stack Comprehension:** Utilizes horizontal monitor space to visualize the call hierarchy within a single class.
- **Intra-File Focus:** Only visualizes and connects method calls within the same file/class, filtering out external library noise.
- **Two-Part "Laser Beam" Edge Routing:** Call connections originate from the exact token in code with dashed horizontal lines out to the card edge, transitioning into cubic Bezier curves targeting the invoked method card.
- **Live Transparent Editor Layering:** In-place code editing using synchronized transparent `<textarea>` layered over syntax-highlighted `<pre>`.
- **Ghost Nodes & Quick-Fix Scaffolding:** Unresolved method calls are highlighted in red with an interactive quick-fix button to scaffold new methods instantly.
- **Recursion Handling:** Circular references gracefully route forward to lightweight stub nodes to prevent layout cycles.

## Architecture & Design Decisions

For full technical specifications, AST parsing logic, coordinate space math, and future roadmap, see [ARCHITECTURE.md](./ARCHITECTURE.md).
