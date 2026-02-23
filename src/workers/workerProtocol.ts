import type { SystemBoundaryPx } from '../core/systemDetector';

export interface DetectSystemsRequest {
  type: 'DETECT_SYSTEMS';
  taskId: string;
  pageIndex: number;
  rgbaData: ArrayBuffer;
  width: number;
  height: number;
  systemGapHeight: number;
}

export interface DetectSystemsResponse {
  type: 'DETECT_SYSTEMS_RESULT';
  taskId: string;
  pageIndex: number;
  systems: SystemBoundaryPx[];
}

export interface WorkerErrorResponse {
  type: 'ERROR';
  taskId: string;
  message: string;
}

export type WorkerRequest = DetectSystemsRequest;
export type WorkerResponse = DetectSystemsResponse | WorkerErrorResponse;
