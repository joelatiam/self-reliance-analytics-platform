import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AllConfigType } from 'src/config';
import { ActivityTickSource } from 'src/modules/clients/clients.constants';
import {
  formatActivityTickSlot,
  shouldExecuteActivityTick,
} from 'src/modules/clients/helpers/clients-activity-schedule.helper';
import { ClientsActivityService } from 'src/modules/clients/services/clients-activity.service';

/**
 * Drives the simulator on the 5th, 15th, 25th, 35th, 45th and 55th minute.
 * The cron fires every minute and the schedule helper decides whether this is
 * a tick minute — same guard pattern used for chunked syncs elsewhere, and it
 * keeps the schedule in one testable place rather than in a cron string.
 */
@Injectable()
export class OrchestrationTasksService {
  private readonly logger = new Logger(OrchestrationTasksService.name);

  constructor(
    private readonly activityService: ClientsActivityService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async runScheduledActivityTick(): Promise<void> {
    const clientsConfig = this.configService.getOrThrow('clients', {
      infer: true,
    });
    if (!clientsConfig.cronEnabled) return;
    if (!shouldExecuteActivityTick()) return;

    if (this.activityService.isTickRunning()) {
      this.logger.warn(
        'Previous activity tick is still running. Skipping this execution.',
      );
      return;
    }

    this.logger.debug(
      `Starting scheduled activity tick — ${formatActivityTickSlot()}`,
    );

    try {
      const result = await this.activityService.runTick({
        source: ActivityTickSource.CRON,
      });
      this.logger.debug(
        `Scheduled activity tick finished in ${result.durationMs}ms`,
      );
    } catch (error) {
      this.logger.error(
        `Error occurred while running the activity tick: ${error.message}`,
        error.stack,
      );
    }
  }
}
