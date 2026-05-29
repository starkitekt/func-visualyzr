// --- Configuration & Constants ---
const DEFAULT_POINTS = [
    { x: 2, y: 4 },
    { x: 4, y: 16 },
    { x: 6, y: 36 },
    { x: 8, y: 64 },
    { x: 10, y: 100 }
];

const COLORS = {
    bg: '#050912',
    gridMajor: '#0C1220',
    gridMinor: '#080E1A',
    axis: '#1E2E48',
    text: '#7a93b8',
    curveF: '#1A7FFF',       // Electric sapphire
    curveG: '#5B9CF6',       // Steel blue
    point: '#D0E8FF',        // Platinum ice
    guideline: '#1A4A8A',    // Dark sapphire guideline
    highlight: '#0F52BA',
    areaF: 'rgba(26, 127, 255, 0.06)',
    areaBetween: 'rgba(91, 156, 246, 0.07)'
};

// --- App State ---
let currentFormulaF = 'x^2';
let currentFormulaG = 'x + 2';
let parsedF = { depVar: 'y', indepVar: 'x', expr: 'x^2' };
let parsedG = { depVar: 'y', indepVar: 'x', expr: 'x + 2' };
let isGEnabled = false;

let isPlaying = true;
let animationSpeed = 1.0;
let showGrid = true;
let showGuidelines = true;
let enableGlow = true;

// Calculus Configuration
let showAreaF = true;
let showAreaBetween = false;
let integrationStart = 0;
let integrationEnd = 4;
let intersectionPoints = [];

// Zoom and Pan state
let scale = { x: 50, y: 4.5 };
let pan = { x: 80, y: 550 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let originalPan = { x: 0, y: 0 };

// Animation Time State (in seconds)
let time = 0;
const STAGE1_DURATION = 1.0; // Grid fade
const STAGE2_DURATION = 2.0; // Guidelines / points
const STAGE3_DURATION = 2.0; // Curves
const STAGE4_DURATION = 1.0; // HUD & Analogy
const TOTAL_DURATION = STAGE1_DURATION + STAGE2_DURATION + STAGE3_DURATION + STAGE4_DURATION;

// Virtual Keyboard Target
let activeInputId = 'functionInput';

// Exporter/Recording State
let isRecording = false;
let recordedFrames = [];
const RECORD_FPS = 12;
let recordTimer = 0;
const GIF_W = 480;
const GIF_H = 300;

// Hover state
let hoveredPointIndex = -1;

// Elements
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
const formulaTextF = document.getElementById('formula-text-f');
const formulaTextG = document.getElementById('formula-text-g');
const hudGCard = document.getElementById('hud-g-card');
const tooltip = document.getElementById('tooltip');

const btnPlayPause = document.getElementById('btnPlayPause');
const btnRestart = document.getElementById('btnRestart');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');

const functionInputF = document.getElementById('functionInput');
const functionInputG = document.getElementById('functionInputG');
const chkEnableG = document.getElementById('chkEnableG');
const rowGInput = document.getElementById('row-g-input');
const rowShowAreaBetween = document.getElementById('row-show-area-between');

const chkShowArea = document.getElementById('chkShowArea');
const chkShowAreaBetween = document.getElementById('chkShowAreaBetween');
const intStartInput = document.getElementById('intStart');
const intEndInput = document.getElementById('intEnd');

const valIntegral = document.getElementById('valIntegral');
const valIntersections = document.getElementById('valIntersections');
const analogyCard = document.getElementById('analogyCard');

const mathKbd = document.getElementById('mathKbd');
const btnRecordGIF = document.getElementById('btnRecordGIF');
const recordStatus = document.getElementById('recordStatus');
const recordStatusText = document.getElementById('recordStatusText');

const chkGrid = document.getElementById('chkGrid');
const chkGuidelines = document.getElementById('chkGuidelines');
const chkGlow = document.getElementById('chkGlow');

// --- Helper Math Parser ---
function parseFunctionExpression(input) {
    let clean = input.trim();
    let depVar = 'y';
    let indepVar = 'x';
    let expr = clean;

    if (clean.includes('=')) {
        const parts = clean.split('=');
        const left = parts[0].trim().toLowerCase();
        const right = parts[1].trim();
        if (left === 'x') {
            depVar = 'x';
            indepVar = 'y';
            expr = right;
        } else if (left === 'y') {
            depVar = 'y';
            indepVar = 'x';
            expr = right;
        } else {
            expr = right;
            if (expr.includes('y') && !expr.includes('x')) {
                depVar = 'x';
                indepVar = 'y';
            } else {
                depVar = 'y';
                indepVar = 'x';
            }
        }
    } else {
        if (clean.includes('y') && !clean.includes('x')) {
            depVar = 'x';
            indepVar = 'y';
        } else {
            depVar = 'y';
            indepVar = 'x';
        }
    }
    return { depVar, indepVar, expr };
}

function evaluateMath(expr, val, variable = 'x') {
    try {
        if (typeof math === 'undefined') return NaN;
        const scope = {};
        scope[variable] = val;
        const res = math.evaluate(expr, scope);
        return isNaN(res) || !isFinite(res) ? 0 : res;
    } catch (e) {
        return NaN;
    }
}

// LaTeX formatting for KaTeX
function formatFormulaLaTeX(parsed, label = 'f') {
    const { depVar, indepVar, expr } = parsed;
    if (typeof math !== 'undefined') {
        try {
            return `${label}(${indepVar}) = ${math.parse(expr).toTex()}`;
        } catch (e) {}
    }
    let s = expr;
    s = s.replace(/Math\./gi, '');
    s = s.replace(/\*/g, ''); 
    s = s.replace(/(\w+)\^(\w+)/g, '$1^{$2}');
    s = s.replace(/sin/g, '\\sin');
    s = s.replace(/cos/g, '\\cos');
    s = s.replace(/tan/g, '\\tan');
    s = s.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}');
    s = s.replace(/pi/g, '\\pi');
    return `${label}(${indepVar}) = ${s}`;
}

function updateFormulaHUDs() {
    if (window.katex && typeof math !== 'undefined') {
        try {
            window.katex.render(formatFormulaLaTeX(parsedF, 'f'), formulaTextF);
            
            let derivF = `${parsedF.depVar}'(${parsedF.indepVar}) = `;
            try {
                const dF = math.derivative(parsedF.expr, parsedF.indepVar);
                derivF += math.parse(dF.toString()).toTex();
            } catch (e) {
                derivF += '\\text{Derivative unavailable}';
            }
            window.katex.render(derivF, document.getElementById('derivative-text-f'));
            
            if (isGEnabled) {
                window.katex.render(formatFormulaLaTeX(parsedG, 'g'), formulaTextG);
                
                let derivG = `${parsedG.depVar}'(${parsedG.indepVar}) = `;
                try {
                    const dG = math.derivative(parsedG.expr, parsedG.indepVar);
                    derivG += math.parse(dG.toString()).toTex();
                } catch (e) {
                    derivG += '\\text{Derivative unavailable}';
                }
                window.katex.render(derivG, document.getElementById('derivative-text-g'));
            }
        } catch (e) {
            formulaTextF.innerText = `${parsedF.depVar}(${parsedF.indepVar}) = ${parsedF.expr}`;
            if (isGEnabled) {
                formulaTextG.innerText = `${parsedG.depVar}(${parsedG.indepVar}) = ${parsedG.expr}`;
            }
        }
    } else {
        formulaTextF.innerText = `${parsedF.depVar}(${parsedF.indepVar}) = ${parsedF.expr}`;
        if (isGEnabled) {
            formulaTextG.innerText = `${parsedG.depVar}(${parsedG.indepVar}) = ${parsedG.expr}`;
        }
    }
}

