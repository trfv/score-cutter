/// <reference lib="webworker" />

import { runDetectionPipeline } from './detectionPipeline';
import type { WorkerRequest, DetectPageResponse, WorkerErrorResponse } from './workerProtocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

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

      const response: DetectPageResponse = {
        type: 'DETECT_PAGE_RESULT',
        taskId: request.taskId,
        pageIndex: request.pageIndex,
        systems: result.systems,
      };
      ctx.postMessage(response);
    } catch (err) {
      const errResponse: WorkerErrorResponse = {
        type: 'ERROR',
        taskId: request.taskId,
        message: err instanceof Error ? err.message : String(err),
      };
      ctx.postMessage(errResponse);
    }
  }
};
