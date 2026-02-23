import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMessage } from '../detectionWorker';
import type { DetectPageRequest } from '../workerProtocol';

vi.mock('../detectionPipeline', () => ({
  runDetectionPipeline: vi.fn(),
}));

import { runDetectionPipeline } from '../detectionPipeline';

const mockPipeline = vi.mocked(runDetectionPipeline);

function makeRequest(overrides?: Partial<DetectPageRequest>): DetectPageRequest {
  const rgbaData = new Uint8ClampedArray([0, 0, 0, 255]).buffer;
  return {
    type: 'DETECT_PAGE',
    taskId: 'task-1',
    pageIndex: 0,
    rgbaData,
    width: 1,
    height: 1,
    systemGapHeight: 50,
    partGapHeight: 15,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('module-level wiring', () => {
  it('registers onmessage handler on self that delegates to handleMessage', () => {
    // The module-level code has set self.onmessage
    const handler = (self as unknown as Record<string, unknown>).onmessage as
      ((event: MessageEvent) => void) | undefined;
    expect(handler).toBeTypeOf('function');

    // Set up mock pipeline to return data
    const systems = [{ topPx: 0, bottomPx: 100, parts: [{ topPx: 0, bottomPx: 100 }] }];
    mockPipeline.mockReturnValue({ systems });

    // Mock self.postMessage to capture the response
    const originalPostMessage = self.postMessage;
    const mockPostMessage = vi.fn();
    self.postMessage = mockPostMessage as typeof self.postMessage;

    handler!({ data: makeRequest() } as MessageEvent);

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'DETECT_PAGE_RESULT',
      taskId: 'task-1',
      pageIndex: 0,
      systems,
    });

    self.postMessage = originalPostMessage;
  });
});

describe('handleMessage', () => {
  it('posts DetectPageResponse for a valid DETECT_PAGE request', () => {
    const systems = [{ topPx: 0, bottomPx: 100, parts: [{ topPx: 0, bottomPx: 100 }] }];
    mockPipeline.mockReturnValue({ systems });

    const postMessage = vi.fn();
    handleMessage(makeRequest(), postMessage);

    expect(postMessage).toHaveBeenCalledWith({
      type: 'DETECT_PAGE_RESULT',
      taskId: 'task-1',
      pageIndex: 0,
      systems,
    });
  });

  it('posts WorkerErrorResponse when runDetectionPipeline throws Error', () => {
    mockPipeline.mockImplementation(() => { throw new Error('detection failed'); });

    const postMessage = vi.fn();
    handleMessage(makeRequest(), postMessage);

    expect(postMessage).toHaveBeenCalledWith({
      type: 'ERROR',
      taskId: 'task-1',
      message: 'detection failed',
    });
  });

  it('converts non-Error exceptions to string in error response', () => {
    mockPipeline.mockImplementation(() => { throw 'string error'; });

    const postMessage = vi.fn();
    handleMessage(makeRequest(), postMessage);

    expect(postMessage).toHaveBeenCalledWith({
      type: 'ERROR',
      taskId: 'task-1',
      message: 'string error',
    });
  });

  it('ignores messages with unknown type', () => {
    const postMessage = vi.fn();
    handleMessage({ type: 'UNKNOWN' } as never, postMessage);

    expect(postMessage).not.toHaveBeenCalled();
  });
});