// Convert coordinates
function toCanvasX(modelX) { return pan.x + modelX * scale.x; }
function toCanvasY(modelY) { return pan.y - modelY * scale.y; }
function toModelX(canvasX) { return (canvasX - pan.x) / scale.x; }
function toModelY(canvasY) { return (pan.y - canvasY) / scale.y; }

function drawArrowhead(ctx, fromX, fromY, toX, toY, size = 10) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
}

// Numerical Definite Integrator (Trapezoidal Rule)
function integrate(parsedF, parsedG, start, end, between = false) {
    const steps = 400;
    const h = (end - start) / steps;
    let sum = 0;

    for (let i = 0; i <= steps; i++) {
        const val = start + i * h;
        let valF = evaluateMath(parsedF.expr, val, parsedF.indepVar);
        if (isNaN(valF)) valF = 0;

        let resVal = valF;
        if (between) {
            let valG = evaluateMath(parsedG.expr, val, parsedG.indepVar);
            if (isNaN(valG)) valG = 0;
            resVal = Math.abs(valF - valG);
        }

        if (i === 0 || i === steps) {
            sum += resVal / 2;
        } else {
            sum += resVal;
        }
    }
    return sum * h;
}

// Numerical Intersection Finder
function solveIntersections() {
    intersectionPoints = [];
    if (!isGEnabled) return;

    const indepF = parsedF.indepVar;
    const indepG = parsedG.indepVar;

    if (indepF === 'x' && indepG === 'x') {
        const xMin = toModelX(0);
        const xMax = toModelX(canvas.width);
        const sampleStep = 0.05;
        const evalDiff = (x) => evaluateMath(parsedF.expr, x, 'x') - evaluateMath(parsedG.expr, x, 'x');
        findRoots(xMin, xMax, sampleStep, evalDiff, (mid) => {
            return { x: mid, y: evaluateMath(parsedF.expr, mid, 'x') };
        });
    } else if (indepF === 'y' && indepG === 'y') {
        const yMin = toModelY(canvas.height);
        const yMax = toModelY(0);
        const sampleStep = 0.05;
        const evalDiff = (y) => evaluateMath(parsedF.expr, y, 'y') - evaluateMath(parsedG.expr, y, 'y');
        findRoots(yMin, yMax, sampleStep, evalDiff, (mid) => {
            return { x: evaluateMath(parsedF.expr, mid, 'y'), y: mid };
        });
    } else if (indepF === 'x' && indepG === 'y') {
        const xMin = toModelX(0);
        const xMax = toModelX(canvas.width);
        const sampleStep = 0.05;
        const evalDiff = (x) => {
            const y = evaluateMath(parsedF.expr, x, 'x');
            const gx = evaluateMath(parsedG.expr, y, 'y');
            return x - gx;
        };
        findRoots(xMin, xMax, sampleStep, evalDiff, (mid) => {
            return { x: mid, y: evaluateMath(parsedF.expr, mid, 'x') };
        });
    } else if (indepF === 'y' && indepG === 'x') {
        const yMin = toModelY(canvas.height);
        const yMax = toModelY(0);
        const sampleStep = 0.05;
        const evalDiff = (y) => {
            const x = evaluateMath(parsedF.expr, y, 'y');
            const gy = evaluateMath(parsedG.expr, x, 'x');
            return y - gy;
        };
        findRoots(yMin, yMax, sampleStep, evalDiff, (mid) => {
            return { x: evaluateMath(parsedF.expr, mid, 'y'), y: mid };
        });
    }
}

function findRoots(minVal, maxVal, step, diffFn, getPointFn) {
    let prevDiff = diffFn(minVal);
    for (let val = minVal + step; val <= maxVal; val += step) {
        const diff = diffFn(val);
        if (isNaN(diff) || isNaN(prevDiff)) {
            prevDiff = diff;
            continue;
        }

        if (prevDiff * diff < 0) {
            let left = val - step;
            let right = val;
            let mid = (left + right) / 2;
            for (let k = 0; k < 8; k++) {
                mid = (left + right) / 2;
                const midDiff = diffFn(mid);
                if (prevDiff * midDiff < 0) {
                    right = mid;
                } else {
                    left = mid;
                }
            }
            const pt = getPointFn(mid);
            if (!isNaN(pt.x) && !isNaN(pt.y) && isFinite(pt.x) && isFinite(pt.y)) {
                intersectionPoints.push(pt);
            }
        }
        prevDiff = diff;
    }
}

// Dynamic Calculus Analogy Generator
function updateAnalogy() {
    let html = '';
    const formulaText = parsedF.indepVar === 'x' ? `f(x) = ${parsedF.expr}` : `f(y) = ${parsedF.expr}`;
    const isLinearF = /^[0-9xy+\-*\s]+$/.test(parsedF.expr) && !parsedF.expr.includes('^');
    const isQuadraticF = parsedF.expr.includes('^2') && !parsedF.expr.includes('^3');
    
    if (!isGEnabled) {
        html += `<div class="analogy-title">💡 Analogy: ${formulaText}</div>`;
        if (isLinearF) {
            html += `<p>This curve describes **constant speed**. The derivative is a flat speedometer reading: you are moving at a steady pace.</p>`;
        } else if (isQuadraticF) {
            html += `<p>This curve represents **constant acceleration** (like gravity). The derivative is a linear speedometer: your speed rises steadily over time.</p>`;
        } else if (parsedF.expr.includes('sin') || parsedF.expr.includes('cos')) {
            html += `<p>This curve represents **oscillation** (like a pendulum). The derivative matches a cosine/sine wave: speed peaks as the pendulum passes the center and drops to zero at the maximum swing.</p>`;
        } else {
            html += `<p>This represents a **dynamic rate of change**. Every step along ${parsedF.indepVar} changes ${parsedF.depVar} dynamically. The derivative reveals the steepness (slope) at that precise point.</p>`;
        }

        if (showAreaF) {
            html += `<p><strong>Odometer (Area):</strong> Shading from ${integrationStart} to ${integrationEnd} tracks the **accumulated quantity**. If the curve is speed, this area is the exact distance traveled.</p>`;
        }
    } else {
        html += `<div class="analogy-title">💡 Two Curves Intersecting</div>`;
        html += `<p><strong>Intersections:</strong> The points where the curves meet represent **balance**. Here, both systems share the exact same state or position.</p>`;
        
        if (showAreaBetween) {
            html += `<p><strong>Area Between:</strong> Shading represents the **accumulated difference** between the two systems over time. If they are competitor revenues, this is the total gap in their earnings.</p>`;
        }
    }

    analogyCard.innerHTML = html;
}

