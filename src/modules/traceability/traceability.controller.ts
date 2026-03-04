import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { TraceabilityService, BatchTraceabilityResponseDto } from './traceability.service';

@ApiTags('Traceability')
@Controller('traceability')
export class TraceabilityController {
  constructor(private readonly traceabilityService: TraceabilityService) {}

  @Get('batch/:identifier')
  @Public()
  @ApiOperation({ summary: 'Get batch traceability by Batch ID or QR code (public)' })
  @ApiResponse({ status: 200, description: 'Batch traceability info and journey timeline' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  async getBatchTraceability(
    @Param('identifier') identifier: string,
  ): Promise<BatchTraceabilityResponseDto> {
    const decoded = decodeURIComponent(identifier);
    const result = await this.traceabilityService.getBatchTraceability(decoded);
    if (!result) {
      throw new NotFoundException('Batch not found');
    }
    return result;
  }
}
