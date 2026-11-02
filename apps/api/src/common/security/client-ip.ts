import type { Request } from 'express';
import type { NodeEnv } from '../../config/env.schema';

export function clientIp(req: Request, nodeEnv: NodeEnv): string {
  if (nodeEnv === 'production') {
    const forwarded = req.headers['x-forwarded-for'];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = value?.split(',')[0]?.trim();
    if (first !== undefined && first.length > 0) {
      return first;
    }
  }
  return req.socket.remoteAddress ?? 'unknown';
}
