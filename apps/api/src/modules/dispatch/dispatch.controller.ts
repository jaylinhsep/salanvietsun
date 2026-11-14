import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DispatchService } from './dispatch.service';

@ApiTags('Dispatching & Voyage Planning')
@Controller('dispatch')
export class DispatchController {
  constructor(private readonly dispatchService: DispatchService) {}

  @Get('ports')
  @ApiOperation({ summary: 'Danh sách cảng / bến thủy nội địa (PostGIS)' })
  listPorts() {
    return this.dispatchService.listPorts();
  }

  @Post('ports')
  @ApiOperation({ summary: 'Thêm mới cảng đi / cảng đến (POL/POD)' })
  createPort(@Body() body: any) {
    return this.dispatchService.createPort(body);
  }

  @Patch('ports/:id')
  @ApiOperation({ summary: 'Chỉnh sửa thông tin cảng' })
  updatePort(@Param('id') id: string, @Body() body: any) {
    return this.dispatchService.updatePort(id, body);
  }

  @Delete('ports/:id')
  @ApiOperation({ summary: 'Xóa cảng' })
  deletePort(@Param('id') id: string) {
    return this.dispatchService.deletePort(id);
  }

  @Get('voyages')
  @ApiOperation({ summary: 'Danh sách kế hoạch chuyến & gán container theo sà lan/khách hàng' })
  listVoyages() {
    return this.dispatchService.listVoyages();
  }

  @Post('voyages')
  @ApiOperation({ summary: 'Tạo lệnh điều độ chuyến & gán container (20E/20F/40E/40F)' })
  createVoyage(@Body() body: any) {
    return this.dispatchService.createVoyage(body);
  }

  @Patch('voyages/:id')
  @ApiOperation({ summary: 'Chỉnh sửa chuyến, gán lại container / sà lan / khách hàng / POL / POD' })
  updateVoyage(@Param('id') id: string, @Body() body: any) {
    return this.dispatchService.updateVoyage(id, body);
  }

  @Patch('voyages/:id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái chuyến (PLANNED -> IN_TRANSIT -> COMPLETED)' })
  updateVoyageStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.dispatchService.updateVoyageStatus(id, status);
  }
}
