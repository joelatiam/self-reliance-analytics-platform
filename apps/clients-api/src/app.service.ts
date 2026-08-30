import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /** Liveness payload; the compose healthcheck reads this. */
  health() {
    return {
      status: 'ok',
      service: 'self-reliance-clients-api',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