// Make a beautiful striped diagonal pattern for area between curves
let stripePattern;
function createAreaPattern() {
    const stripeCanvas = document.createElement('canvas');
    stripeCanvas.width = 12;
    stripeCanvas.height = 12;
    const sCtx = stripeCanvas.getContext('2d');
    sCtx.strokeStyle = 'rgba(91, 156, 246, 0.28)';
    sCtx.lineWidth = 1.5;
    sCtx.beginPath();
    sCtx.moveTo(0, 12);
    sCtx.lineTo(12, 0);
    sCtx.stroke();
    stripePattern = ctx.createPattern(stripeCanvas, 'repeat');
}

// Adjust view parameters to contain key details
function autoFitViewport() {
    const xs = [];
    const ys = [];
    
    if (parsedF.indepVar === 'x') {
        xs.push(integrationStart, integrationEnd);
        for (let x = integrationStart; x <= integrationEnd; x += 0.5) {
            ys.push(evaluateMath(parsedF.expr, x, 'x'));
        }
    } else {
        ys.push(integrationStart, integrationEnd);
        for (let y = integrationStart; y <= integrationEnd; y += 0.5) {
            xs.push(evaluateMath(parsedF.expr, y, 'y'));
        }
    }

    if (isGEnabled) {
        if (parsedG.indepVar === 'x') {
            xs.push(integrationStart, integrationEnd);
            for (let x = integrationStart; x <= integrationEnd; x += 0.5) {
                ys.push(evaluateMath(parsedG.expr, x, 'x'));
            }
        } else {
            ys.push(integrationStart, integrationEnd);
            for (let y = integrationStart; y <= integrationEnd; y += 0.5) {
                xs.push(evaluateMath(parsedG.expr, y, 'y'));
            }
        }
    }
    
    intersectionPoints.forEach(pt => {
        xs.push(pt.x);
        ys.push(pt.y);
    });

    const cleanYs = ys.filter(y => !isNaN(y) && isFinite(y));
    if (cleanYs.length === 0) return;

    const minX = Math.min(-1, ...xs) - 1;
    const maxX = Math.max(5, ...xs) + 1;
    const minY = Math.min(-2, ...cleanYs) - 2;
    const maxY = Math.max(10, ...cleanYs) + 2;

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    scale.x = (canvas.width - 240) / rangeX;
    scale.y = (canvas.height - 240) / rangeY;

    // Prevent extreme differences in scale
    const aspect = scale.x / scale.y;
    if (aspect > 6) scale.x = scale.y * 6;
    if (aspect < 0.15) scale.y = scale.x * 6.6;

    pan.x = 100 - minX * scale.x;
    pan.y = canvas.height - 120 + minY * scale.y;
}

// --- Render / Paint Functions ---
function drawGrid() {
    if (!showGrid) return;
    
    const xMin = toModelX(0);
    const xMax = toModelX(canvas.width);
    const yMin = toModelY(canvas.height);
    const yMax = toModelY(0);

    const getSpacing = (currentScale) => {
        const targetPixels = 70;
        const approxUnits = targetPixels / currentScale;
        const log = Math.log10(approxUnits);
        const base = Math.pow(10, Math.floor(log));
        const ratio = approxUnits / base;
        if (ratio < 2) return base;
        if (ratio < 5) return base * 2;
        return base * 5;
    };

    const xSpacing = getSpacing(scale.x);
    const ySpacing = getSpacing(scale.y);

    ctx.save();
    ctx.lineWidth = 1;

    // Vertical grid
    const xStart = Math.floor(xMin / xSpacing) * xSpacing;
    for (let x = xStart; x <= xMax; x += xSpacing) {
        if (Math.abs(x) < 0.0001) continue;
        ctx.strokeStyle = COLORS.gridMinor;
        ctx.beginPath();
        ctx.moveTo(toCanvasX(x), 0);
        ctx.lineTo(toCanvasX(x), canvas.height);
        ctx.stroke();
    }

    // Horizontal grid
    const yStart = Math.floor(yMin / ySpacing) * ySpacing;
    for (let y = yStart; y <= yMax; y += ySpacing) {
        if (Math.abs(y) < 0.0001) continue;
        ctx.strokeStyle = COLORS.gridMinor;
        ctx.beginPath();
        ctx.moveTo(0, toCanvasY(y));
        ctx.lineTo(canvas.width, toCanvasY(y));
        ctx.stroke();
    }
    
    ctx.restore();
}

function drawAxes(axisOpacity = 1.0) {
    ctx.save();
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = COLORS.axis;
    ctx.globalAlpha = axisOpacity;

    const originX = toCanvasX(0);
    const originY = toCanvasY(0);

    // X Axis line
    ctx.beginPath();
    ctx.moveTo(0, originY);
    ctx.lineTo(canvas.width - 15, originY);
    ctx.stroke();
    drawArrowhead(ctx, canvas.width - 30, originY, canvas.width - 2, originY, 10);

    // Y Axis line
    ctx.beginPath();
    ctx.moveTo(originX, canvas.height);
    ctx.lineTo(originX, 15);
    ctx.stroke();
    drawArrowhead(ctx, originX, 30, originX, 2, 10);

    // Add Axis Labels
    ctx.font = 'italic 16px "EB Garamond", serif';
    ctx.fillStyle = COLORS.text;
    ctx.fillText('x', canvas.width - 25, originY + 25);
    ctx.fillText('y', originX - 25, 25);

    // Numbers
    ctx.font = '12px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.text;
    
    const xMin = toModelX(0);
    const xMax = toModelX(canvas.width);
    const yMin = toModelY(canvas.height);
    const yMax = toModelY(0);

    const xSpacing = scale.x > 30 ? 2 : 5;
    const ySpacing = scale.y > 10 ? 10 : 20;

    // X ticks
    const xStart = Math.ceil(xMin / xSpacing) * xSpacing;
    for (let x = xStart; x <= xMax; x += xSpacing) {
        if (x === 0) continue;
        const cx = toCanvasX(x);
        ctx.beginPath();
        ctx.moveTo(cx, originY - 4);
        ctx.lineTo(cx, originY + 4);
        ctx.stroke();
        ctx.fillText(x.toString(), cx, originY + 8);
    }

    // Y ticks
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yStart = Math.ceil(yMin / ySpacing) * ySpacing;
    for (let y = yStart; y <= yMax; y += ySpacing) {
        if (y === 0) continue;
        const cy = toCanvasY(y);
        ctx.beginPath();
        ctx.moveTo(originX - 4, cy);
        ctx.lineTo(originX + 4, cy);
        ctx.stroke();
        ctx.fillText(y.toString(), originX - 8, cy);
    }
    
    ctx.restore();
}

