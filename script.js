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
    gridMinor: '#080E1A',
    axis: '#1E2E48',
    text: '#7a93b8',
    curveF: '#1A7FFF',       // Electric sapphire
    curveG: '#5B9CF6',       // Steel blue
    point: '#D0E8FF',        // Platinum ice
    guideline: '#1A4A8A',    // Dark sapphire guideline
    areaF: 'rgba(26, 127, 255, 0.06)',
    areaBetween: 'rgba(91, 156, 246, 0.07)'
};

// --- App State ---
let currentFormulaF = 'x^2';
let currentFormulaG = 'x + 2';
let parsedF = { depVar: 'y', indepVar: 'x', expr: 'x^2' };
let parsedG = { depVar: 'y', indepVar: 'x', expr: 'x + 2' };
let isGEnabled = false;
let paramA = 1.0;
let paramB = 1.0;
let paramC = 0.0;

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
const STAGE1_DURATION = 1.5; // Grid fade (slower)
const STAGE2_DURATION = 3.0; // Guidelines / points (slower)
const STAGE3_DURATION = 4.5; // Curves (much slower and more premium)
const STAGE4_DURATION = 1.5; // HUD & Analogy (slower)
const TOTAL_DURATION = STAGE1_DURATION + STAGE2_DURATION + STAGE3_DURATION + STAGE4_DURATION;

// Virtual Keyboard Target
let activeInputId = 'functionInput';

// Exporter/Recording State
let isRecording = false;
let gifWorker = null;
let gifWorkerURL = null;
let RECORD_FPS = 50;
let recordTimer = 0;
let GIF_W = 7680;
let GIF_H = 4320;

const RESOLUTIONS = {
    '8k': { w: 7680, h: 4320 },
    '4k': { w: 3840, h: 2160 },
    '1080p': { w: 1920, h: 1080 },
    '720p': { w: 1280, h: 720 },
    '480p': { w: 768, h: 480 }
};

// Elements
const canvas = document.getElementById('graphCanvas');
let ctx = canvas.getContext('2d');
const formulaTextF = document.getElementById('formula-text-f');
const formulaTextG = document.getElementById('formula-text-g');
const hudGCard = document.getElementById('hud-g-card');

const btnReset = document.getElementById('btnReset');

const functionInputF = document.getElementById('functionInput');
const functionInputG = document.getElementById('functionInputG');
const chkEnableG = document.getElementById('chkEnableG');
const rowGInput = document.getElementById('row-g-input');
const rowShowAreaBetween = document.getElementById('row-show-area-between');

const chkShowArea = document.getElementById('chkShowArea');
const chkShowAreaBetween = document.getElementById('chkShowAreaBetween');
const intStartInput = document.getElementById('intStart');
const intEndInput = document.getElementById('intEnd');

const sidebarIntegral = document.getElementById('sidebarIntegral');
const sidebarIntersections = document.getElementById('sidebarIntersections');
const rowSidebarIntersections = document.getElementById('row-sidebar-intersections');
const fReadingsList = document.getElementById('f-readings-list');
const gReadingsSection = document.getElementById('g-readings-section');
const gReadingsList = document.getElementById('g-readings-list');

const mathKbd = document.getElementById('mathKbd');
const btnRecordGIF = document.getElementById('btnRecordGIF');
const recordStatus = document.getElementById('recordStatus');
const recordStatusText = document.getElementById('recordStatusText');

const paramAInput = document.getElementById('paramAVal');
const paramBInput = document.getElementById('paramBVal');
const paramCInput = document.getElementById('paramCVal');

// --- Helper Math Parser ---
function preprocessAbsoluteValue(input) {
    let result = '';
    let openCount = 0;
    for (let i = 0; i < input.length; i++) {
        let char = input[i];
        if (char === '|') {
            let prevChar = '';
            for (let j = i - 1; j >= 0; j--) {
                if (input[j] !== ' ' && input[j] !== '\t') {
                    prevChar = input[j];
                    break;
                }
            }
            const isOpen = (prevChar === '' || 
                            ['+', '-', '*', '/', '^', '(', ',', '=', '!', '|'].includes(prevChar));
            if (isOpen) {
                result += 'abs(';
                openCount++;
            } else {
                result += ')';
                openCount--;
            }
        } else {
            result += char;
        }
    }
    return result;
}

function isImplicit(cleanExpr) {
    if (typeof math !== 'undefined') {
        try {
            const node = math.parse(cleanExpr);
            const variables = new Set();
            node.traverse((n) => {
                if (n.isSymbolNode) {
                    const name = n.name.toLowerCase();
                    if (name === 'x' || name === 'y') {
                        variables.add(name);
                    }
                }
            });
            return variables.has('x') && variables.has('y');
        } catch (e) {}
    }
    const hasX = /\bx\b/i.test(cleanExpr);
    const hasY = /\by\b/i.test(cleanExpr);
    return hasX && hasY;
}

