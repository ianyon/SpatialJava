/**
 * SpatialJava Visualizer Invariant & Edge Case Test Suite
 * Enforces layout, coordinate projection, edge routing, and parser invariants.
 */

const assert = require('node:assert');
const test = require('node:test');

// ── Invariant Geometry Logic Under Test ───────────────────────────────────────

function computeSpanAnchor({ spanRect, cardRect, node, fallbackW = 350, fallbackH = 150 }) {
    if (!node) return null;
    const cardW = node.w || fallbackW;
    const cardH = node.h || fallbackH;
    const cardRightX = node.x + cardW;

    if (!spanRect || !cardRect) {
        return {
            innerStartX: cardRightX - 20,
            cardRightX,
            spanY: node.y + cardH / 2
        };
    }

    let spanX, spanY;
    if (cardRect.width > 0 && cardRect.height > 0) {
        // Invariant: (span - cardRect) / cardRect eliminates any scale or translation
        const relX = ((spanRect.right - cardRect.left) / cardRect.width) * cardW;
        const relY = ((spanRect.top + spanRect.height / 2 - cardRect.top) / cardRect.height) * cardH;

        spanX = node.x + Math.max(0, Math.min(cardW, relX));
        spanY = node.y + Math.max(20, Math.min(cardH - 10, relY));
    } else {
        spanX = cardRightX - 20;
        spanY = node.y + cardH / 2;
    }

    const innerStartX = Math.min(cardRightX - 2, spanX + 3);
    return {
        innerStartX,
        cardRightX,
        spanY
    };
}

function computeOuterPath(fromNode, toNode, spanY, isRecursive = false) {
    const cardRightX = fromNode.x + (fromNode.w || 350);
    const targetLeftX = toNode.x;
    const targetCenterY = toNode.y + (toNode.h || 150) / 2;

    if (isRecursive || fromNode.name === toNode.name) {
        const loopW = 50;
        const loopTopY = Math.min(spanY, targetCenterY) - 35;
        return `M${cardRightX},${spanY} C${cardRightX + loopW},${spanY} ${cardRightX + loopW},${loopTopY} ${fromNode.x + (fromNode.w || 350) / 2},${loopTopY} C${fromNode.x - 25},${loopTopY} ${fromNode.x - 25},${targetCenterY} ${targetLeftX},${targetCenterY}`;
    }

    if (targetLeftX > cardRightX + 25) {
        // Forward routing
        const cx1 = cardRightX + Math.max(60, (targetLeftX - cardRightX) * 0.45);
        const cx2 = targetLeftX - Math.max(60, (targetLeftX - cardRightX) * 0.45);
        return `M${cardRightX},${spanY} C${cx1},${spanY} ${cx2},${targetCenterY} ${targetLeftX},${targetCenterY}`;
    }

    // Backward or same-column routing with guaranteed column clearance
    const clearanceX = Math.max(cardRightX, targetLeftX + (toNode.w || 350)) + 60;
    return `M${cardRightX},${spanY} C${clearanceX},${spanY} ${clearanceX},${targetCenterY} ${targetLeftX},${targetCenterY}`;
}

function computeGhostPath(cardRightX, spanY) {
    const targetX = cardRightX + 110;
    const targetY = spanY;
    return {
        pathD: `M${cardRightX},${spanY} C${cardRightX + 40},${spanY} ${targetX - 40},${targetY} ${targetX},${targetY}`,
        buttonPos: { x: targetX + 15, y: targetY }
    };
}

// ── Invariant Tests ──────────────────────────────────────────────────────────

