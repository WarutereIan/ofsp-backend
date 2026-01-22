import { Controller, Get, UseGuards, Request, Param, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BadgeService } from './badge.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('badges')
@Controller('badges')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BadgeController {
  constructor(private readonly badgeService: BadgeService) {}

  @Get('my-badges')
  @ApiOperation({ summary: 'Get all badges with progress for current user' })
  async getMyBadges(@Request() req: any) {
    return this.badgeService.getUserBadges(req.user.id);
  }

  @Get('farmer/:farmerId')
  @ApiOperation({ summary: 'Get badges for a specific farmer' })
  async getFarmerBadges(@Request() req: any, @Param('farmerId') farmerId: string) {
    // Only allow if user is the farmer or admin/staff
    if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF' && req.user.id !== farmerId) {
      throw new ForbiddenException('Unauthorized to view this farmer\'s badges');
    }
    return this.badgeService.getUserBadges(farmerId);
  }
}
