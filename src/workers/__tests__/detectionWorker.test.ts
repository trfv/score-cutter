import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMessage } from '../detectionWorker';
import type { DetectSystemsRequest, DetectStaffsRequest } from '../workerProtocol';

vi.mock('../detectionPipeline', () => ({
  runSystemDetection: vi.fn(),
  runStaffDetection: vi.fn(),
}));

import { runSystemDetection, runStaffDetection } from '../detectionPipeline';

const mockSystemPipeline = vi.mocked(runSystemDetection);
const mockStaffPipeline = vi.mocked(runStaffDetection);

function makeSystemRequest(overrides?: Partial<DetectSystemsRequest>): DetectSystemsRequest {
  const rgbaData = new Uint8ClampedArray([0, 0, 0, 255]).buffer;
  return {
    type: 'DETECT_SYSTEMS',
    taskId: 'task-1',
    pageIndex: 0,
    rgbaData,
    width: 1,
    height: 1,
    systemGapHeight: 50,
    ...overrides,
  };
}

function makeStaffRequest(overrides?: Partial<DetectStaffsRequest>): DetectStaffsRequest {
  const rgbaData = new Uint8ClampedArray([0, 0, 0, 255]).buffer;
  return {
    type: 'DETECT_STAFFS',
    taskId: 'task-2',
    pageIndex: 0,
    rgbaData,
    width: 1,
    height: 1,
    systemBoundaries: [{ topPx: 0, bottomPx: 100 }],
    partGapHeight: 15,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('module-level wiring', () => {
  it('registers onmessage handler on self that delegates to handleMessage', () => {
    const handler = (self as unknown as Record<string, unknown>).onmessage as
      ((event: MessageEvent) => void) | undefined;
    expect(handler).toBeTypeOf('function');

    const systems = [{ topPx: 0, bottomPx: 100 }];
    mockSystemPipeline.mockReturnValue({ systems });

    const originalPostMessage = self.postMessage;
    const mockPostMessage = vi.fn();
    self.postMessage = mockPostMessage as typeof self.postMessage;

    handler!({ data: makeSystemRequest() } as MessageEvent);

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'DETECT_SYSTEMS_RESULT',
      taskId: 'task-1',
      pageIndex: 0,
      systems,
    });

    self.postMessage = originalPostMessage;
  });
});

describe('handleMessage — DETECT_SYSTEMS', () => {
  it('posts DetectSystemsResponse for a valid DETECT_SYSTEMS request', () => {
    const systems = [{ topPx: 0, bottomPx: 100 }];
    mockSystemPipeline.mockReturnValue({ systems });

    const postMessage = vi.fn();
    handleMessage(makeSystemRequest(), postMessage);

    expect(postMessage).toHaveBeenCalledWith({
      type: 'DETECT_SYSTEMS_RESULT',
      taskId: 'task-1',
      pageIndex: 0,
      systems,
    });
  });

  it('posts WorkerErrorResponse when runSystemDetection throws Error', () => {
    mockSystemPipeline.mockImplementation(() => { throw new Error('detection failed'); });

    const postMessage = vi.fn();
    handleMessage(makeSystemRequest(), postMessage);

    expect(postMessage).toHaveBeenCalledWith({
      type: 'ERROR',
      taskId: 'task-1',
      message: 'detection failed',
    });
  });

  it('converts non-Error exceptions to string in error response', () => {
    mockSystemPipeline.mockImplementation(() => { throw 'string error'; });

    const postMessage = vi.fn();
    handleMessage(makeSystemRequest(), postMessage);

    expect(postMessage).toHaveBeenCalledWith({
      type: 'ERROR',
      taskId: 'task-1',
      message: 'string error',
    });
  });
});

describe('handleMessage — DETECT_STAFFS', () => {
  it('posts DetectStaffsResponse for a valid DETECT_STAFFS request', () => {
    const staffsBySystem = [[{ topPx: 10, bottomPx: 50 }, { topPx: 55, bottomPx: 90 }]];
    mockStaffPipeline.mockReturnValue({ staffsBySystem });

    const postMessage = vi.fn();
    handleMessage(makeStaffRequest(), postMessage);

    expect(postMessage).toHaveBeenCalledWith({
      type: 'DETECT_STAFFS_RESULT',
      taskId: 'task-2',
      pageIndex: 0,
      staffsBySystem,
    });
  });

  it('posts WorkerErrorResponse when runStaffDetection throws Error', () => {
    mockStaffPipeline.mockImplementation(() => { throw new Error('staff detection failed'); });

    const postMessage = vi.fn();
    handleMessage(makeStaffRequest(), postMessage);

    expect(postMessage).toHaveBeenCalledWith({
      type: 'ERROR',
      taskId: 'task-2',
      message: 'staff detection failed',
    });
  });

  it('converts non-Error exceptions to string in error response', () => {
    mockStaffPipeline.mockImplementation(() => { throw 42; });

    const postMessage = vi.fn();
    handleMessage(makeStaffRequest(), postMessage);

    expect(postMessage).toHaveBeenCalledWith({
      type: 'ERROR',
      taskId: 'task-2',
      message: '42',
    });
  });
});

describe('handleMessage — unknown type', () => {
  it('ignores messages with unknown type', () => {
    const postMessage = vi.fn();
    handleMessage({ type: 'UNKNOWN' } as never, postMessage);

    expect(postMessage).not.toHaveBeenCalled();
  });
});
