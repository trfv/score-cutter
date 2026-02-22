import { describe, it, expect, vi } from 'vitest';
import { createWorkerPool } from '../workerPool';
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

describe('createWorkerPool', () => {
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
});