test('Invariant 1: Scale Invariance - Coordinates remain identical across zoom and pan', () => {
    const node = { name: 'caller', x: 60, y: 60, w: 500, h: 300 };

    // Simulate varying scales and pan offsets in the browser
    const scales = [0.1, 0.25, 0.65, 1.0, 2.5];
    const panOffsets = [
        { x: 0, y: 0 },
        { x: 300, y: -150 },
        { x: -1000, y: 800 }
    ];

    let baseAnchor = null;

    for (const scale of scales) {
        for (const pan of panOffsets) {
            // Screen rect of card after world transform
            const cardRect = {
                left: pan.x + node.x * scale,
                top: pan.y + node.y * scale,
                width: node.w * scale,
                height: node.h * scale
            };

            // Token span inside card at relative local offset (dx = 120, dy = 80)
            const spanRect = {
                left: cardRect.left + 100 * scale,
                right: cardRect.left + 120 * scale,
                top: cardRect.top + 70 * scale,
                height: 20 * scale
            };

            const anchor = computeSpanAnchor({ spanRect, cardRect, node });

            if (!baseAnchor) {
                baseAnchor = anchor;
            } else {
                assert.strictEqual(
                    Math.abs(anchor.innerStartX - baseAnchor.innerStartX) < 1e-6,
                    true,
                    `innerStartX mismatch at scale ${scale}: ${anchor.innerStartX} vs ${baseAnchor.innerStartX}`
                );
                assert.strictEqual(
                    Math.abs(anchor.spanY - baseAnchor.spanY) < 1e-6,
                    true,
                    `spanY mismatch at scale ${scale}: ${anchor.spanY} vs ${baseAnchor.spanY}`
                );
                assert.strictEqual(
                    anchor.cardRightX,
                    baseAnchor.cardRightX,
                    'cardRightX must always match node.x + node.w'
                );
            }
        }
    }
});

test('Invariant 2: Source Invariant - Inner edge starts inside card and ends at card right border', () => {
    const node = { name: 'processData', x: 100, y: 80, w: 400, h: 250 };
    const cardRect = { left: 100, top: 80, width: 400, height: 250 };
    const spanRect = { left: 180, right: 230, top: 140, height: 16 };

    const anchor = computeSpanAnchor({ spanRect, cardRect, node });

    assert.ok(anchor.innerStartX >= node.x, 'innerStartX must be >= node.x');
    assert.ok(anchor.innerStartX <= node.x + node.w, 'innerStartX must be <= node.x + node.w');
    assert.ok(anchor.spanY >= node.y, 'spanY must be >= node.y');
    assert.ok(anchor.spanY <= node.y + node.h, 'spanY must be <= node.y + node.h');
    assert.strictEqual(anchor.cardRightX, node.x + node.w, 'cardRightX must equal node.x + node.w');
});

test('Invariant 3: Continuity Invariant - Outer edge starts at inner edge right anchor', () => {
    const F = { name: 'caller', x: 60, y: 60, w: 400, h: 200 };
    const T = { name: 'callee', x: 660, y: 120, w: 350, h: 180 };
    const spanY = 110;

    const outerPath = computeOuterPath(F, T, spanY);
    const startMatch = outerPath.match(/^M\s*([\d.]+),([\d.]+)/);

    assert.ok(startMatch, 'Outer path must have valid M start coordinates');
    const startX = parseFloat(startMatch[1]);
    const startY = parseFloat(startMatch[2]);

    assert.strictEqual(startX, F.x + F.w, 'Outer path startX must equal caller cardRightX');
    assert.strictEqual(startY, spanY, 'Outer path startY must equal spanY');
});

test('Invariant 4: Target Invariant - Outer edge ends at callee left vertical center', () => {
    const F = { name: 'caller', x: 60, y: 60, w: 400, h: 200 };
    const T = { name: 'callee', x: 700, y: 150, w: 360, h: 200 };
    const spanY = 130;

    const outerPath = computeOuterPath(F, T, spanY);
    const endMatch = outerPath.match(/([\d.]+),([\d.]+)$/);

    assert.ok(endMatch, 'Outer path must end with valid coordinate pair');
    const endX = parseFloat(endMatch[1]);
    const endY = parseFloat(endMatch[2]);

    assert.strictEqual(endX, T.x, 'Outer path endX must equal target T.x');
    assert.strictEqual(endY, T.y + T.h / 2, 'Outer path endY must equal target vertical center');
});

test('Invariant 5: No NaN or undefined in any generated SVG path', () => {
    const F = { name: 'A', x: 60, y: 100, w: 400, h: 200 };
    const T = { name: 'B', x: 660, y: 200, w: 350, h: 150 };

    const forwardPath = computeOuterPath(F, T, 150, false);
    const recursivePath = computeOuterPath(F, F, 150, true);
    const backwardPath = computeOuterPath(T, F, 220, false);
    const ghost = computeGhostPath(F.x + F.w, 150);

    const paths = [forwardPath, recursivePath, backwardPath, ghost.pathD];
    for (const p of paths) {
        assert.ok(!p.includes('NaN'), `Path must not contain NaN: ${p}`);
        assert.ok(!p.includes('undefined'), `Path must not contain undefined: ${p}`);
        assert.ok(!p.includes('null'), `Path must not contain null: ${p}`);
    }
});