// Draw projection lines at integration bounds
function drawGuidelinesAndArea(progress) {
    if (progress <= 0) return;

    ctx.save();
    
    const isIndepY = (parsedF.indepVar === 'y');
    const originX = toCanvasX(0);
    const originY = toCanvasY(0);

    const valFStart = evaluateMath(parsedF.expr, integrationStart, parsedF.indepVar);
    const valFEnd = evaluateMath(parsedF.expr, integrationEnd, parsedF.indepVar);

    // Guidelines at borders
    if (showGuidelines) {
        ctx.strokeStyle = COLORS.guideline;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;

        if (!isIndepY) {
            const startX = toCanvasX(integrationStart);
            const endX = toCanvasX(integrationEnd);

            // Start x line
            ctx.beginPath();
            ctx.moveTo(startX, originY);
            ctx.lineTo(startX, toCanvasY(valFStart));
            ctx.stroke();

            // End x line
            ctx.beginPath();
            ctx.moveTo(endX, originY);
            ctx.lineTo(endX, toCanvasY(valFEnd));
            ctx.stroke();
        } else {
            const startY = toCanvasY(integrationStart);
            const endY = toCanvasY(integrationEnd);

            // Start y line
            ctx.beginPath();
            ctx.moveTo(originX, startY);
            ctx.lineTo(toCanvasX(valFStart), startY);
            ctx.stroke();

            // End y line
            ctx.beginPath();
            ctx.moveTo(originX, endY);
            ctx.lineTo(toCanvasX(valFEnd), endY);
            ctx.stroke();
        }
    }

    // Draw shaded calculus area dynamically
    if (showAreaF && !showAreaBetween) {
        ctx.fillStyle = COLORS.areaF;
        ctx.beginPath();

        const samples = 100;
        const step = (integrationEnd - integrationStart) / samples;

        if (!isIndepY) {
            const startX = toCanvasX(integrationStart);
            ctx.moveTo(startX, originY);
            for (let i = 0; i <= samples; i++) {
                const x = integrationStart + i * step * progress;
                const y = evaluateMath(parsedF.expr, x, 'x');
                ctx.lineTo(toCanvasX(x), toCanvasY(y));
            }
            ctx.lineTo(toCanvasX(integrationStart + (integrationEnd - integrationStart) * progress), originY);
        } else {
            const startY = toCanvasY(integrationStart);
            ctx.moveTo(originX, startY);
            for (let i = 0; i <= samples; i++) {
                const y = integrationStart + i * step * progress;
                const x = evaluateMath(parsedF.expr, y, 'y');
                ctx.lineTo(toCanvasX(x), toCanvasY(y));
            }
            ctx.lineTo(originX, toCanvasY(integrationStart + (integrationEnd - integrationStart) * progress));
        }

        ctx.closePath();
        ctx.fill();
    }

    // Shaded area between f and g
    if (isGEnabled && showAreaBetween) {
        ctx.fillStyle = stripePattern || COLORS.areaBetween;
        ctx.beginPath();

        const samples = 100;
        const step = (integrationEnd - integrationStart) / samples;
        const indep = parsedF.indepVar;
        const isY = (indep === 'y');

        if (!isY) {
            ctx.moveTo(toCanvasX(integrationStart), toCanvasY(evaluateMath(parsedF.expr, integrationStart, 'x')));
            for (let i = 0; i <= samples; i++) {
                const val = integrationStart + i * step * progress;
                const outF = evaluateMath(parsedF.expr, val, 'x');
                ctx.lineTo(toCanvasX(val), toCanvasY(outF));
            }
            for (let i = samples; i >= 0; i--) {
                const val = integrationStart + i * step * progress;
                const outG = evaluateMath(parsedG.expr, val, parsedG.indepVar);
                ctx.lineTo(toCanvasX(val), toCanvasY(outG));
            }
        } else {
            ctx.moveTo(toCanvasX(evaluateMath(parsedF.expr, integrationStart, 'y')), toCanvasY(integrationStart));
            for (let i = 0; i <= samples; i++) {
                const val = integrationStart + i * step * progress;
                const outF = evaluateMath(parsedF.expr, val, 'y');
                ctx.lineTo(toCanvasX(outF), toCanvasY(val));
            }
            for (let i = samples; i >= 0; i--) {
                const val = integrationStart + i * step * progress;
                const outG = evaluateMath(parsedG.expr, val, parsedG.indepVar);
                ctx.lineTo(toCanvasX(outG), toCanvasY(val));
            }
        }

        ctx.closePath();
        ctx.fill();
    }

    ctx.restore();
}

function drawCurves(animProgress) {
    if (animProgress <= 0) return;

    const drawSingle = (parsed, color) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (enableGlow) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = color;
        }

        ctx.beginPath();
        let started = false;
        const step = 0.05;

        if (parsed.indepVar === 'x') {
            const minX = toModelX(0);
            const maxX = toModelX(canvas.width);
            const totalLength = maxX - minX;
            const animMaxX = minX + totalLength * animProgress;

            for (let x = minX; x <= animMaxX; x += step) {
                const y = evaluateMath(parsed.expr, x, 'x');
                if (isNaN(y)) continue;

                const cx = toCanvasX(x);
                const cy = toCanvasY(y);

                if (cy < -200 || cy > canvas.height + 200) {
                    started = false;
                    continue;
                }

                if (!started) {
                    ctx.moveTo(cx, cy);
                    started = true;
                } else {
                    ctx.lineTo(cx, cy);
                }
            }
        } else {
            const minY = toModelY(canvas.height);
            const maxY = toModelY(0);
            const totalLength = maxY - minY;
            const animMaxY = minY + totalLength * animProgress;

            for (let y = minY; y <= animMaxY; y += step) {
                const x = evaluateMath(parsed.expr, y, 'y');
                if (isNaN(x)) continue;

                const cx = toCanvasX(x);
                const cy = toCanvasY(y);

                if (cx < -200 || cx > canvas.width + 200) {
                    started = false;
                    continue;
                }

                if (!started) {
                    ctx.moveTo(cx, cy);
                    started = true;
                } else {
                    ctx.lineTo(cx, cy);
                }
            }
        }
        ctx.stroke();
        ctx.restore();
    };

    drawSingle(parsedF, COLORS.curveF);
    if (isGEnabled) {
        drawSingle(parsedG, COLORS.curveG);
    }
}

function drawIntersections() {
    if (!isGEnabled || intersectionPoints.length === 0) return;

    ctx.save();
    intersectionPoints.forEach((pt, idx) => {
        const cx = toCanvasX(pt.x);
        const cy = toCanvasY(pt.y);

        // Pulsing animation
        const pulse = 1 + 0.15 * Math.sin(Date.now() / 150 + idx);

        if (enableGlow) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = COLORS.point;
        }

        // Pulsing outer glow ring
        ctx.fillStyle = 'rgba(147, 197, 253, 0.18)';
        ctx.beginPath();
        ctx.arc(cx, cy, 10 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Inner solid dot
        ctx.fillStyle = COLORS.point;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fill();

        // Coordinates text
        ctx.font = '500 11px "DM Mono", monospace';
        ctx.fillStyle = COLORS.text;
        ctx.fillText(`(${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})`, cx + 12, cy - 6);
    });
    ctx.restore();
}

