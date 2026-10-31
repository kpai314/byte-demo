import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  message: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Standard successful response conforming to Part F1 contract
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message: string | null = null,
  statusCode = 200,
  pagination?: { page: number; limit: number; total: number }
) {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  if (pagination) {
    payload.pagination = pagination;
  }
  return res.status(statusCode).json(payload);
}

/**
 * Standard error response conforming to Part F1 contract
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details: any = null
) {
  const payload: ApiErrorResponse = {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  return res.status(statusCode).json(payload);
}
