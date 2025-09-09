import { Injectable } from '@nestjs/common';
import { IntegrationService } from '@src/services/integration';
import { MemoContributionsInputData } from '@src/services/integration/inputs';
import { UserInfo } from '@src/services/integration/types';

@Injectable()
export class NorthStarMetricService {
  constructor(private readonly integrationService: IntegrationService) {}

  public reportMemoContributions(memoId: string, users: UserInfo[]) {
    this.integrationService.reportMemoContributions(new MemoContributionsInputData(memoId, users));
  }
}