// --- Main Drawing Loop ---
function drawFrame() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let stage1 = 0; // Grid
    let stage2 = 0; // Guidelines
    let stage3 = 0; // Curve draw
    let stage4 = 0; // HUD overlays

    if (time < STAGE1_DURATION) {
        stage1 = time / STAGE1_DURATION;
    } else if (time < STAGE1_DURATION + STAGE2_DURATION) {
        stage1 = 1.0;
        stage2 = (time - STAGE1_DURATION) / STAGE2_DURATION;
    } else if (time < STAGE1_DURATION + STAGE2_DURATION + STAGE3_DURATION) {
        stage1 = 1.0;
        stage2 = 1.0;
        stage3 = (time - STAGE1_DURATION - STAGE2_DURATION) / STAGE3_DURATION;
    } else {
        stage1 = 1.0;
        stage2 = 1.0;
        stage3 = 1.0;
        stage4 = Math.min(1.0, (time - STAGE1_DURATION - STAGE2_DURATION - STAGE3_DURATION) / STAGE4_DURATION);
    }

    if (stage1 > 0) {
        drawGrid();
        drawAxes(stage1);
    }

    if (stage2 > 0) {
        drawGuidelinesAndArea(stage2);
    }

    if (stage3 > 0) {
        drawCurves(stage3);
    }

    if (stage4 > 0) {
        drawIntersections();
    }

    // Toggle formula HUD opacities
    const HUDs = document.querySelectorAll('.formula-card');
    HUDs.forEach(hud => {
        hud.style.opacity = stage3;
    });

    const overlayPanel = document.getElementById('mathOverlay');
    if (overlayPanel) {
        overlayPanel.style.opacity = stage4;
    }
}

// Draws the HUD overlays directly onto any canvas context
// (used so GIF frames include equation card + math details)
function drawCanvasOverlay(targetCtx, targetW, targetH) {
    const scaleW = targetW / canvas.width;
    const scaleH = targetH / canvas.height;

    // --- Stage fractions (re-compute from current time) ---
    let stage3 = 0, stage4 = 0;
    if (time >= STAGE1_DURATION + STAGE2_DURATION) {
        stage3 = Math.min(1.0, (time - STAGE1_DURATION - STAGE2_DURATION) / STAGE3_DURATION);
    }
    if (time >= STAGE1_DURATION + STAGE2_DURATION + STAGE3_DURATION) {
        stage4 = Math.min(1.0, (time - STAGE1_DURATION - STAGE2_DURATION - STAGE3_DURATION) / STAGE4_DURATION);
    }
    if (stage3 <= 0 && stage4 <= 0) return;

    targetCtx.save();

    // ---- TOP-LEFT: Equation + Derivative card ----
    if (stage3 > 0) {
        const cardX = 14 * scaleW;
        const cardY = 14 * scaleH;
        const cardW = 190 * scaleW;
        const cardH = (isGEnabled ? 90 : 65) * scaleH;
        const fs = Math.max(8, 13 * Math.min(scaleW, scaleH));
        const smallFs = Math.max(7, 10 * Math.min(scaleW, scaleH));

        // Deep navy glass background
        targetCtx.globalAlpha = stage3 * 0.94;
        targetCtx.fillStyle = 'rgba(5, 9, 18, 0.88)';
        roundRect(targetCtx, cardX, cardY, cardW, cardH, 10 * scaleW);
        targetCtx.fill();

        // Sapphire left border accent
        targetCtx.globalAlpha = stage3;
        targetCtx.fillStyle = '#1A7FFF';
        roundRect(targetCtx, cardX, cardY + cardH * 0.15, 3 * scaleW, cardH * 0.7, 2);
        targetCtx.fill();

        // Sapphire dot
        targetCtx.beginPath();
        targetCtx.arc(cardX + 16 * scaleW, cardY + 18 * scaleH, 4 * scaleW, 0, Math.PI * 2);
        targetCtx.fillStyle = '#1A7FFF';
        targetCtx.fill();

        // f(x) formula text
        targetCtx.font = `600 ${fs}px "DM Mono", monospace`;
        targetCtx.fillStyle = '#dce8f8';
        targetCtx.fillText(`${parsedF.depVar}(${parsedF.indepVar}) = ${parsedF.expr}`, cardX + 26 * scaleW, cardY + 22 * scaleH);

        // f'(x) derivative
        let derivFStr = `${parsedF.depVar}'(${parsedF.indepVar}) = (calculating)`;
        try {
            if (typeof math !== 'undefined') {
                const dF = math.derivative(parsedF.expr, parsedF.indepVar);
                derivFStr = `${parsedF.depVar}'(${parsedF.indepVar}) = ${dF.toString()}`;
            }
        } catch(e) {}
        targetCtx.font = `400 ${smallFs}px "DM Mono", monospace`;
        targetCtx.fillStyle = '#7a93b8';
        targetCtx.fillText(derivFStr, cardX + 10 * scaleW, cardY + 44 * scaleH);

        if (isGEnabled) {
            // Steel-blue dot for g(x)
            targetCtx.beginPath();
            targetCtx.arc(cardX + 16 * scaleW, cardY + 58 * scaleH, 4 * scaleW, 0, Math.PI * 2);
            targetCtx.fillStyle = '#5B9CF6';
            targetCtx.fill();

            targetCtx.font = `600 ${fs}px "DM Mono", monospace`;
            targetCtx.fillStyle = '#dce8f8';
            targetCtx.fillText(`${parsedG.depVar}(${parsedG.indepVar}) = ${parsedG.expr}`, cardX + 26 * scaleW, cardY + 62 * scaleH);

            let derivGStr = `${parsedG.depVar}'(${parsedG.indepVar}) = (calculating)`;
            try {
                if (typeof math !== 'undefined') {
                    const dG = math.derivative(parsedG.expr, parsedG.indepVar);
                    derivGStr = `${parsedG.depVar}'(${parsedG.indepVar}) = ${dG.toString()}`;
                }
            } catch(e) {}
            targetCtx.font = `400 ${smallFs}px "DM Mono", monospace`;
            targetCtx.fillStyle = '#7a93b8';
            targetCtx.fillText(derivGStr, cardX + 10 * scaleW, cardY + 80 * scaleH);
        }
    }

    // ---- BOTTOM-LEFT: Mathematical Details panel ----
    if (stage4 > 0) {
        const panelW  = 210 * scaleW;
        const panelH  = 62 * scaleH;
        const panelX  = 14 * scaleW;
        const panelY  = targetH - panelH - 14 * scaleH;
        const fs2     = Math.max(7, 11 * Math.min(scaleW, scaleH));

        targetCtx.globalAlpha = stage4 * 0.94;
        targetCtx.fillStyle = 'rgba(5, 9, 18, 0.90)';
        roundRect(targetCtx, panelX, panelY, panelW, panelH, 10 * scaleW);
        targetCtx.fill();

        targetCtx.globalAlpha = stage4;

        // Title
        targetCtx.font = `700 ${fs2}px "Plus Jakarta Sans", sans-serif`;
        targetCtx.fillStyle = '#374358';
        targetCtx.fillText('MATHEMATICAL DETAILS', panelX + 12 * scaleW, panelY + 16 * scaleH);

        // Area row
        const areaVal = showAreaF
            ? integrate(parsedF, parsedG, integrationStart, integrationEnd, false)
            : 0;
        targetCtx.font = `400 ${fs2}px "DM Mono", monospace`;
        targetCtx.fillStyle = '#7a93b8';
        targetCtx.fillText('Area (Integral):', panelX + 12 * scaleW, panelY + 33 * scaleH);
        targetCtx.font = `700 ${fs2}px "DM Mono", monospace`;
        targetCtx.fillStyle = '#1A7FFF';
        targetCtx.fillText(showAreaF ? areaVal.toFixed(2) : 'off', panelX + panelW - 50 * scaleW, panelY + 33 * scaleH);

        // Intersections row
        targetCtx.font = `400 ${fs2}px "DM Mono", monospace`;
        targetCtx.fillStyle = '#7a93b8';
        targetCtx.fillText('Intersections:', panelX + 12 * scaleW, panelY + 50 * scaleH);
        targetCtx.font = `700 ${fs2}px "DM Mono", monospace`;
        targetCtx.fillStyle = isGEnabled ? '#93C5FD' : '#374358';
        const iLabel = isGEnabled
            ? (intersectionPoints.length === 0 ? 'none' : intersectionPoints.map(p => `(${p.x.toFixed(1)},${p.y.toFixed(1)})`).join(' '))
            : 'g(x) disabled';
        targetCtx.fillText(iLabel.slice(0, 22), panelX + panelW - 80 * scaleW, panelY + 50 * scaleH);
    }

    targetCtx.restore();
}

