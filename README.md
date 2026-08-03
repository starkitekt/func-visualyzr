# 𝑓(𝑥) : func-visualyzr

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![KaTeX](https://img.shields.io/badge/Rendered%20with-KaTeX-002f56?style=flat-square)](https://katex.org/)
[![Math.js](https://img.shields.io/badge/Engine-Math.js-7fb800?style=flat-square)](https://mathjs.org/)

An interactive, high-fidelity mathematical visualization canvas designed with an obsession for fluid motion, clean layout ergonomics, and mathematical precision. It combines real-time function parsing, analytical calculus computation, and a custom glassmorphic interface into a unified spatial viewport.

Live Viewport: [starkitekt.github.io/fxviz](https://starkitekt.github.io/fxviz/)

---

```
                                      [ User Interaction ]
                                               │
                                               ▼
                              ┌─────────────────────────────────┐
                              │    Glassmorphic Input Panel     │
                              └────────────────┬────────────────┘
                                               │
                                               ▼
                              ┌─────────────────────────────────┐
                              │        Math.js Compiler         │
                              └────────────────┬────────────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
       ┌───────────────────────────────┐               ┌───────────────────────────────┐
       │   KaTeX Formula HUD (LaTeX)   │               │   Calculus Engine (Integral)  │
       └───────────────────────────────┘               └───────────────┬───────────────┘
                                                                       │
                                                                       ▼
                                                       ┌───────────────────────────────┐
                                                       │   60FPS Canvas Render Loop    │
                                                       └───────────────────────────────┘
```

---

## 🎨 Design System & Motion Specification

This project is built as a study in high-precision micro-interactions. The interface eliminates visual clutter in favor of spatial hierarchies and premium feedback cycles.

### Fluid Layout Ergonomics
* **Zero-Layout-Shift Resizing**: The viewport utilizes a specialized window resize observer bound to the primary requestAnimationFrame tick loop. Rather than triggering abrupt browser reflows, the HTML5 Canvas dimensions are computed dynamically, adjusting coordinates and scaling vectors in real-time to preserve fluid canvas sizing.
* **Floating Edge-Tracking Toggle**: The collapse/expand button sits directly on the boundary of the sidebar panel. On desktop, it centers on the sidebar's left border (`right: 364px`). On mobile devices, it uses a dynamic CSS viewport constraint `right: calc(min(85vw, 350px) - 16px)` to trace the edge of the sliding drawer drawer with absolute precision.
* **Consolidated Math Keyboard**: To prevent horizontal workspace shifts, the math virtual keyboard is engineered as a persistent bottom-anchored tray using a custom glassmorphic backdrop filter and slide-up transition state.

### Motion Physics & Micro-interactions
* **The Transition Curve**: All panel slide and resize transitions utilize a custom Apple-inspired ease-out cubic-bezier curve:
  $$\text{transition: } 0.4s \ \text{cubic-bezier}(0.16, 1, 0.3, 1)$$
* **Active Press Scaling**: Wobbly translations or offset hovers are replaced with a flat active depress state to mimic physical buttons:
  $$\text{transform: scale}(0.96)$$

---

## 🛠️ Interactive Capabilities

| Feature | Technical Implementation | Design Details |
| :--- | :--- | :--- |
| **Dual-Curve Plotting** | Evaluates independent equations for $f(x)$ and $g(x)$ in real-time using Math.js compilation nodes. | Curated HSL color palette (sapphire-blue for $f(x)$, steel-blue for $g(x)$) with custom glow & bloom filters. |
| **Interactive Calculus** | Compute the Riemann sum or analytic-definite integral $\int_{a}^{b} f(x) \,dx$ or $\int_{a}^{b} |f(x) - g(x)| \,dx$ on the fly. | Interactive shading overlay matching curve opacity and showing precise coordinate grid highlights. |
| **Intersection Solver** | Iterative numerical analysis detects mathematical crossings within the active viewport limits. | Floating HUD display updating values in real-time as equations or scaling change. |
| **Intuitive Analogies** | Maps abstract derivatives to physical velocities (speedometer) and integrals to cumulative totals (odometer). | Contextual cards that rewrite text formulas dynamically based on the current math function. |
| **Keyboard Drawer** | Fully custom, tabbed layout split into Basic, Functions, Greek Constants, and Advanced operators. | Glassmorphic overlay container (`backdrop-filter: blur(20px)`) with tactile depress states. |

---

## ⚙️ Under-the-Hood Optimizations

1. **Analytical Differentiation**: Using Math.js expression trees, the visualizer computes exact analytical derivatives (e.g. $x^2 \to 2x$) rather than relying on noisy numerical approximations.
2. **Coordinate Matrix Translation**: The canvas maps models to screen space using lightweight coordinate-mapping functions:
   $$\text{toScreenX}(x) = (x - \text{pan.x}) \times \text{scale.x}$$
   $$\text{toScreenY}(y) = \text{height} - (y - \text{pan.y}) \times \text{scale.y}$$
3. **Double Buffering & Glow Pipeline**: Uses standard 2D canvas drawing paths, layered with alpha channels, to draw the glowing neon effect under curves without requiring heavy WebGL shaders.
4. **Client-Side Rendering GIF Exporter**: Compiles canvas frame arrays into compact, shareable GIFs inside a background Web Worker to keep the UI threat responsive.

---

## 🚀 Local Development

The visualizer is written entirely in vanilla HTML/CSS/JS with zero compilation stages required.

1. Clone the repository:
   ```bash
   git clone https://github.com/starkitekt/func-visualyzr.git
   ```
2. Launch a local web server (to load local KaTeX font assets correctly):
   ```bash
   python -m http.server 8000
   ```
3. Open `http://localhost:8000` in Google Chrome or Safari.
