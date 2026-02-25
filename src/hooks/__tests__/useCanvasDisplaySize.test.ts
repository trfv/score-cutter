import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCanvasDisplaySize } from '../useCanvasDisplaySize';

let observerCallback: ResizeObserverCallback;
let observedElements: Element[];
const disconnectSpy = vi.fn();

class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    observerCallback = cb;
  }
  observe(el: Element) { observedElements.push(el); }
  unobserve() {}
  disconnect() { disconnectSpy(); }
}

beforeEach(() => {
  observedElements = [];
  disconnectSpy.mockClear();
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createMockCanvas(width: number, clientWidth: number, clientHeight: number) {
  return { width, clientWidth, clientHeight } as unknown as HTMLCanvasElement;
}

function fireResize(target: HTMLCanvasElement) {
  observerCallback(
    [{ target } as unknown as ResizeObserverEntry],
    {} as unknown as ResizeObserver,
  );
}

describe('useCanvasDisplaySize', () => {
  it('returns zero dimensions before onCanvasReady', () => {
    const { result } = renderHook(() => useCanvasDisplaySize());
    expect(result.current.bitmapWidth).toBe(0);
    expect(result.current.canvasWidth).toBe(0);
    expect(result.current.canvasHeight).toBe(0);
    expect(result.current.displayRatio).toBe(1);
  });

  it('captures initial dimensions from handleCanvasReady', () => {
    const { result } = renderHook(() => useCanvasDisplaySize());
    const canvas = createMockCanvas(1650, 800, 1038);

    act(() => result.current.handleCanvasReady(canvas));

    expect(result.current.bitmapWidth).toBe(1650);
    expect(result.current.canvasWidth).toBe(800);
    expect(result.current.canvasHeight).toBe(1038);
  });

  it('computes displayRatio and effectiveScale correctly', () => {
    const { result } = renderHook(() => useCanvasDisplaySize());
    const canvas = createMockCanvas(1650, 825, 1069);

    act(() => result.current.handleCanvasReady(canvas));

    expect(result.current.displayRatio).toBeCloseTo(0.5);
    expect(result.current.effectiveScale).toBeCloseTo((150 / 72) * 0.5);
  });

  it('observes the canvas element after handleCanvasReady', () => {
    const { result } = renderHook(() => useCanvasDisplaySize());
    const canvas = createMockCanvas(1650, 800, 1038);

    act(() => result.current.handleCanvasReady(canvas));

    expect(observedElements).toContain(canvas);
  });

  it('updates dimensions when ResizeObserver fires', () => {
    const { result } = renderHook(() => useCanvasDisplaySize());
    const canvas = createMockCanvas(1650, 800, 1038);

    act(() => result.current.handleCanvasReady(canvas));

    // Simulate window resize shrinking the canvas
    Object.defineProperty(canvas, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 779, configurable: true });

    act(() => fireResize(canvas));

    expect(result.current.canvasWidth).toBe(600);
    expect(result.current.canvasHeight).toBe(779);
  });

  it('skips state update when dimensions are unchanged', () => {
    const { result } = renderHook(() => useCanvasDisplaySize());
    const canvas = createMockCanvas(1650, 800, 1038);

    act(() => result.current.handleCanvasReady(canvas));

    const prevScale = result.current.effectiveScale;

    // Fire resize with same dimensions
    act(() => fireResize(canvas));

    expect(result.current.canvasWidth).toBe(800);
    expect(result.current.effectiveScale).toBe(prevScale);
  });

  it('disconnects observer on unmount', () => {
    const { result, unmount } = renderHook(() => useCanvasDisplaySize());
    const canvas = createMockCanvas(1650, 800, 1038);

    act(() => result.current.handleCanvasReady(canvas));

    unmount();

    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('recalculates effectiveScale after resize', () => {
    const { result } = renderHook(() => useCanvasDisplaySize());
    const canvas = createMockCanvas(1650, 825, 1069);

    act(() => result.current.handleCanvasReady(canvas));

    const scaleBefore = result.current.effectiveScale;

    // Simulate resize to half width
    Object.defineProperty(canvas, 'clientWidth', { value: 412, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 534, configurable: true });
    act(() => fireResize(canvas));

    const scaleAfter = result.current.effectiveScale;
    expect(scaleAfter).not.toBeCloseTo(scaleBefore);
    expect(scaleAfter).toBeCloseTo((150 / 72) * (412 / 1650));
  });
});
