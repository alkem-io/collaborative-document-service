import { setInterval } from 'node:timers/promises';
import {
  Extension,
  afterLoadDocumentPayload,
  afterUnloadDocumentPayload,
  onChangePayload,
  Document,
  beforeUnloadDocumentPayload,
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

type ContributionTrackerRoomData = {
  abortController: AbortController;
  contributedUsers: Map<string, UserInfo>;
};

@Injectable()
export class NorthStarMetric implements Extension {
  public readonly extensionName: string;

  // keep track of users per room, who have contributed in the past interval;
  // this MUST be cleared on each interval tick and on document unload
  private readonly contributionTrackers = new Map<string, ContributionTrackerRoomData>();

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
    if (!data.context.userInfo) {
      return Promise.resolve();
    }

    data.context.lastContributed = new Date().getTime();

    const thisUserId = data.context.userInfo.id;

    if (!thisUserId) {
      return Promise.resolve();
    }

    const roomId = data.document.name;
    const roomData = this.contributionTrackers.get(roomId);

    if (!roomData) {
      return Promise.resolve();
    }
    // add the user to the set of contributors for this room
    roomData.contributedUsers.set(thisUserId, data.context.userInfo);

    return Promise.resolve();
  }
  // stop the timer when the document is unloaded
  // this coalesces with the time the room was closed
  beforeUnloadDocument({ document }: beforeUnloadDocumentPayload): Promise<any> {
    this.stopContributionTracker(document);
    return Promise.resolve();
  }

  private async startContributionTracker(document: Document) {
    const roomId = document.name;

    if (this.contributionTrackers.has(roomId)) {
      this.logger.error(
        `Contribution tracker already running for room '${roomId}'`,
        LogContext.NORTH_STAR_METRIC
      );
      return;
    }

    const roomData: ContributionTrackerRoomData = {
      abortController: new AbortController(),
      contributedUsers: new Map<string, UserInfo>(),
    };
    this.contributionTrackers.set(roomId, roomData);

    this.logger.verbose?.(
      `Starting contribution tracker for room '${roomId}' with interval ${this.contributionWindowMs}ms`,
      LogContext.NORTH_STAR_METRIC
    );

    try {
      // the interval will throw if aborted
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const tick of setInterval(this.contributionWindowMs, null, {
        signal: roomData.abortController.signal,
      })) {
        this.reportContributions(document);
      }
    } catch (e: any) {
      this.contributionTrackers.delete(roomId);

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
    }
  }

  private stopContributionTracker(document: Document) {
    const roomId = document.name;
    const tracker = this.contributionTrackers.get(roomId);

    if (!tracker) {
      this.logger.error(
        `No contribution tracker found for room '${roomId}'`,
        LogContext.NORTH_STAR_METRIC
      );
      return;
    }
    // Flush before aborting the loop.
    this.reportContributions(document);

    const ac = tracker.abortController;
    ac.abort('stop'); // this will trigger an exception in the timer

    this.contributionTrackers.delete(roomId);
  }

  private reportContributions(document: Document) {
    const roomId = document.name;

    const roomData = this.contributionTrackers.get(roomId);
    if (!roomData) {
      this.logger.error(
        `No contribution tracker found for room '${roomId}'`,
        LogContext.NORTH_STAR_METRIC
      );
      return;
    }

    if (roomData.contributedUsers.size === 0) {
      this.logger.verbose?.(
        `No contributions to report for document '${roomId}' in the past interval. All Connections were read-only or idle.`,
        LogContext.NORTH_STAR_METRIC
      );
      return;
    }

    const users = Array.from(roomData.contributedUsers.values());
    roomData.contributedUsers.clear();

    this.logger.verbose?.(
      `Reporting ${users.length} contribution ${users.length > 1 ? 's' : ''} for document '${roomId}' in the past interval.`,
      LogContext.NORTH_STAR_METRIC
    );

    this.northStarMetricService.reportMemoContributions(roomId, Array.from(users));
  }
}
