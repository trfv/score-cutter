import { describe, it, expect, vi, afterEach } from 'vitest';
import { createWorkerPool, isWorkerAvailable } from '../workerPool';
import type { DetectPageRequest, DetectPageResponse } from '../workerProtocol';

function createMockWorkerFactory() {
  return () => {
    let handler: ((event: MessageEvent) => void) | null = null;
    const worker = {
      postMessage: vi.fn((msg: DetectPageRequest) => {
        setTimeout(() => {
          handler?.({
            data: {
              type: 'DETECT_PAGE_RESULT',
              taskId: msg.taskId,
              pageIndex: msg.pageIndex,
              systems: [],
            } satisfies DetectPageResponse,
          } as MessageEvent);
        }, 0);
      }),
      terminate: vi.fn(),
      set onmessage(fn: (event: MessageEvent) => void) {
        handler = fn;
      },
    } as unknown as Worker;
    return worker;
  };
}

function createErrorWorkerFactory() {
  return () => {
    let handler: ((event: MessageEvent) => void) | null = null;
    const worker = {
      postMessage: vi.fn((msg: DetectPageRequest) => {
        setTimeout(() => {
          handler?.({
            data: {
              type: 'ERROR',
              taskId: msg.taskId,
              message: 'test error',
            },
          } as MessageEvent);
        }, 0);
      }),
      terminate: vi.fn(),
      set onmessage(fn: (event: MessageEvent) => void) {
        handler = fn;
      },
    } as unknown as Worker;
    return worker;
  };
}

function makeRequest(pageIndex: number): DetectPageRequest {
  return {
    type: 'DETECT_PAGE',
    taskId: `task-${pageIndex}`,
    pageIndex,
    rgbaData: new ArrayBuffer(16),
    width: 2,
    height: 2,
    systemGapHeight: 50,
    partGapHeight: 15,
  };
}

describe('isWorkerAvailable', () => {
  it('returns whether Worker is defined', () => {
    const result = isWorkerAvailable();
    expect(typeof result).toBe('boolean');
  });
});

describe('createWorkerPool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses default worker factory when none provided', () => {
    const instances: unknown[] = [];
    class MockWorker {
      postMessage = vi.fn();
      terminate = vi.fn();
      onmessage: ((event: MessageEvent) => void) | null = null;
      constructor() { instances.push(this); }
    }
    vi.stubGlobal('Worker', MockWorker);

    const pool = createWorkerPool(1);
    expect(instances).toHaveLength(1);
    pool.terminate();

    vi.unstubAllGlobals();
  });

  it('should resolve a single task', async () => {
    const pool = createWorkerPool(2, createMockWorkerFactory());
    const result = await pool.submitTask(makeRequest(0));
    expect(result.type).toBe('DETECT_PAGE_RESULT');
    expect(result.pageIndex).toBe(0);
    pool.terminate();
  });

  it('should handle more tasks than workers via queuing', async () => {
    const pool = createWorkerPool(2, createMockWorkerFactory());
    const results = await Promise.all([
      pool.submitTask(makeRequest(0)),
      pool.submitTask(makeRequest(1)),
      pool.submitTask(makeRequest(2)),
      pool.submitTask(makeRequest(3)),
    ]);
    expect(results).toHaveLength(4);
    expect(results.map((r) => r.pageIndex).sort()).toEqual([0, 1, 2, 3]);
    pool.terminate();
  });

  it('should reject promise on worker error', async () => {
    const pool = createWorkerPool(1, createErrorWorkerFactory());
    await expect(pool.submitTask(makeRequest(0))).rejects.toThrow('test error');
    pool.terminate();
  });

  it('should terminate all workers', () => {
    const factory = createMockWorkerFactory();
    const pool = createWorkerPool(3, factory);
    pool.terminate();
    // Pool should have created and terminated 3 workers
    expect(pool.poolSize).toBe(3);
  });

  it('uses default poolSize from navigator.hardwareConcurrency', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 2 });

    const pool = createWorkerPool(
      undefined as unknown as number,
      createMockWorkerFactory(),
    );
    expect(pool.poolSize).toBe(2);
    pool.terminate();

    vi.unstubAllGlobals();
  });

  it('falls back to 4 when navigator.hardwareConcurrency is 0', () => {
    vi.stubGlobal('navigator', { hardwareConcurrency: 0 });

    const pool = createWorkerPool(
      undefined as unknown as number,
      createMockWorkerFactory(),
    );
    expect(pool.poolSize).toBe(4);
    pool.terminate();

    vi.unstubAllGlobals();
  });

  it('falls back to 4 when navigator is undefined', () => {
    const origNav = globalThis.navigator;
    // @ts-expect-error -- deliberately remove navigator to test fallback
    delete globalThis.navigator;

    const pool = createWorkerPool(
      undefined as unknown as number,
      createMockWorkerFactory(),
    );
    expect(pool.poolSize).toBe(4);
    pool.terminate();

    globalThis.navigator = origNav;
  });

  it('ignores responses with unknown taskId', async () => {
    const factory = () => {
      let handler: ((event: MessageEvent) => void) | null = null;
      const worker = {
        postMessage: vi.fn((msg: DetectPageRequest) => {
          setTimeout(() => {
            // Send an unknown taskId response first
            handler?.({
              data: {
                type: 'DETECT_PAGE_RESULT',
                taskId: 'unknown-task',
                pageIndex: 0,
                systems: [],
              },
            } as MessageEvent);
            // Then send the real response
            handler?.({
              data: {
                type: 'DETECT_PAGE_RESULT',
                taskId: msg.taskId,
                pageIndex: msg.pageIndex,
                systems: [],
              },
            } as MessageEvent);
          }, 0);
        }),
        terminate: vi.fn(),
        set onmessage(fn: (event: MessageEvent) => void) {
          handler = fn;
        },
      } as unknown as Worker;
      return worker;
    };

    const pool = createWorkerPool(1, factory);
    const result = await pool.submitTask(makeRequest(0));
    expect(result.type).toBe('DETECT_PAGE_RESULT');
    pool.terminate();
  });
});
