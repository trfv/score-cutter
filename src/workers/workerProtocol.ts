import type { SystemBoundaryPx } from '../core/systemDetector';
import type { StaffBoundary } from '../core/staffDetector';

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

export interface DetectStaffsRequest {
  type: 'DETECT_STAFFS';
  taskId: string;
  pageIndex: number;
  rgbaData: ArrayBuffer;
  width: number;
  height: number;
  systemBoundaries: SystemBoundaryPx[];
  partGapHeight: number;
}

interface DetectStaffsResponse {
  type: 'DETECT_STAFFS_RESULT';
  taskId: string;
  pageIndex: number;
  staffsBySystem: StaffBoundary[][];
}

export interface WorkerErrorResponse {
  type: 'ERROR';
  taskId: string;
  message: string;
}

export type WorkerRequest = DetectSystemsRequest | DetectStaffsRequest;
export type WorkerSuccessResponse = DetectSystemsResponse | DetectStaffsResponse;
export type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;
