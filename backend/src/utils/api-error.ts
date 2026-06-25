import { Response } from 'express';

export type ApiErrorCode =
  | 'REPO_NOT_READY'
  | 'REPO_NOT_FOUND'
  | 'SCAN_NOT_FOUND'
  | 'VPS_NOT_FOUND'
  | 'SETUP_INCOMPLETE'
  | 'ANALYSIS_FAILED'
  | 'CHAT_FAILED'
  | 'INVALID_TOKEN'
  | 'INVALID_ARGS'
  | 'COMMAND_NOT_ALLOWED'
  | 'AGENT_NOT_FOUND'
  | 'AGENT_WS_OFFLINE'
  | 'NO_DOCKER_DATA'
  | 'NO_SERVICE_DATA'
  | 'LOG_FETCH_FAILED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export function sendError(res: Response, err: unknown, fallback = 'Request failed') {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  res.status(500).json({
    error: 'INTERNAL_ERROR' as ApiErrorCode,
    message: err instanceof Error ? err.message : fallback,
  });
}