// Helper: draw a rounded rectangle path
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

let lastTime = 0;
function tick(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const elapsed = (timestamp - lastTime) / 1000.0;
    lastTime = timestamp;

    // Smooth responsive canvas resizing (buttery-smooth during sidebar transitions)
    const containerW = canvas.parentElement.clientWidth;
    const containerH = canvas.parentElement.clientHeight;
    if (canvas.width !== containerW || canvas.height !== containerH) {
        canvas.width = containerW;
        canvas.height = containerH;
        createAreaPattern();
    }

    if (isPlaying) {
        time += elapsed * animationSpeed;
        if (time > TOTAL_DURATION) {
            time = TOTAL_DURATION;
            isPlaying = false;
            updatePlayPauseUI();
        }
    }

    drawFrame();

    // Export frame compiler
    if (isRecording) {
        recordTimer += elapsed;
        if (recordTimer >= 1 / RECORD_FPS) {
            recordTimer = 0;
            const offscreen = document.createElement('canvas');
            offscreen.width = GIF_W;
            offscreen.height = GIF_H;
            const oCtx = offscreen.getContext('2d');
            // 1. Copy the main canvas (graph, axes, curves, points)
            oCtx.drawImage(canvas, 0, 0, GIF_W, GIF_H);
            // 2. Draw the HTML overlay panels directly onto the offscreen canvas
            drawCanvasOverlay(oCtx, GIF_W, GIF_H);
            // Store raw pixel data for pure-JS GIF encoder
            recordedFrames.push(oCtx.getImageData(0, 0, GIF_W, GIF_H));

            const progress = Math.min(99, Math.floor((time / TOTAL_DURATION) * 100));
            recordStatusText.innerText = `Capturing frames... (${progress}%)`;
        }

        if (time >= TOTAL_DURATION) {
            finishRecording();
        }
    }

    requestAnimationFrame(tick);
}

// =============================================================
// Pure inline GIF89a encoder — zero external dependencies
// Based on LZW compression and GIF89a spec
// =============================================================

function encodeGIF(frames, width, height, delay) {
    // Quantize one frame's RGBA pixel data to a 256-colour palette
    function quantizeFrame(imageData) {
        const data = imageData.data;
        const palette = [];
        const palMap = {};
        const indices = new Uint8Array(width * height);

        for (let i = 0; i < data.length; i += 4) {
            // Reduce colour depth to 5-bits per channel (32^3 = 32768 possible colours)
            const r = data[i]     >> 3;
            const g = data[i + 1] >> 3;
            const b = data[i + 2] >> 3;
            const key = (r << 10) | (g << 5) | b;

            if (palMap[key] === undefined) {
                if (palette.length < 255) {
                    palMap[key] = palette.length;
                    palette.push([data[i], data[i + 1], data[i + 2]]);
                } else {
                    // Find closest colour
                    let best = 0, bestDist = Infinity;
                    for (let j = 0; j < palette.length; j++) {
                        const dr = data[i] - palette[j][0];
                        const dg = data[i+1] - palette[j][1];
                        const db = data[i+2] - palette[j][2];
                        const d = dr*dr + dg*dg + db*db;
                        if (d < bestDist) { bestDist = d; best = j; }
                    }
                    palMap[key] = best;
                }
            }
            indices[i >> 2] = palMap[key];
        }

        // Pad palette to 256 entries
        while (palette.length < 256) palette.push([0, 0, 0]);
        return { palette, indices };
    }

    // LZW encoder
    function lzwEncode(indices, minCodeSize) {
        const clearCode = 1 << minCodeSize;
        const eofCode = clearCode + 1;
        let codeSize = minCodeSize + 1;
        let bits = 0;
        let curByte = 0;
        const bytes = [];

        function writeBits(code) {
            curByte |= code << bits;
            bits += codeSize;
            while (bits >= 8) {
                bytes.push(curByte & 0xff);
                curByte >>= 8;
                bits -= 8;
            }
        }

        function flush() {
            if (bits > 0) bytes.push(curByte & 0xff);
        }

        let table = {};
        function resetTable() {
            table = {};
            codeSize = minCodeSize + 1;
            for (let i = 0; i < clearCode; i++) table[String(i)] = i;
        }
        resetTable();

        writeBits(clearCode);
        let nextCode = eofCode + 1;
        let str = String(indices[0]);

        for (let i = 1; i < indices.length; i++) {
            const c = String(indices[i]);
            const k = str + ',' + c;
            if (table[k] !== undefined) {
                str = k;
            } else {
                writeBits(table[str]);
                if (nextCode < 4096) {
                    table[k] = nextCode++;
                    if (nextCode > (1 << codeSize)) codeSize = Math.min(codeSize + 1, 12);
                } else {
                    writeBits(clearCode);
                    resetTable();
                    nextCode = eofCode + 1;
                }
                str = c;
            }
        }
        writeBits(table[str]);
        writeBits(eofCode);
        flush();
        return bytes;
    }

    // Write bytes helper
    function write(arr, ...vals) { for (const v of vals) arr.push(v); }
    function writeStr(arr, s) { for (let i = 0; i < s.length; i++) arr.push(s.charCodeAt(i)); }
    function writeU16(arr, n) { arr.push(n & 0xff); arr.push((n >> 8) & 0xff); }

    const out = [];

    // GIF Header
    writeStr(out, 'GIF89a');
    writeU16(out, width);
    writeU16(out, height);
    write(out, 0xF7, 0x00, 0x00); // Global colour table flag, 256 colours, bg=0

    // Use first frame's palette as global palette
    const { palette: globalPalette } = quantizeFrame(frames[0]);
    for (const [r, g, b] of globalPalette) write(out, r, g, b);

    // Netscape looping extension
    write(out, 0x21, 0xFF, 0x0B);
    writeStr(out, 'NETSCAPE2.0');
    write(out, 0x03, 0x01, 0x00, 0x00, 0x00);

    for (const frame of frames) {
        const { palette, indices } = quantizeFrame(frame);

        // Graphic Control Extension (delay in 10ms units)
        write(out, 0x21, 0xF9, 0x04, 0x00);
        writeU16(out, Math.round(delay * 100)); // delay in centiseconds
        write(out, 0x00, 0x00);

        // Image Descriptor
        write(out, 0x2C);
        writeU16(out, 0); writeU16(out, 0); // x, y
        writeU16(out, width); writeU16(out, height);
        write(out, 0x87); // Local colour table, 256 entries

        // Local colour table
        for (const [r, g, b] of palette) write(out, r, g, b);

        // LZW image data
        const minCodeSize = 8;
        write(out, minCodeSize);
        const lzwData = lzwEncode(indices, minCodeSize);

        // Write in sub-blocks of max 255 bytes
        let offset = 0;
        while (offset < lzwData.length) {
            const blockSize = Math.min(255, lzwData.length - offset);
            write(out, blockSize);
            for (let i = 0; i < blockSize; i++) out.push(lzwData[offset++]);
        }
        write(out, 0x00); // Block terminator
    }

    write(out, 0x3B); // GIF trailer
    return new Uint8Array(out);
}

