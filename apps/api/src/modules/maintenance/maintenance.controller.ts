import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';

@ApiTags('Maintenance & Repair')
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách phiếu bảo trì, sửa chữa & lên triền' })
  listOrders() {
    return this.maintenanceService.listOrders();
  }

  @Post()
  @ApiOperation({ summary: 'Tạo phiếu bảo trì / báo hỏng mới' })
  createOrder(@Body() body: any) {
    return this.maintenanceService.createOrder(body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cập nhật tiến độ sửa chữa' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('actual_cost') actualCost?: number,
  ) {
    return this.maintenanceService.updateStatus(id, status, actualCost);
  }
}
