import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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

  @Get('voyages')
  @ApiOperation({ summary: 'Danh sách kế hoạch chuyến & điều độ sà lan' })
  listVoyages() {
    return this.dispatchService.listVoyages();
  }

  @Post('voyages')
  @ApiOperation({ summary: 'Tạo lệnh điều độ chuyến mới (tự động tính hải lý bằng PostGIS)' })
  createVoyage(@Body() body: any) {
    return this.dispatchService.createVoyage(body);
  }

  @Patch('voyages/:id/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái chuyến (PLANNED -> IN_TRANSIT -> COMPLETED)' })
  updateVoyageStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.dispatchService.updateVoyageStatus(id, status);
  }
}
