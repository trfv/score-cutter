/// <reference lib="webworker" />

import { runDetectionPipeline } from './detectionPipeline';
import type { WorkerRequest, WorkerResponse } from './workerProtocol';

export function handleMessage(
  request: WorkerRequest,
  postMessage: (msg: WorkerResponse) => void,
): void {
  if (request.type === 'DETECT_PAGE') {
    try {
      const rgbaData = new Uint8ClampedArray(request.rgbaData);
      const result = runDetectionPipeline({
        rgbaData,
        width: request.width,
        height: request.height,
        systemGapHeight: request.systemGapHeight,
        partGapHeight: request.partGapHeight,
      });

      postMessage({
        type: 'DETECT_PAGE_RESULT',
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
  }
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;
ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  handleMessage(event.data, (msg) => ctx.postMessage(msg));
};
