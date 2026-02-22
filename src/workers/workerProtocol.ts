import type { SystemBoundary } from '../core/staffDetector';

export interface DetectPageRequest {
  type: 'DETECT_PAGE';
  taskId: string;
  pageIndex: number;
  rgbaData: ArrayBuffer;
  width: number;
  height: number;
  systemGapHeight: number;
  partGapHeight: number;
}

export interface DetectPageResponse {
  type: 'DETECT_PAGE_RESULT';
  taskId: string;
  pageIndex: number;
  systems: SystemBoundary[];
}

export interface WorkerErrorResponse {
  type: 'ERROR';
  taskId: string;
  message: string;
}

export type WorkerRequest = DetectPageRequest;
export type WorkerResponse = DetectPageResponse | WorkerErrorResponse;