// --- Exporter Engine ---
function startRecording() {
    if (isRecording) return;
    recordedFrames = [];
    isRecording = true;
    isPlaying = true;
    time = 0;
    recordTimer = 0;
    btnRecordGIF.classList.add('recording');
    btnRecordGIF.querySelector('span:last-child').innerText = 'Recording...';
    recordStatus.classList.remove('hidden');
    recordStatusText.innerText = 'Capturing frames... (0%)';
}

function finishRecording() {
    isRecording = false;
    btnRecordGIF.classList.remove('recording');
    btnRecordGIF.querySelector('span:last-child').innerText = 'Record GIF';
    recordStatusText.innerText = 'Encoding GIF...';

    if (recordedFrames.length === 0) {
        recordStatus.classList.add('hidden');
        return;
    }

    // Run encoding asynchronously to avoid blocking the UI
    setTimeout(() => {
        try {
            const gifData = encodeGIF(recordedFrames, GIF_W, GIF_H, 1 / RECORD_FPS);
            const blob = new Blob([gifData], { type: 'image/gif' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = 'math_visualization.gif';
            link.href = url;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            recordStatus.classList.add('hidden');
        } catch (err) {
            console.error('GIF encoding failed:', err);
            recordStatusText.innerText = 'Failed: ' + err.message;
        }
    }, 50);
}

// --- Interactive Events & UI Sync ---
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    createAreaPattern();
    drawFrame();
}

function handleMouseDown(e) {
    isDragging = true;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    originalPan.x = pan.x;
    originalPan.y = pan.y;
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDragging) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        pan.x = originalPan.x + dx;
        pan.y = originalPan.y + dy;
    }
}

function handleMouseUp() {
    isDragging = false;
}

// Mobile Touch Support
let isPinching = false;
let initialTouchDistance = 0;
let initialScale = { x: 50, y: 4.5 };

function handleTouchStart(e) {
    if (e.touches.length === 1) {
        isDragging = true;
        isPinching = false;
        dragStart.x = e.touches[0].clientX;
        dragStart.y = e.touches[0].clientY;
        originalPan.x = pan.x;
        originalPan.y = pan.y;
    } else if (e.touches.length === 2) {
        isDragging = false;
        isPinching = true;
        initialTouchDistance = getTouchDistance(e);
        initialScale.x = scale.x;
        initialScale.y = scale.y;
        originalPan.x = pan.x;
        originalPan.y = pan.y;
    }
}

function handleTouchMove(e) {
    if (isDragging && e.touches.length === 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - dragStart.x;
        const dy = e.touches[0].clientY - dragStart.y;
        pan.x = originalPan.x + dx;
        pan.y = originalPan.y + dy;
    } else if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        const currentDist = getTouchDistance(e);
        if (initialTouchDistance > 0) {
            const zoomFactor = currentDist / initialTouchDistance;
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const rect = canvas.getBoundingClientRect();
            const canvasMidX = midX - rect.left;
            const canvasMidY = midY - rect.top;

            const modelX = (canvasMidX - originalPan.x) / initialScale.x;
            const modelY = (originalPan.y - canvasMidY) / initialScale.y;

            scale.x = Math.max(5, Math.min(1000, initialScale.x * zoomFactor));
            scale.y = Math.max(0.5, Math.min(200, initialScale.y * zoomFactor));

            pan.x = canvasMidX - modelX * scale.x;
            pan.y = canvasMidY + modelY * scale.y;
        }
    }
}

function handleTouchEnd(e) {
    isDragging = false;
    isPinching = false;
}

function getTouchDistance(e) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function handleWheel(e) {
    e.preventDefault();
    const zoomFactor = 1.1;
    const mouseX = e.clientX - canvas.getBoundingClientRect().left;
    const mouseY = e.clientY - canvas.getBoundingClientRect().top;

    const modelX = toModelX(mouseX);
    const modelY = toModelY(mouseY);

    if (e.deltaY < 0) {
        scale.x *= zoomFactor;
        scale.y *= zoomFactor;
    } else {
        scale.x /= zoomFactor;
        scale.y /= zoomFactor;
    }

    pan.x = mouseX - modelX * scale.x;
    pan.y = mouseY + modelY * scale.y;
}

function updatePlayPauseUI() {
    const playIcon = document.getElementById('playIcon');
    const label = btnPlayPause.querySelector('span');
    if (isPlaying) {
        if (playIcon) playIcon.setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z');
        label.innerText = 'Pause';
    } else {
        if (playIcon) playIcon.setAttribute('d', 'M8 5v14l11-7z');
        label.innerText = 'Play';
    }
}

function togglePlay() {
    if (time >= TOTAL_DURATION) {
        time = 0;
    }
    isPlaying = !isPlaying;
    updatePlayPauseUI();
}

function restartAnimation() {
    time = 0;
    isPlaying = true;
    updatePlayPauseUI();
}

// Calculus Values computation
function recalculateCalculus() {
    // 1. Solve Intersections
    solveIntersections();

    // 2. Display intersections list
    if (isGEnabled) {
        if (intersectionPoints.length === 0) {
            valIntersections.innerText = 'None in view';
        } else {
            valIntersections.innerText = intersectionPoints.map(pt => `(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`).join(', ');
        }
    } else {
        valIntersections.innerText = 'g(x) disabled';
    }

    // 3. Compute Definite Integral
    const integralVal = integrate(parsedF, parsedG, integrationStart, integrationEnd, (isGEnabled && showAreaBetween));
    valIntegral.innerText = isNaN(integralVal) ? 'NaN' : integralVal.toFixed(2);

    // 4. Update Analogy cards
    updateAnalogy();
}

// Setup input listeners
function handleMathInputChange(e) {
    const isF = e.target.id === 'functionInput';
    const val = e.target.value.trim();
    if (val) {
        if (isF) {
            currentFormulaF = val;
            parsedF = parseFunctionExpression(val);
        } else {
            currentFormulaG = val;
            parsedG = parseFunctionExpression(val);
        }
        updateFormulaHUDs();
        recalculateCalculus();
        restartAnimation();
    }
}

