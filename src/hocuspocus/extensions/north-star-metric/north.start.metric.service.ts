import { Injectable } from '@nestjs/common';
import { IntegrationService } from '@src/services/integration';
import { MemoContributionsInputData } from '@src/services/integration/inputs/memo.contributions.input.data';

@Injectable()
export class NorthStartMetricService {
  constructor(private readonly integrationService: IntegrationService) {}

  public reportMemoContributions(memoId: string, users: { id: string; email: string }[]) {
    return this.integrationService.reportMemoContributions(
      new MemoContributionsInputData(memoId, users)
    );
  }
}
