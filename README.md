# func-visualyzr

> A premium, interactive mathematical curve and calculus visualizer featuring 3blue1brown-inspired aesthetics, real-time animations, and high-precision controls.

Live Demo: [https://starkitekt.github.io/func-visualyzr/](https://starkitekt.github.io/func-visualyzr/)

---

## 🌟 Key Features

* **Dual Curve Plotting**: Support for parsing, rendering, and animating mathematical functions $f(x)$ and $g(x)$ in real-time.
* **Interactive Calculus Engine**:
  * Calculates and shades the definite integral (area under $f(x)$ or between $f(x)$ and $g(x)$).
  * Automatically solves and marks intersection coordinates.
  * Real-time analytical derivative ($f'(x)$ and $g'(x)$) calculations.
* **Apple-Style High-Precision UI**:
  * Floating canvas control row (Play, Restart) perfectly aligned with a modular collapsible panel toggle.
  * Fully collapsible settings panel with custom glassmorphic aesthetics.
  * Smooth animations with 60fps frame-by-frame canvas resizing in the animation tick loop.
* **Integrated Math Virtual Keyboard**:
  * A sliding glassmorphic tray with four tabs: Basic, Functions, Greek & Constants, and Advanced operators.
  * Facilitates rapid equation input for touchscreens and advanced symbols not easily accessible on standard keyboards.
* **Analogy HUD & Reference Cards**:
  * Features a real-time intuitive explanation card mapping the current function to real-world physical models (e.g. mapping derivative to speedometer and area to odometer).
  * Collapsible Reference Accordion for linear, quadratic, exponential, and trigonometric typologies.
* **Export GIF**: Supports recording canvas loops and exporting them to shareable `.gif` files.

---

## 🛠️ Technology Stack

* **Core Structure & Logic**: HTML5, Vanilla JavaScript, CSS3 custom properties (variables)
* **Mathematical Utilities**:
  * **[Math.js](https://mathjs.org/)**: For parsing equations and obtaining derivatives analytically.
  * **[KaTeX](https://katex.org/)**: For rendering beautiful LaTeX-like mathematical formulas on-screen.
* **Exporting Engine**: **[Gifshot](https://yahoo.github.io/gifshot/)** for client-side animated GIF rendering.

---

## 🚀 Getting Started Locally

1. Clone this repository:
   ```bash
   git clone https://github.com/starkitekt/func-visualyzr.git
   ```
2. Open `index.html` in your web browser. Alternatively, run a local development server:
   ```bash
   python -m http.server 8000
   ```
3. Open `http://localhost:8000` in Google Chrome or Safari for the best experience.

---

## 🎨 Design Philosophy

Designed to prioritize **visual excellence and motion flow**. All UI transitions use Apple-inspired cubic-bezier curves (`cubic-bezier(0.16, 1, 0.3, 1)`) with zero layout shifts, giving the visualizer a state-of-the-art interactive feel.
