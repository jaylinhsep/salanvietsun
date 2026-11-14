import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrackingService } from './tracking.service';

@ApiTags('AIS/GPS & Fuel Monitoring')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get('live')
  @ApiOperation({ summary: 'Vị trí AIS/GPS realtime của toàn đội tàu + kiểm tra vùng cảng (PostGIS ST_DWithin)' })
  getLivePositions() {
    return this.trackingService.getLivePositions();
  }

  @Post('ais')
  @ApiOperation({ summary: 'Nhận tín hiệu GPS/AIS từ thiết bị trên sà lan hoặc PWA' })
  ingestAisPing(@Body() body: any) {
    return this.trackingService.ingestAisPing(body);
  }

  @Get('fuel')
  @ApiOperation({ summary: 'Nhật ký cấp dầu & tiêu thụ nhiên liệu' })
  getFuelLogs(@Query('vesselId') vesselId?: string) {
    return this.trackingService.getFuelLogs(vesselId);
  }

  @Post('fuel')
  @ApiOperation({ summary: 'Ghi nhận cấp dầu (Bunkering), tiêu thụ hoặc tồn két (ROB)' })
  createFuelLog(@Body() body: any) {
    return this.trackingService.createFuelLog(body);
  }
}
