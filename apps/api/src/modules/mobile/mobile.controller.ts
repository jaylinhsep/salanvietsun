import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MobileService } from './mobile.service';

@ApiTags('Mobile PWA (Captain & Field)')
@Controller('mobile')
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập tài khoản Thuyền trưởng (gắn cố định 1 sà lan)' })
  login(@Body() body: { username?: string; password?: string }) {
    return this.mobileService.loginCaptain(body);
  }

  @Get('workspace')
  @ApiOperation({ summary: 'Dữ liệu cô lập của riêng sà lan mà Thuyền trưởng đang đăng nhập' })
  getWorkspace(@Headers('authorization') authorization?: string) {
    return this.mobileService.getCaptainWorkspace(authorization);
  }

  @Get('captain-summary')
  @ApiOperation({ summary: 'Thông tin sà lan & chuyến hiện tại cho App Thuyền trưởng' })
  getCaptainSummary(@Headers('authorization') authorization?: string) {
    return this.mobileService.getCaptainSummaryWithAuth(authorization);
  }

  @Post('checkin')
  @ApiOperation({ summary: 'Thuyền trưởng Check-in rời cảng / cập cảng kèm tọa độ GPS' })
  captainCheckIn(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    return this.mobileService.captainCheckInWithAuth(authorization, body);
  }

  @Post('step')
  @ApiOperation({ summary: 'Thuyền trưởng báo cáo 5 bước hành trình (hỗ trợ đồng bộ offline)' })
  submitStep(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    return this.mobileService.submitCaptainStepWithAuth(authorization, body);
  }

  @Post('fuel')
  @ApiOperation({ summary: 'Thuyền trưởng báo cáo cấp dầu / tiêu thụ cho sà lan của mình' })
  reportFuel(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    return this.mobileService.createScopedFuelLog(authorization, body);
  }

  @Post('maintenance')
  @ApiOperation({ summary: 'Thuyền trưởng gửi yêu cầu bảo trì / báo sự cố cho sà lan của mình' })
  reportMaintenance(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    return this.mobileService.createScopedMaintenanceOrder(authorization, body);
  }

  @Post('tally-photos')
  @ApiOperation({ summary: 'Thuyền trưởng gửi ảnh biên bản Tally (đã nén) lên Cloudflare R2' })
  uploadTallyPhoto(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: any,
  ) {
    return this.mobileService.uploadCaptainTallyPhoto(authorization, body);
  }
}