function parseFunctionExpression(input) {
    let clean = input.trim();
    clean = preprocessAbsoluteValue(clean);
    
    // Check if it's explicit first (starts with y = or x =)
    let isExplicit = false;
    let depVar = 'y';
    let indepVar = 'x';
    let expr = clean;

    if (clean.includes('=')) {
        const parts = clean.split('=');
        const left = parts[0].trim().toLowerCase();
        const right = parts[1].trim();
        if (left === 'x') {
            isExplicit = true;
            depVar = 'x';
            indepVar = 'y';
            expr = right;
        } else if (left === 'y') {
            isExplicit = true;
            depVar = 'y';
            indepVar = 'x';
            expr = right;
        }
    }

    if (!isExplicit && isImplicit(clean)) {
        let lhs = clean;
        let rhs = '0';
        if (clean.includes('=')) {
            const parts = clean.split('=');
            lhs = parts[0].trim();
            rhs = parts[1].trim();
        }
        return { isImplicit: true, lhs, rhs, raw: clean, depVar: 'y', indepVar: 'x', expr: clean };
    }

    // Default explicit logic
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
    return { isImplicit: false, depVar, indepVar, expr };
}

function evaluateMath(expr, val, variable = 'x') {
    try {
        if (typeof math === 'undefined') return NaN;
        const scope = {};
        scope[variable] = val;
        scope['a'] = paramA;
        scope['b'] = paramB;
        scope['c'] = paramC;
        const res = math.evaluate(expr, scope);
        return isNaN(res) || !isFinite(res) ? 0 : res;
    } catch (e) {
        return NaN;
    }
}

function evaluateImplicitEquation(parsed, xVal, yVal) {
    if (typeof math === 'undefined') return NaN;
    const scope = { 
        x: xVal, y: yVal, X: xVal, Y: yVal,
        a: paramA, b: paramB, c: paramC
    };
    try {
        const lhsVal = math.evaluate(parsed.lhs, scope);
        const rhsVal = math.evaluate(parsed.rhs, scope);
        return lhsVal - rhsVal;
    } catch (e) {
        return NaN;
    }
}

