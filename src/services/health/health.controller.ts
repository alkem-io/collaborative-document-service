import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { IntegrationService } from '@src/services/integration';

@Controller('/health')
export class HealthController {
  constructor(private readonly integrationService: IntegrationService) {}
  @Get('/')
  public async healthCheck(): Promise<string> {
    if (!(await this.integrationService.isConnected())) {
      throw new HttpException('unhealthy!', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return 'healthy!';
  }
}
