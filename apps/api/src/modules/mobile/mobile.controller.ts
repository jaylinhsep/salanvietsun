import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MobileService } from './mobile.service';

@ApiTags('Mobile PWA (Captain & Field)')
@Controller('mobile')
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Get('captain-summary')
  @ApiOperation({ summary: 'Thông tin sà lan & chuyến hiện tại cho App Thuyền trưởng' })
  getCaptainSummary(@Query('vesselCode') vesselCode?: string) {
    return this.mobileService.getCaptainSummary(vesselCode);
  }

  @Post('checkin')
  @ApiOperation({ summary: 'Thuyền trưởng Check-in rời cảng / cập cảng kèm tọa độ GPS' })
  captainCheckIn(@Body() body: any) {
    return this.mobileService.captainCheckIn(body);
  }

  @Post('step')
  @ApiOperation({ summary: 'Thuyền trưởng báo cáo 5 bước hành trình (hỗ trợ đồng bộ offline)' })
  submitStep(@Body() body: any) {
    return this.mobileService.submitCaptainStep(body);
  }
}
