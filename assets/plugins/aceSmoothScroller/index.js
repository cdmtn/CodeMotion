export function enableSmoothScroll(editor, options = {}) {
    if (!editor || !editor.session || !editor.renderer) {
        return () => {};
    }
    const {
        ease = 0.18,
        step = 80,
        maxDelta = 120,
        horizontal = true,
        shiftToHorizontal = true,
    } = options;

    let currentY = editor.session.getScrollTop();
    let targetY = currentY;
    let currentX = editor.session.getScrollLeft ? editor.session.getScrollLeft() : 0;
    let targetX = currentX;
    let rafId = null;
    let lastTs = 0;

    const scroller = editor.renderer.scroller || editor.container;

    if (editor.renderer.scrollBarV?.scrollElement) {
        editor.renderer.scrollBarV.scrollElement.onwheel = (e) => e.preventDefault();
    }
    if (editor.renderer.scrollBarH?.scrollElement) {
        editor.renderer.scrollBarH.scrollElement.onwheel = (e) => e.preventDefault();
    }
    if (scroller && scroller.style) {
        scroller.style.overscrollBehavior = 'contain';
    }

    let cachedMax = { x: 0, y: 0 };
    let lastMeasure = 0;

    function measure(now) {
        if (now - lastMeasure < 100) return;
        lastMeasure = now;
        const r = editor.renderer;
        const lineHeight = r.lineHeight;
        const screenLen = editor.session.getScreenLength();
        const maxY = Math.max(0, screenLen * lineHeight - r.$size.scrollerHeight);
        const contentWidth = r.layerConfig ? r.layerConfig.width : (r.$size.scrollerWidth || 0);
        const maxX = Math.max(0, contentWidth - r.$size.scrollerWidth);
        cachedMax.x = maxX;
        cachedMax.y = maxY;
    }

    function easedLerp(current, target, dtMs, baseEase) {
        const alpha = 1 - Math.pow(1 - baseEase, dtMs / 16.667);
        return current + (target - current) * alpha;
    }

    function animate(ts) {
        if (!lastTs) lastTs = ts;
        const dt = ts - lastTs;
        lastTs = ts;

        measure(ts);

        currentY = easedLerp(currentY, targetY, dt, ease);
        currentX = easedLerp(currentX, targetX, dt, ease);

        if (currentY < 0) currentY = 0;
        else if (currentY > cachedMax.y) currentY = cachedMax.y;

        if (currentX < 0) currentX = 0;
        else if (currentX > cachedMax.x) currentX = cachedMax.x;

        editor.session.setScrollTop(currentY);
        if (editor.session.setScrollLeft) editor.session.setScrollLeft(currentX);

        const nearY = Math.abs(targetY - currentY) < 0.2;
        const nearX = Math.abs(targetX - currentX) < 0.2;

        if (!nearY || (!nearX && horizontal)) {
            rafId = requestAnimationFrame(animate);
        } else {
            rafId = null;
            lastTs = 0;
        }
    }

    function handleWheel(e) {
        e.preventDefault();
        e.stopPropagation();

        const dy = Math.max(-maxDelta, Math.min(maxDelta, e.deltaY));
        const dxRaw = (typeof e.deltaX === 'number') ? e.deltaX : 0;
        const dx = Math.max(-maxDelta, Math.min(maxDelta, dxRaw));

        const wantHorizontal = horizontal && ((shiftToHorizontal && e.shiftKey) || Math.abs(dx) > Math.abs(dy));

        if (wantHorizontal) {
            targetX += (dx !== 0 ? dx : dy) * step * 0.01;
            if (targetX < 0) targetX = 0;
            else if (targetX > cachedMax.x) targetX = cachedMax.x;
        } else {
            targetY += dy * step * 0.01;
            if (targetY < 0) targetY = 0;
            else if (targetY > cachedMax.y) targetY = cachedMax.y;
        }

        if (!rafId) {
            rafId = requestAnimationFrame(animate);
        }
    }

    const originalScrollAnimation = editor.renderer.$scrollAnimation;
    editor.renderer.$scrollAnimation = null;
    if (editor.setAnimatedScroll) editor.setAnimatedScroll(false);

    scroller.addEventListener('wheel', handleWheel, { passive: false, capture: true });

    const invalidate = () => {
        lastMeasure = 0;
    };

    editor.on('change', invalidate);

    editor.renderer.onResize = (function (orig) {
        return function () {
            if (orig) orig.apply(this, arguments);
            invalidate();
        };
    })(editor.renderer.onResize);

    return function disable() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        scroller.removeEventListener('wheel', handleWheel, { capture: true });
        editor.off('change', invalidate);
        editor.renderer.$scrollAnimation = originalScrollAnimation;
    };
}