// Shared Math Virtual Keyboard controls
function wireKeyboard() {
    // 1. Tab switching
    const tabs = mathKbd.querySelectorAll('.kbd-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            // Deactivate all tabs & panes
            mathKbd.querySelectorAll('.kbd-tab').forEach(t => t.classList.remove('active'));
            mathKbd.querySelectorAll('.kbd-pane').forEach(p => p.classList.remove('active'));

            // Activate current tab & pane
            tab.classList.add('active');
            const targetPaneId = `pane-${tab.dataset.tab}`;
            const pane = document.getElementById(targetPaneId);
            if (pane) pane.classList.add('active');
        });
    });

    // Helper functions to prevent native OS keyboard when using virtual keyboard
    const enableVirtualMode = () => {
        functionInputF.setAttribute('inputmode', 'none');
        functionInputG.setAttribute('inputmode', 'none');
    };

    const disableVirtualMode = () => {
        functionInputF.removeAttribute('inputmode');
        functionInputG.removeAttribute('inputmode');
    };

    // 2. Keyboard click handler using event delegation
    mathKbd.addEventListener('click', (e) => {
        const btn = e.target.closest('.kbd-key');
        if (!btn) return;
        
        e.preventDefault();
        const targetInput = document.getElementById(activeInputId);
        if (!targetInput) return;

        const val = btn.dataset.val;
        const start = targetInput.selectionStart;
        const end = targetInput.selectionEnd;
        const origValue = targetInput.value;

        // Force virtual keyboard inputmode during typing
        enableVirtualMode();

        if (btn.classList.contains('kbd-backspace')) {
            if (start > 0 || end > start) {
                const deleteCount = (end > start) ? (end - start) : 1;
                const deleteStart = (end > start) ? start : (start - 1);
                targetInput.value = origValue.slice(0, deleteStart) + origValue.slice(end);
                targetInput.selectionStart = targetInput.selectionEnd = deleteStart;
            }
        } else if (btn.classList.contains('kbd-clear')) {
            targetInput.value = '';
            targetInput.selectionStart = targetInput.selectionEnd = 0;
        } else if (val !== undefined) {
            targetInput.value = origValue.slice(0, start) + val + origValue.slice(end);
            const nextPos = start + val.length;
            targetInput.selectionStart = targetInput.selectionEnd = nextPos;
        }

        // Trigger change and input events to redraw canvas and recalculate
        const changeEvent = new Event('change');
        targetInput.dispatchEvent(changeEvent);
        const inputEvent = new Event('input');
        targetInput.dispatchEvent(inputEvent);
        targetInput.focus();
    });

    const closeBtn = document.querySelector('.kbd-close-btn');
    closeBtn.addEventListener('click', () => {
        mathKbd.classList.add('hidden');
        disableVirtualMode();
    });

    const toggles = document.querySelectorAll('.kbd-toggle');
    toggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            activeInputId = toggle.dataset.target;
            enableVirtualMode();
            mathKbd.classList.remove('hidden');
            document.getElementById(activeInputId).focus();
        });
    });

    // Also support focus listeners on inputs to auto-enable virtual inputmode if the custom keyboard is open
    [functionInputF, functionInputG].forEach(input => {
        input.addEventListener('focus', () => {
            if (!mathKbd.classList.contains('hidden')) {
                enableVirtualMode();
            }
        });
    });
}

// Reference accordion
function wireAccordion() {
    const headers = document.querySelectorAll('.accordion-header');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const isActive = item.classList.contains('active');
            
            // Close all
            document.querySelectorAll('.accordion-item').forEach(el => el.classList.remove('active'));

            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
}

// --- Setup Event Listeners ---
btnPlayPause.addEventListener('click', togglePlay);
btnRestart.addEventListener('click', restartAnimation);

speedSlider.addEventListener('input', (e) => {
    animationSpeed = parseFloat(e.target.value);
    speedValue.innerText = `${animationSpeed.toFixed(1)}x`;
});

chkEnableG.addEventListener('change', (e) => {
    isGEnabled = e.target.checked;
    if (isGEnabled) {
        rowGInput.classList.remove('hidden');
        rowShowAreaBetween.classList.remove('hidden');
        hudGCard.classList.remove('hidden');
        showAreaBetween = chkShowAreaBetween.checked;
    } else {
        rowGInput.classList.add('hidden');
        rowShowAreaBetween.classList.add('hidden');
        hudGCard.classList.add('hidden');
        showAreaBetween = false;
    }
    recalculateCalculus();
    autoFitViewport();
    restartAnimation();
});

chkShowArea.addEventListener('change', (e) => {
    showAreaF = e.target.checked;
    recalculateCalculus();
    restartAnimation();
});

chkShowAreaBetween.addEventListener('change', (e) => {
    showAreaBetween = e.target.checked;
    recalculateCalculus();
    restartAnimation();
});

intStartInput.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
        integrationStart = val;
        recalculateCalculus();
        autoFitViewport();
        restartAnimation();
    }
});

intEndInput.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
        integrationEnd = val;
        recalculateCalculus();
        autoFitViewport();
        restartAnimation();
    }
});

functionInputF.addEventListener('change', handleMathInputChange);
functionInputG.addEventListener('change', handleMathInputChange);

btnRecordGIF.addEventListener('click', startRecording);

// Sidebar toggle listeners (handles desktop/tablet collapse and mobile drawer overlay)
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const sidebarPanel = document.querySelector('.control-panel');
const appContainer = document.querySelector('.app-container');

if (sidebarToggleBtn && sidebarPanel && appContainer) {
    sidebarToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.innerWidth > 768) {
            appContainer.classList.toggle('sidebar-collapsed');
        } else {
            sidebarPanel.classList.toggle('open');
        }
    });
}

// Click on blank space in sidebar to collapse it
if (sidebarPanel && appContainer) {
    sidebarPanel.addEventListener('click', (e) => {
        // If clicking interactive elements, do not collapse
        if (e.target.closest('button, input, select, textarea, label, a, .accordion-header, .slider, .slider-sm, .kbd-key')) {
            return;
        }
        
        // Collapse sidebar
        if (window.innerWidth > 768) {
            appContainer.classList.add('sidebar-collapsed');
        } else {
            sidebarPanel.classList.remove('open');
        }
    });
}

chkGrid.addEventListener('change', (e) => { showGrid = e.target.checked; });
chkGuidelines.addEventListener('change', (e) => { showGuidelines = e.target.checked; });
chkGlow.addEventListener('change', (e) => { enableGlow = e.target.checked; });

// Canvas events
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('wheel', handleWheel, { passive: false });

// Touch events for mobile
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
window.addEventListener('touchend', handleTouchEnd);
window.addEventListener('touchcancel', handleTouchEnd);

window.addEventListener('resize', resizeCanvas);

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    updateFormulaHUDs();
    recalculateCalculus();
    autoFitViewport();
    wireKeyboard();
    wireAccordion();

    requestAnimationFrame((timestamp) => {
        lastTime = timestamp;
        requestAnimationFrame(tick);
    });
});
