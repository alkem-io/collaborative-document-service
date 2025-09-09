import { setInterval } from 'node:timers/promises';
import {
  Extension,
  afterLoadDocumentPayload,
  afterUnloadDocumentPayload,
  onChangePayload,
  Document,
} from '@hocuspocus/server';
import { WINSTON_MODULE_NEST_PROVIDER, WinstonLogger } from 'nest-winston';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from '@src/config';
import { isAbortError } from '@common/util';
import { LogContext } from '@common/enums';
import { UserInfo } from '@src/services/integration/types';
import { WithConnectionContext } from '../connection.context';
import { NorthStarMetricService } from './north.star.metric.service';

@Injectable()
export class NorthStarMetric implements Extension {
  public readonly extensionName: string;

  private readonly trackerAbortControllers = new Map<string, AbortController>();
  // keep track of users who have contributed in the past interval;
  // this set MUST be cleared on each interval tick
  private readonly contributionsInThePastInterval = new Map<string, UserInfo>();

  private readonly contributionWindowMs: number;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: WinstonLogger,
    private readonly configService: ConfigService<ConfigType, true>,
    private readonly northStarMetricService: NorthStarMetricService
  ) {
    this.extensionName = NorthStarMetric.name;
    this.contributionWindowMs =
      1000 * this.configService.get('settings.collaboration.contribution_window', { infer: true });
  }
  // start the timer when the document is loaded
  // this coalesces with the time the room was created
  afterLoadDocument({ document }: afterLoadDocumentPayload): Promise<any> {
    this.startContributionTracker(document);
    return Promise.resolve();
  }
  // update client context about the last time they have changed the document
  onChange(data: WithConnectionContext<onChangePayload>): Promise<any> {
    data.context.lastContributed = new Date().getTime();

    if (data.context.userInfo) {
      this.contributionsInThePastInterval.set(data.context.userInfo.id, data.context.userInfo);
    }

    return Promise.resolve();
  }
  // stop the timer when the document is unloaded
  // this coalesces with the time the room was closed
  afterUnloadDocument({ documentName }: afterUnloadDocumentPayload): Promise<any> {
    this.stopContributionTracker(documentName);
    return Promise.resolve();
  }

  private async startContributionTracker(document: Document) {
    const roomId = document.name;

    const ac = new AbortController();
    this.trackerAbortControllers.set(roomId, ac);

    this.logger.verbose?.(
      `Starting contribution tracker for room '${roomId}' with interval ${this.contributionWindowMs}ms`,
      LogContext.NORTH_STAR_METRIC
    );

    try {
      // the interval will throw if aborted
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const tick of setInterval(this.contributionWindowMs, null, {
        signal: ac.signal,
      })) {
        this.reportContributions(document);
      }
    } catch (e: any) {
      if (isAbortError(e)) {
        this.logger.verbose?.(
          `Contribution tracker for room '${roomId}' was aborted with reason '${e.cause}'`,
          LogContext.NORTH_STAR_METRIC
        );
      } else {
        this.logger.error?.(
          `Contribution tracker for room '${roomId}' failed: ${e?.message}`,
          e?.stack,
          LogContext.NORTH_STAR_METRIC
        );
      }
    } finally {
      this.contributionsInThePastInterval.clear();
    }
  }

  private stopContributionTracker(roomId: string) {
    const ac = this.trackerAbortControllers.get(roomId);
    if (ac) {
      ac.abort('stop'); // this will trigger an exception in the timer
      this.trackerAbortControllers.delete(roomId);
    }
  }

  private reportContributions(document: Document) {
    if (this.contributionsInThePastInterval.size === 0) {
      this.logger.verbose?.(
        `No contributions to report for document '${document.name}' in the past interval. All Connections were read-only or idle.`,
        LogContext.NORTH_STAR_METRIC
      );
      return;
    }

    const users = Array.from(this.contributionsInThePastInterval.values());

    this.logger.verbose?.(
      `Reporting ${users.length} contribution ${users.length > 1 ? 's' : ''} for document '${document.name}' in the past interval.`,
      LogContext.NORTH_STAR_METRIC
    );

    this.contributionsInThePastInterval.clear();

    this.northStarMetricService.reportMemoContributions(document.name, Array.from(users));
  }
}
