import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FleetService } from './fleet.service';

@ApiTags('Fleet & Asset Management')
@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Get('vessels')
  @ApiOperation({ summary: 'Danh sách đội sà lan & tàu kéo kèm tọa độ PostGIS' })
  findAllVessels() {
    return this.fleetService.findAllVessels();
  }

  @Post('vessels')
  @ApiOperation({ summary: 'Thêm mới sà lan / đầu kéo' })
  createVessel(@Body() body: any) {
    return this.fleetService.createVessel(body);
  }

  @Patch('vessels/:id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái phương tiện' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.fleetService.updateStatus(id, status);
  }

  @Get('equipment')
  @ApiOperation({ summary: 'Danh sách thiết bị & máy móc trên tàu' })
  getEquipment(@Query('vesselId') vesselId?: string) {
    return this.fleetService.getEquipment(vesselId);
  }
}
