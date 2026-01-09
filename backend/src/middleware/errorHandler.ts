import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/database';

export interface ApiError extends Error {
  statusCode: number;
  isOperational?: boolean;
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const createError = (message: string, statusCode: number): ApiError => {
  return new AppError(message, statusCode);
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Resource not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    user: (req as any).user?.id,
    ip: req.ip,
  });

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      error = createError('Duplicate field value entered', 400);
    } else if (prismaErr.code === 'P2025') {
      error = createError('Record not found', 404);
    } else {
      error = createError('Database error', 400);
    }
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message).join(', ');
    error = createError(`Validation Error: ${message}`, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = createError('Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = createError('Token expired', 401);
  }

  // Duplicate key errors
  if ((err as any).code === 11000) {
    const value = (err as any).errmsg.match(/(["'])(\\?.)*?\1/)[0];
    error = createError(`Duplicate field value: ${value}`, 400);
  }

  // Cast errors
  if (err.name === 'CastError') {
    error = createError('Resource not found', 404);
  }

  // Rate limiting errors
  if (err.name === 'TooManyRequests') {
    error = createError('Too many requests, please try again later', 429);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};