import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const tag = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const userId = (req as Request & { user?: { userId: string } }).user?.userId;
    const userPart = userId ? ` user=${userId.slice(0, 8)}…` : '';

    logger[tag === 'error' ? 'error' : tag === 'warn' ? 'warn' : 'info'](
      'HTTP',
      `${method} ${originalUrl} ${status} ${ms}ms${userPart}`
    );
  });

  next();
}