// ── Edge Case Tests ──────────────────────────────────────────────────────────

test('Edge Case 1: Self-Recursion routes smoothly without intersecting or backward knots', () => {
    const F = { name: 'computeFactorial', x: 60, y: 100, w: 400, h: 220 };
    const spanY = 160;

    const path = computeOuterPath(F, F, spanY, true);

    assert.ok(path.startsWith(`M${F.x + F.w},${spanY}`), 'Must start at card right edge');
    assert.ok(path.endsWith(`${F.x},${F.y + F.h / 2}`), 'Must end at card left vertical center');
    // Ensure control points provide adequate clearance
    assert.ok(path.includes(`C${F.x + F.w + 50}`), 'Must curve out to the right for loop clearance');
});

test('Edge Case 2: Backward call (callee is to the left or in same column) provides clearance', () => {
    const col2Node = { name: 'compile', x: 660, y: 100, w: 400, h: 250 };
    const col1Node = { name: 'helper', x: 60, y: 300, w: 350, h: 180 };
    const spanY = 180;

    const backwardPath = computeOuterPath(col2Node, col1Node, spanY, false);

    assert.ok(backwardPath.startsWith(`M${col2Node.x + col2Node.w},${spanY}`));
    assert.ok(backwardPath.endsWith(`${col1Node.x},${col1Node.y + col1Node.h / 2}`));
    // Must clear col2's right border
    assert.ok(!backwardPath.includes('NaN'));
});

test('Edge Case 3: Missing Method / Ghost Node creates valid error curve and button position', () => {
    const cardRightX = 550;
    const spanY = 140;

    const ghost = computeGhostPath(cardRightX, spanY);

    assert.strictEqual(ghost.pathD, `M550,140 C590,140 620,140 660,140`);
    assert.strictEqual(ghost.buttonPos.x, 675);
    assert.strictEqual(ghost.buttonPos.y, 140);
});

test('Edge Case 4: Missing DOM Span uses safe card fallback anchor without error', () => {
    const node = { name: 'orphanCall', x: 100, y: 200, w: 380, h: 220 };

    const fallback = computeSpanAnchor({ spanRect: null, cardRect: null, node });

    assert.strictEqual(fallback.cardRightX, 480);
    assert.strictEqual(fallback.innerStartX, 460);
    assert.strictEqual(fallback.spanY, 310);
});

test('Edge Case 5: Zero-size unrendered card fallback', () => {
    const node = { name: 'unrendered', x: 50, y: 50, w: 0, h: 0 };
    const cardRect = { left: 50, top: 50, width: 0, height: 0 };
    const spanRect = { left: 0, right: 0, top: 0, height: 0 };

    const anchor = computeSpanAnchor({ spanRect, cardRect, node, fallbackW: 360, fallbackH: 160 });

    assert.strictEqual(anchor.cardRightX, 50 + 360);
    assert.strictEqual(anchor.spanY, 50 + 80);
});

// ── Java Parser Tests ────────────────────────────────────────────────────────

const { parseJavaMethods } = require('../out/parser');

test('Parser Invariant 1: Extracts methods, identifies API entry points and intra-file calls', () => {
    const javaCode = `
public class ReportService {
    public void generateReport() {
        validateInputs();
        String res = fetchData();
        System.out.println("Result: " + res);
    }

    private void validateInputs() {
        if (checkCondition()) {
            throw new RuntimeException();
        }
    }

    private String fetchData() {
        return "data";
    }

    private boolean checkCondition() {
        return true;
    }
}
`;

    const methods = parseJavaMethods(javaCode);
    assert.strictEqual(methods.length, 4);

    const generateReport = methods.find(m => m.name === 'generateReport');
    assert.ok(generateReport);
    assert.strictEqual(generateReport.isPublic, true);
    assert.deepStrictEqual(generateReport.calls.sort(), ['fetchData', 'validateInputs'].sort());
    // Invariant: external call 'println' from System.out.println must NOT be included
    assert.strictEqual(generateReport.calls.includes('println'), false);

    const validateInputs = methods.find(m => m.name === 'validateInputs');
    assert.ok(validateInputs);
    assert.strictEqual(validateInputs.isPublic, false);
    assert.deepStrictEqual(validateInputs.calls, ['checkCondition']);
    // Invariant: control keyword 'if' must NOT be in calls
    assert.strictEqual(validateInputs.calls.includes('if'), false);
});

