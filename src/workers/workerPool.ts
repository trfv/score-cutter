import type {
  WorkerRequest,
  WorkerSuccessResponse,
  WorkerResponse,
  WorkerErrorResponse,
} from './workerProtocol';

interface PoolTask {
  request: WorkerRequest;
  resolve: (result: WorkerSuccessResponse) => void;
  reject: (error: Error) => void;
}

interface DetectionWorkerPool {
  submitTask(request: WorkerRequest): Promise<WorkerSuccessResponse>;
  terminate(): void;
  readonly poolSize: number;
}

export function isWorkerAvailable(): boolean {
  return typeof Worker !== 'undefined';
}

export function createWorkerPool(
  poolSize: number = typeof navigator !== 'undefined'
    ? navigator.hardwareConcurrency || 4
    : 4,
  workerFactory?: () => Worker,
): DetectionWorkerPool {
  const defaultFactory = () =>
    new Worker(new URL('./detectionWorker.ts', import.meta.url), { type: 'module' });

  const factory = workerFactory ?? defaultFactory;
  const workers: Worker[] = [];
  const idleWorkers: Worker[] = [];
  const queue: PoolTask[] = [];
  const pendingTasks = new Map<string, PoolTask>();

  for (let i = 0; i < poolSize; i++) {
    const worker = factory();
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const task = pendingTasks.get(response.taskId);
      if (!task) return;
      pendingTasks.delete(response.taskId);

      if (response.type === 'ERROR') {
        task.reject(new Error((response as WorkerErrorResponse).message));
      } else {
        task.resolve(response);
      }

      const nextTask = queue.shift();
      if (nextTask) {
        dispatchToWorker(worker, nextTask);
      } else {
        idleWorkers.push(worker);
      }
    };
    workers.push(worker);
    idleWorkers.push(worker);
  }

  function dispatchToWorker(worker: Worker, task: PoolTask): void {
    pendingTasks.set(task.request.taskId, task);
    worker.postMessage(task.request, [task.request.rgbaData]);
  }

  function submitTask(request: WorkerRequest): Promise<WorkerSuccessResponse> {
    return new Promise<WorkerSuccessResponse>((resolve, reject) => {
      const task: PoolTask = { request, resolve, reject };
      const worker = idleWorkers.shift();
      if (worker) {
        dispatchToWorker(worker, task);
      } else {
        queue.push(task);
      }
    });
  }

  function terminate(): void {
    for (const w of workers) {
      w.terminate();
    }
    workers.length = 0;
    idleWorkers.length = 0;
    queue.length = 0;
    pendingTasks.clear();
  }

  return { submitTask, terminate, poolSize };
}
