/// <reference lib="webworker" />

import { runSystemDetection, runStaffDetection } from './detectionPipeline';
import type { WorkerRequest, WorkerResponse } from './workerProtocol';

export function handleMessage(
  request: WorkerRequest,
  postMessage: (msg: WorkerResponse) => void,
): void {
  if (request.type === 'DETECT_SYSTEMS') {
    try {
      const rgbaData = new Uint8ClampedArray(request.rgbaData);
      const result = runSystemDetection({
        rgbaData,
        width: request.width,
        height: request.height,
        systemGapHeight: request.systemGapHeight,
      });

      postMessage({
        type: 'DETECT_SYSTEMS_RESULT',
        taskId: request.taskId,
        pageIndex: request.pageIndex,
        systems: result.systems,
      });
    } catch (err) {
      postMessage({
        type: 'ERROR',
        taskId: request.taskId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  } else if (request.type === 'DETECT_STAFFS') {
    try {
      const rgbaData = new Uint8ClampedArray(request.rgbaData);
      const result = runStaffDetection({
        rgbaData,
        width: request.width,
        height: request.height,
        systemBoundaries: request.systemBoundaries,
        partGapHeight: request.partGapHeight,
      });

      postMessage({
        type: 'DETECT_STAFFS_RESULT',
        taskId: request.taskId,
        pageIndex: request.pageIndex,
        staffsBySystem: result.staffsBySystem,
      });
    } catch (err) {
      postMessage({
        type: 'ERROR',
        taskId: request.taskId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;
ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  handleMessage(event.data, (msg) => ctx.postMessage(msg));
};