// LaTeX formatting for KaTeX
function formatFormulaLaTeX(parsed, label = 'f') {
    if (parsed.isImplicit) {
        if (typeof math !== 'undefined') {
            try {
                if (parsed.raw.includes('=')) {
                    const parts = parsed.raw.split('=');
                    const lhsTex = math.parse(parts[0].trim()).toTex();
                    const rhsTex = math.parse(parts[1].trim()).toTex();
                    return `${lhsTex} = ${rhsTex}`;
                } else {
                    return math.parse(parsed.raw).toTex();
                }
            } catch (e) {}
        }
        return parsed.raw;
    }
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
            
            let derivF = '';
            if (parsedF.isImplicit) {
                derivF = '\\text{Implicit Relation}';
            } else {
                derivF = `${parsedF.depVar}'(${parsedF.indepVar}) = `;
                try {
                    const dF = math.derivative(parsedF.expr, parsedF.indepVar);
                    derivF += math.parse(dF.toString()).toTex();
                } catch (e) {
                    derivF += '\\text{Derivative unavailable}';
                }
            }
            window.katex.render(derivF, document.getElementById('derivative-text-f'));
            
            if (isGEnabled) {
                window.katex.render(formatFormulaLaTeX(parsedG, 'g'), formulaTextG);
                
                let derivG = '';
                if (parsedG.isImplicit) {
                    derivG = '\\text{Implicit Relation}';
                } else {
                    derivG = `${parsedG.depVar}'(${parsedG.indepVar}) = `;
                    try {
                        const dG = math.derivative(parsedG.expr, parsedG.indepVar);
                        derivG += math.parse(dG.toString()).toTex();
                    } catch (e) {
                        derivG += '\\text{Derivative unavailable}';
                    }
                }
                window.katex.render(derivG, document.getElementById('derivative-text-g'));
            }
        } catch (e) {
            formulaTextF.innerText = parsedF.isImplicit ? parsedF.raw : `${parsedF.depVar}(${parsedF.indepVar}) = ${parsedF.expr}`;
            if (isGEnabled) {
                formulaTextG.innerText = parsedG.isImplicit ? parsedG.raw : `${parsedG.depVar}(${parsedG.indepVar}) = ${parsedG.expr}`;
            }
        }
    } else {
        formulaTextF.innerText = parsedF.isImplicit ? parsedF.raw : `${parsedF.depVar}(${parsedF.indepVar}) = ${parsedF.expr}`;
        if (isGEnabled) {
            formulaTextG.innerText = parsedG.isImplicit ? parsedG.raw : `${parsedG.depVar}(${parsedG.indepVar}) = ${parsedG.expr}`;
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
function findRoots(minVal, maxVal, step, evalFn) {
    const roots = [];
    let prevVal = evalFn(minVal);
    
    if (Math.abs(prevVal) < 0.0001) {
        roots.push(minVal);
    }

    for (let val = minVal + step; val <= maxVal; val += step) {
        const currVal = evalFn(val);
        if (isNaN(currVal) || isNaN(prevVal)) {
            prevVal = currVal;
            continue;
        }
        
        if (prevVal * currVal < 0) {
            let left = val - step;
            let right = val;
            let mid = (left + right) / 2;
            for (let k = 0; k < 10; k++) {
                mid = (left + right) / 2;
                const midVal = evalFn(mid);
                if (prevVal * midVal < 0) {
                    right = mid;
                } else {
                    left = mid;
                }
            }
            if (!isNaN(mid) && isFinite(mid) && !roots.some(r => Math.abs(r - mid) < 0.01)) {
                roots.push(mid);
            }
        } else if (Math.abs(currVal) < 0.005) {
            const nextVal = evalFn(val + step);
            if (!isNaN(nextVal)) {
                const isLocalMin = (prevVal > currVal && nextVal > currVal);
                const isLocalMax = (prevVal < currVal && nextVal < currVal);
                if (isLocalMin || isLocalMax || Math.abs(currVal) < 0.00001) {
                    if (!roots.some(r => Math.abs(r - val) < 0.05)) {
                        roots.push(val);
                    }
                }
            }
        }
        prevVal = currVal;
    }
    return roots;
}

function solveIntersections() {
    intersectionPoints = [];
    if (!isGEnabled) return;

    const indepF = parsedF.indepVar;
    const indepG = parsedG.indepVar;

    if (indepF === 'x' && indepG === 'x') {
        const xMin = Math.min(-50, toModelX(0));
        const xMax = Math.max(50, toModelX(canvas.width));
        const sampleStep = 0.05;
        const evalDiff = (x) => evaluateMath(parsedF.expr, x, 'x') - evaluateMath(parsedG.expr, x, 'x');
        const roots = findRoots(xMin, xMax, sampleStep, evalDiff);
        roots.forEach(r => {
            intersectionPoints.push({ x: r, y: evaluateMath(parsedF.expr, r, 'x') });
        });
    } else if (indepF === 'y' && indepG === 'y') {
        const yMin = Math.min(-50, toModelY(canvas.height));
        const yMax = Math.max(50, toModelY(0));
        const sampleStep = 0.05;
        const evalDiff = (y) => evaluateMath(parsedF.expr, y, 'y') - evaluateMath(parsedG.expr, y, 'y');
        const roots = findRoots(yMin, yMax, sampleStep, evalDiff);
        roots.forEach(r => {
            intersectionPoints.push({ x: evaluateMath(parsedF.expr, r, 'y'), y: r });
        });
    } else if (indepF === 'x' && indepG === 'y') {
        const xMin = Math.min(-50, toModelX(0));
        const xMax = Math.max(50, toModelX(canvas.width));
        const sampleStep = 0.05;
        const evalDiff = (x) => {
            const y = evaluateMath(parsedF.expr, x, 'x');
            const gx = evaluateMath(parsedG.expr, y, 'y');
            return x - gx;
        };
        const roots = findRoots(xMin, xMax, sampleStep, evalDiff);
        roots.forEach(r => {
            intersectionPoints.push({ x: r, y: evaluateMath(parsedF.expr, r, 'x') });
        });
    } else if (indepF === 'y' && indepG === 'x') {
        const yMin = Math.min(-50, toModelY(canvas.height));
        const yMax = Math.max(50, toModelY(0));
        const sampleStep = 0.05;
        const evalDiff = (y) => {
            const x = evaluateMath(parsedF.expr, y, 'y');
            const gy = evaluateMath(parsedG.expr, x, 'x');
            return y - gy;
        };
        const roots = findRoots(yMin, yMax, sampleStep, evalDiff);
        roots.forEach(r => {
            intersectionPoints.push({ x: evaluateMath(parsedF.expr, r, 'y'), y: r });
        });
    }
}

function solveRoots(parsed) {
    if (parsed.isImplicit) return [];
    const minVal = Math.min(-50, toModelX(0));
    const maxVal = Math.max(50, toModelX(canvas.width));
    const step = 0.05;
    const evalFn = (val) => evaluateMath(parsed.expr, val, parsed.indepVar);
    return findRoots(minVal, maxVal, step, evalFn);
}

function numericalDerivative(expr, val, variable = 'x') {
    const h = 0.00001;
    const y1 = evaluateMath(expr, val, variable);
    const y2 = evaluateMath(expr, val + h, variable);
    if (isNaN(y1) || isNaN(y2)) return 0;
    return (y2 - y1) / h;
}

function calculateArcLength(parsed, start, end) {
    if (parsed.isImplicit) return NaN;
    const steps = 200;
    const h = (end - start) / steps;
    let sum = 0;
    for (let i = 0; i <= steps; i++) {
        const x = start + i * h;
        const df = numericalDerivative(parsed.expr, x, parsed.indepVar);
        const integrand = Math.sqrt(1 + df * df);
        if (i === 0 || i === steps) {
            sum += integrand / 2;
        } else {
            sum += integrand;
        }
    }
    return sum * h;
}

function checkImplicitSymmetry(parsed, checkX) {
    const testPoints = [[2, 3], [-1.5, 4], [0.5, -2], [5, 1], [-3, -3]];
    for (let pt of testPoints) {
        const x = pt[0];
        const y = pt[1];
        const val1 = evaluateImplicitEquation(parsed, x, y);
        const val2 = checkX 
            ? evaluateImplicitEquation(parsed, x, -y) 
            : evaluateImplicitEquation(parsed, -x, y);
        if (isNaN(val1) || isNaN(val2) || Math.abs(val1 - val2) > 0.01) {
            return false;
        }
    }
    return true;
}

function renderCurveProperties(parsed, elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;

    if (parsed.isImplicit) {
        let type = 'Implicit Curve';
        const raw = parsed.raw.toLowerCase();
        if (raw.includes('^2')) {
            if (raw.includes('+') && raw.includes('=')) {
                type = 'Circle / Ellipse';
            } else if (raw.includes('-') && raw.includes('=')) {
                type = 'Hyperbola';
            }
        } else if (raw.includes('|')) {
            type = 'Modulus Relation (Diamond)';
        } else if (raw.includes('sin') || raw.includes('cos') || raw.includes('tan')) {
            type = 'Wave Grid / Lattice';
        }

        const isXSym = checkImplicitSymmetry(parsed, true);
        const isYSym = checkImplicitSymmetry(parsed, false);

        container.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">Relation Type:</span>
                <span class="stat-value" style="font-size: 0.8rem;">${type}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">X-Axis Symmetry:</span>
                <span class="stat-value">${isXSym ? 'Yes' : 'No'}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Y-Axis Symmetry:</span>
                <span class="stat-value">${isYSym ? 'Yes' : 'No'}</span>
            </div>
        `;
        return;
    }

    const yIntercept = evaluateMath(parsed.expr, 0, parsed.indepVar);
    const roots = solveRoots(parsed);
    const arcLen = calculateArcLength(parsed, integrationStart, integrationEnd);
    const avgVal = integrationEnd !== integrationStart 
        ? integrate(parsed, null, integrationStart, integrationEnd, false) / (integrationEnd - integrationStart)
        : evaluateMath(parsed.expr, integrationStart, parsed.indepVar);

    const rootsText = roots.length === 0 
        ? 'None in view' 
        : roots.map(r => r.toFixed(2)).join(', ');

    container.innerHTML = `
        <div class="stat-row">
            <span class="stat-label">Y-Intercept (x=0):</span>
            <span class="stat-value">${isNaN(yIntercept) || !isFinite(yIntercept) ? 'N/A' : yIntercept.toFixed(2)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">X-Intercepts (Roots):</span>
            <span class="stat-value" style="font-size: 0.8rem;">${rootsText}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Arc Length:</span>
            <span class="stat-value">${isNaN(arcLen) ? 'N/A' : arcLen.toFixed(2)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Average Value:</span>
            <span class="stat-value">${isNaN(avgVal) ? 'N/A' : avgVal.toFixed(2)}</span>
        </div>
    `;
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
    if (parsedF.isImplicit) {
        scale.x = (canvas.width - 240) / 12;
        scale.y = (canvas.height - 240) / 12;
        pan.x = canvas.width / 2;
        pan.y = canvas.height / 2;
        return;
    }
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
    if (parsedF.isImplicit || (isGEnabled && parsedG.isImplicit)) return;

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

}

function drawDefaultPoints(progress) {
    if (progress <= 0) return;
    const isBaseCurve = (parsedF.expr.replace(/\s+/g, '') === 'x^2' && parsedF.depVar === 'y' && !parsedF.isImplicit);
    if (!isBaseCurve) return;

    ctx.save();
    ctx.globalAlpha = progress;

    DEFAULT_POINTS.forEach(pt => {
        const cx = toCanvasX(pt.x);
        const cy = toCanvasY(pt.y);

        if (cx < 0 || cx > canvas.width || cy < 0 || cy > canvas.height) return;

        if (enableGlow) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLORS.point;
        }
        
        ctx.fillStyle = COLORS.point;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = COLORS.point;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        const pulseRadius = 5 + 3 * Math.sin(Date.now() / 200 + pt.x);
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(220, 232, 248, 0.88)';
        ctx.font = '500 11px "DM Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`(${pt.x}, ${pt.y})`, cx + 10, cy - 8);
    });

    ctx.restore();
}

function drawImplicitCurve(parsed, color, animProgress) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (enableGlow) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = color;
    }

    const gridStep = 6; // px. Smaller step = higher quality
    const width = canvas.width;
    const height = canvas.height;
    
    // Determine the max radius in model units to grow outward
    const xMaxModel = Math.max(Math.abs(toModelX(0)), Math.abs(toModelX(width)));
    const yMaxModel = Math.max(Math.abs(toModelY(0)), Math.abs(toModelY(height)));
    const maxRadius = Math.sqrt(xMaxModel * xMaxModel + yMaxModel * yMaxModel);
    const currentMaxRadius = maxRadius * animProgress;

    // Cache evaluated values at grid points
    const cols = Math.ceil(width / gridStep) + 1;
    const rows = Math.ceil(height / gridStep) + 1;
    const values = new Float32Array(cols * rows);

    for (let c = 0; c < cols; c++) {
        const cx = c * gridStep;
        const mx = toModelX(cx);
        for (let r = 0; r < rows; r++) {
            const cy = r * gridStep;
            const my = toModelY(cy);
            const val = evaluateImplicitEquation(parsed, mx, my);
            values[c * rows + r] = val;
        }
    }

    const getVal = (c, r) => values[c * rows + r];

    ctx.beginPath();
    for (let c = 0; c < cols - 1; c++) {
        const x0 = c * gridStep;
        const x1 = (c + 1) * gridStep;
        const mx0 = toModelX(x0);
        const mx1 = toModelX(x1);

        for (let r = 0; r < rows - 1; r++) {
            const y0 = r * gridStep;
            const y1 = (r + 1) * gridStep;
            const my0 = toModelY(y0);
            const my1 = toModelY(y1);

            const vA = getVal(c, r);       // Top-Left
            const vB = getVal(c + 1, r);   // Top-Right
            const vC = getVal(c + 1, r + 1); // Bottom-Right
            const vD = getVal(c, r + 1);   // Bottom-Left

            if (isNaN(vA) || isNaN(vB) || isNaN(vC) || isNaN(vD)) continue;

            // Grow outward animation filter
            const midModelX = (mx0 + mx1) / 2;
            const midModelY = (my0 + my1) / 2;
            const dist = Math.sqrt(midModelX * midModelX + midModelY * midModelY);
            if (dist > currentMaxRadius) continue;

            let bitmask = 0;
            if (vA < 0) bitmask |= 8;
            if (vB < 0) bitmask |= 4;
            if (vC < 0) bitmask |= 2;
            if (vD < 0) bitmask |= 1;

            if (bitmask === 0 || bitmask === 15) continue;

            const lerp = (t0, t1, v0, v1) => {
                if (Math.abs(v0 - v1) < 0.00001) return (t0 + t1) / 2;
                return t0 + (t1 - t0) * (-v0 / (v1 - v0));
            };

            const pTop = { x: lerp(x0, x1, vA, vB), y: y0 };
            const pRight = { x: x1, y: lerp(y0, y1, vB, vC) };
            const pBottom = { x: lerp(x0, x1, vD, vC), y: y1 };
            const pLeft = { x: x0, y: lerp(y0, y1, vA, vD) };

            const drawLine = (p1, p2) => {
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
            };

            switch (bitmask) {
                case 1: drawLine(pBottom, pLeft); break;
                case 2: drawLine(pRight, pBottom); break;
                case 3: drawLine(pLeft, pRight); break;
                case 4: drawLine(pTop, pRight); break;
                case 5: drawLine(pTop, pLeft); drawLine(pRight, pBottom); break;
                case 6: drawLine(pTop, pBottom); break;
                case 7: drawLine(pTop, pLeft); break;
                case 8: drawLine(pTop, pLeft); break;
                case 9: drawLine(pTop, pBottom); break;
                case 10: drawLine(pTop, pRight); drawLine(pLeft, pBottom); break;
                case 11: drawLine(pTop, pRight); break;
                case 12: drawLine(pLeft, pRight); break;
                case 13: drawLine(pRight, pBottom); break;
                case 14: drawLine(pBottom, pLeft); break;
            }
        }
    }
    ctx.stroke();
    ctx.restore();
}

function drawCurves(animProgress) {
    if (animProgress <= 0) return;

    const drawSingle = (parsed, color) => {
        if (parsed.isImplicit) {
            drawImplicitCurve(parsed, color, animProgress);
            return;
        }
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
        drawDefaultPoints(stage2);
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
            
            // Render directly onto offscreen canvas at high resolution
            const originalCtx = ctx;
            ctx = oCtx;
            
            oCtx.save();
            oCtx.scale(GIF_W / canvas.width, GIF_H / canvas.height);
            drawFrame();
            oCtx.restore();
            
            ctx = originalCtx;

            // Draw overlay directly onto the offscreen canvas
            drawCanvasOverlay(oCtx, GIF_W, GIF_H);
            
            // Get pixel data
            const imgData = oCtx.getImageData(0, 0, GIF_W, GIF_H);
            
            // Send frame to Web Worker (transferring buffer to avoid memory copies)
            if (gifWorker) {
                gifWorker.postMessage({ type: 'frame', data: imgData.data }, [imgData.data.buffer]);
            }

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

// =============================================================
// Optimized background Web Worker code for fast, non-blocking LZW GIF encoding
// =============================================================
const workerCode = `
    let width, height, delay;
    let globalPalette = null;
    const outputBlocks = [];
    let frameCount = 0;

    function writeStr(arr, s) { for (let i = 0; i < s.length; i++) arr.push(s.charCodeAt(i)); }
    function writeU16(arr, n) { arr.push(n & 0xff); arr.push((n >> 8) & 0xff); }

    function quantizeFrame(data) {
        const palette = [];
        const palMap = {};
        const indices = new Uint8Array(width * height);

        // View the buffer as 32-bit integers for 4x faster array indexing
        const data32 = new Uint32Array(data.buffer);
        let prevVal = -1, prevIdx = 0;

        for (let i = 0; i < data32.length; i++) {
            const val = data32[i];

            // If color matches previous adjacent pixel, reuse its index immediately
            if (val === prevVal) {
                indices[i] = prevIdx;
                continue;
            }

            // Extract RGBA channels from little-endian AABBGGRR format
            const r = val & 0xff;
            const g = (val >> 8) & 0xff;
            const b = (val >> 16) & 0xff;

            const rKey = r >> 3;
            const gKey = g >> 3;
            const bKey = b >> 3;
            const key = (rKey << 10) | (gKey << 5) | bKey;

            if (palMap[key] === undefined) {
                if (palette.length < 255) {
                    palMap[key] = palette.length;
                    palette.push([r, g, b]);
                } else {
                    let best = 0, bestDist = Infinity;
                    for (let j = 0; j < palette.length; j++) {
                        const dr = r - palette[j][0];
                        const dg = g - palette[j][1];
                        const db = b - palette[j][2];
                        const d = dr*dr + dg*dg + db*db;
                        if (d < bestDist) { bestDist = d; best = j; }
                    }
                    palMap[key] = best;
                }
            }
            
            prevVal = val;
            prevIdx = palMap[key];
            indices[i] = prevIdx;
        }

        while (palette.length < 256) palette.push([0, 0, 0]);
        return { palette, indices };
    }

    function lzwEncode(indices, minCodeSize) {
        const clearCode = 1 << minCodeSize;
        const eofCode = clearCode + 1;
        let codeSize = minCodeSize + 1;
        let bits = 0;
        let curByte = 0;
        
        // Pre-allocate output buffer to avoid resizing standard arrays
        const bytes = new Uint8Array(indices.length);
        let byteCount = 0;

        const table = new Int32Array(1048576);
        table.fill(-1); // fill once at initialization
        
        const insertedKeys = new Int32Array(4096);
        let insertedCount = 0;

        function resetTable() {
            for (let k = 0; k < insertedCount; k++) {
                table[insertedKeys[k]] = -1;
            }
            insertedCount = 0;
            codeSize = minCodeSize + 1;
        }

        // Inline writeBits(clearCode)
        curByte |= clearCode << bits;
        bits += codeSize;
        while (bits >= 8) {
            bytes[byteCount++] = curByte & 0xff;
            curByte >>= 8;
            bits -= 8;
        }

        let nextCode = eofCode + 1;
        let prefix = indices[0];

        for (let i = 1; i < indices.length; i++) {
            const c = indices[i];
            const key = (prefix << 8) | c;
            const code = table[key];
            if (code !== -1) {
                prefix = code;
            } else {
                // Inline writeBits(prefix)
                curByte |= prefix << bits;
                bits += codeSize;
                while (bits >= 8) {
                    bytes[byteCount++] = curByte & 0xff;
                    curByte >>= 8;
                    bits -= 8;
                }

                if (nextCode < 4096) {
                    table[key] = nextCode++;
                    insertedKeys[insertedCount++] = key;
                    if (nextCode > (1 << codeSize)) codeSize = Math.min(codeSize + 1, 12);
                } else {
                    // Inline writeBits(clearCode)
                    curByte |= clearCode << bits;
                    bits += codeSize;
                    while (bits >= 8) {
                        bytes[byteCount++] = curByte & 0xff;
                        curByte >>= 8;
                        bits -= 8;
                    }

                    resetTable();
                    nextCode = eofCode + 1;
                }
                prefix = c;
            }
        }

        // Inline writeBits(prefix)
        curByte |= prefix << bits;
        bits += codeSize;
        while (bits >= 8) {
            bytes[byteCount++] = curByte & 0xff;
            curByte >>= 8;
            bits -= 8;
        }

        // Inline writeBits(eofCode)
        curByte |= eofCode << bits;
        bits += codeSize;
        while (bits >= 8) {
            bytes[byteCount++] = curByte & 0xff;
            curByte >>= 8;
            bits -= 8;
        }

        // Flush remaining bits
        if (bits > 0) {
            bytes[byteCount++] = curByte & 0xff;
        }

        return bytes.subarray(0, byteCount);
    }

    self.onmessage = function(e) {
        const msg = e.data;
        if (msg.type === 'init') {
            width = msg.width;
            height = msg.height;
            delay = msg.delay;
            globalPalette = null;
            outputBlocks.length = 0;
            frameCount = 0;
            return;
        }

        if (msg.type === 'frame') {
            const data = msg.data;
            const { palette, indices } = quantizeFrame(data);
            
            const frameBytes = [];

            if (frameCount === 0) {
                globalPalette = palette;
                
                // Write GIF Header
                writeStr(frameBytes, 'GIF89a');
                writeU16(frameBytes, width);
                writeU16(frameBytes, height);
                frameBytes.push(0xF7, 0x00, 0x00);

                // Global palette
                for (const [r, g, b] of globalPalette) {
                    frameBytes.push(r, g, b);
                }

                // Netscape extension
                frameBytes.push(0x21, 0xFF, 0x0B);
                writeStr(frameBytes, 'NETSCAPE2.0');
                frameBytes.push(0x03, 0x01, 0x00, 0x00, 0x00);
            }

            // Graphic Control Extension
            frameBytes.push(0x21, 0xF9, 0x04, 0x00);
            writeU16(frameBytes, Math.round(delay * 100));
            frameBytes.push(0x00, 0x00);

            // Image Descriptor
            frameBytes.push(0x2C);
            writeU16(frameBytes, 0); writeU16(frameBytes, 0);
            writeU16(frameBytes, width); writeU16(frameBytes, height);
            frameBytes.push(0x87);

            // Local color table
            for (const [r, g, b] of palette) {
                frameBytes.push(r, g, b);
            }

            const minCodeSize = 8;
            frameBytes.push(minCodeSize);
            const lzwData = lzwEncode(indices, minCodeSize);

            let offset = 0;
            while (offset < lzwData.length) {
                const blockSize = Math.min(255, lzwData.length - offset);
                frameBytes.push(blockSize);
                for (let i = 0; i < blockSize; i++) {
                    frameBytes.push(lzwData[offset++]);
                }
            }
            frameBytes.push(0x00);

            outputBlocks.push(new Uint8Array(frameBytes));
            frameCount++;

            self.postMessage({ type: 'progress', frameIndex: frameCount });
            return;
        }

        if (msg.type === 'finish') {
            // Append GIF trailer
            const trailer = new Uint8Array([0x3B]);
            outputBlocks.push(trailer);

            let totalLength = 0;
            for (const block of outputBlocks) {
                totalLength += block.length;
            }

            const gifData = new Uint8Array(totalLength);
            let offset = 0;
            for (const block of outputBlocks) {
                gifData.set(block, offset);
                offset += block.length;
            }

            self.postMessage({ type: 'success', gifData }, [gifData.buffer]);
            return;
        }
    };
`;

// --- Exporter Engine ---
let totalRecordedFrames = 0;

function startRecording() {
    if (isRecording) return;
    
    // Get selected resolution
    const resSelect = document.getElementById('gifResolution');
    const selectedRes = resSelect ? resSelect.value : '8k';
    const dimensions = RESOLUTIONS[selectedRes] || RESOLUTIONS['8k'];
    GIF_W = dimensions.w;
    GIF_H = dimensions.h;

    // Get selected frame rate
    const fpsSelect = document.getElementById('gifFps');
    RECORD_FPS = fpsSelect ? parseInt(fpsSelect.value) : 50;

    isRecording = true;
    isPlaying = true;
    time = 0;
    recordTimer = 0;
    totalRecordedFrames = 0;

    btnRecordGIF.classList.add('recording');
    btnRecordGIF.querySelector('span:last-child').innerText = 'Recording...';
    recordStatus.classList.remove('hidden');
    recordStatusText.innerText = 'Capturing frames... (0%)';

    // Create inline worker
    try {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        gifWorkerURL = URL.createObjectURL(blob);
        gifWorker = new Worker(gifWorkerURL);

        // Send init message
        gifWorker.postMessage({
            type: 'init',
            width: GIF_W,
            height: GIF_H,
            delay: 1 / RECORD_FPS
        });

        // Listen for progress / success messages
        gifWorker.onmessage = function(e) {
            const data = e.data;
            if (data.type === 'progress') {
                recordStatusText.innerText = `Encoding frames... (Frame ${data.frameIndex} captured)`;
            } else if (data.type === 'success') {
                recordStatusText.innerText = 'Downloading GIF...';
                const blob = new Blob([data.gifData], { type: 'image/gif' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `math_visualization_${selectedRes}.gif`;
                link.href = url;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 5000);
                
                // Cleanup
                recordStatus.classList.add('hidden');
                cleanupWorker();
            } else if (data.type === 'error') {
                recordStatusText.innerText = `Encoding failed: ${data.error}`;
                cleanupWorker();
            }
        };
    } catch (err) {
        console.error('Failed to initialize Web Worker:', err);
        recordStatusText.innerText = 'Worker Init Failed!';
        isRecording = false;
        btnRecordGIF.classList.remove('recording');
        btnRecordGIF.querySelector('span:last-child').innerText = 'Record GIF';
    }
}

function finishRecording() {
    isRecording = false;
    btnRecordGIF.classList.remove('recording');
    btnRecordGIF.querySelector('span:last-child').innerText = 'Record GIF';
    recordStatusText.innerText = 'Finalizing GIF encoding...';

    if (gifWorker) {
        gifWorker.postMessage({ type: 'finish' });
    } else {
        recordStatus.classList.add('hidden');
    }
}

function cleanupWorker() {
    if (gifWorker) {
        gifWorker.terminate();
        gifWorker = null;
    }
    if (gifWorkerURL) {
        URL.revokeObjectURL(gifWorkerURL);
        gifWorkerURL = null;
    }
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

function restartAnimation() {
    time = 0;
    isPlaying = true;
}

// Calculus Values computation
function recalculateCalculus() {
    // 1. Solve Intersections
    if (parsedF.isImplicit || (isGEnabled && parsedG.isImplicit)) {
        intersectionPoints = [];
        sidebarIntersections.innerText = 'N/A (Implicit)';
        rowSidebarIntersections.classList.add('hidden');
    } else {
        solveIntersections();
        if (isGEnabled) {
            rowSidebarIntersections.classList.remove('hidden');
            if (intersectionPoints.length === 0) {
                sidebarIntersections.innerText = 'None in view';
            } else {
                sidebarIntersections.innerText = intersectionPoints.map(pt => `(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`).join(', ');
            }
        } else {
            rowSidebarIntersections.classList.add('hidden');
            sidebarIntersections.innerText = 'g(x) disabled';
        }
    }

    // 2. Compute Definite Integral
    if (parsedF.isImplicit || (isGEnabled && parsedG.isImplicit)) {
        sidebarIntegral.innerText = 'N/A (Implicit)';
    } else {
        const integralVal = integrate(parsedF, parsedG, integrationStart, integrationEnd, (isGEnabled && showAreaBetween));
        sidebarIntegral.innerText = isNaN(integralVal) ? 'NaN' : integralVal.toFixed(2);
    }

    // 3. Update dynamic properties panels
    renderCurveProperties(parsedF, 'f-readings-list');
    
    if (isGEnabled) {
        gReadingsSection.classList.remove('hidden');
        renderCurveProperties(parsedG, 'g-readings-list');
    } else {
        gReadingsSection.classList.add('hidden');
    }
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



btnReset.addEventListener('click', restartAnimation);

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

// Setup stepper listeners and inputs
function updateParamValue(param, val) {
    if (param === 'a') {
        paramA = val;
    } else if (param === 'b') {
        paramB = val;
    } else if (param === 'c') {
        paramC = val;
    }
    recalculateCalculus();
    autoFitViewport();
    restartAnimation();
}

document.querySelectorAll('.stepper-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const param = btn.dataset.param;
        const isPlus = btn.classList.contains('btn-plus');
        const input = document.getElementById(`param${param.toUpperCase()}Val`);
        if (!input) return;
        
        let val = parseFloat(input.value) || 0;
        if (isPlus) {
            val += 0.1;
        } else {
            val -= 0.1;
        }
        val = Math.round(val * 10) / 10;
        val = Math.max(-20, Math.min(20, val));
        
        input.value = val.toFixed(1);
        updateParamValue(param, val);
    });
});

if (paramAInput && paramBInput && paramCInput) {
    [paramAInput, paramBInput, paramCInput].forEach((input, index) => {
        const param = ['a', 'b', 'c'][index];
        input.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) val = param === 'c' ? 0.0 : 1.0;
            val = Math.round(val * 10) / 10;
            val = Math.max(-20, Math.min(20, val));
            e.target.value = val.toFixed(1);
            updateParamValue(param, val);
        });
        input.addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                val = Math.round(val * 10) / 10;
                updateParamValue(param, val);
            }
        });
    });
}

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


    requestAnimationFrame((timestamp) => {
        lastTime = timestamp;
        requestAnimationFrame(tick);
    });
});
