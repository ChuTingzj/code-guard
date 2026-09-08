import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatsService } from './stats.service';

@Controller('api/v1/stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  overview(@Query('range') range = '7d') {
    return this.stats.overview(range);
  }

  @Get('trend')
  trend(@Query('range') range = '30d', @Query('interval') interval = 'week') {
    return this.stats.trend(range, interval);
  }

  @Get('top-violations')
  topViolations(@Query('range') range = '30d', @Query('limit') limit = '10') {
    return this.stats.topViolations(range, Number(limit) || 10);
  }

  @Get('by-project')
  byProject(@Query('range') range = '30d') {
    return this.stats.byProject(range);
  }
}
