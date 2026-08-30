import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { AllConfigType } from 'src/config';

export const API_KEY_HEADER = 'x-api-key';

/**
 * Guards every route with a shared key. Auth is off when API_KEY is unset,
 * which is the default for local runs and keeps Swagger usable out of the box.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.getOrThrow('app', {
      infer: true,
    }).apiKey;
    if (!expected) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[API_KEY_HEADER];

    if (provided !== expected) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    return true;
  }
}
