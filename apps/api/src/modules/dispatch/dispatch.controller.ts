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

  @Get('voyages/:id/containers')
  @ApiOperation({ summary: 'Danh sách chi tiết từng container theo chuyến' })
  listVoyageContainers(@Param('id') id: string) {
    return this.dispatchService.listVoyageContainers(id);
  }

  @Post('voyages/:id/containers')
  @ApiOperation({ summary: 'Thêm 1 dòng container chi tiết vào chuyến' })
  createVoyageContainer(@Param('id') id: string, @Body() body: any) {
    return this.dispatchService.createVoyageContainer(id, body);
  }

  @Post('voyages/:id/containers/bulk')
  @ApiOperation({ summary: 'Nhập hàng loạt danh sách container (dán từ Excel)' })
  bulkCreateVoyageContainers(
    @Param('id') id: string,
    @Body() body: { rows: any[]; replace?: boolean },
  ) {
    return this.dispatchService.bulkCreateVoyageContainers(id, body);
  }

  @Post('voyages/:id/sync-containers')
  @ApiOperation({ summary: 'Đồng bộ tổng số cont 20E/20F/40E/40F & TEUs lên lệnh chuyến' })
  syncVoyageCounts(@Param('id') id: string) {
    return this.dispatchService.syncVoyageCountsFromDetails(id);
  }

  @Patch('containers/:containerId')
  @ApiOperation({ summary: 'Cập nhật 1 dòng container chi tiết' })
  updateVoyageContainer(@Param('containerId') containerId: string, @Body() body: any) {
    return this.dispatchService.updateVoyageContainer(containerId, body);
  }

  @Delete('containers/:containerId')
  @ApiOperation({ summary: 'Xóa 1 dòng container chi tiết' })
  deleteVoyageContainer(@Param('containerId') containerId: string) {
    return this.dispatchService.deleteVoyageContainer(containerId);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Danh sách Booking chờ xếp tàu & đã gán chuyến' })
  listBookings() {
    return this.dispatchService.listBookings();
  }

  @Post('bookings')
  @ApiOperation({ summary: 'Tạo Booking vận chuyển mới (Bước 1)' })
  createBooking(@Body() body: any) {
    return this.dispatchService.createBooking(body);
  }

  @Patch('bookings/:id')
  @ApiOperation({ summary: 'Chỉnh sửa Booking (Hàng xuất/nhập, SL cont, giờ cắt máng/hạn lệnh)' })
  updateBooking(@Param('id') id: string, @Body() body: any) {
    return this.dispatchService.updateBooking(id, body);
  }

  @Delete('bookings/:id')
  @ApiOperation({ summary: 'Xóa Booking' })
  deleteBooking(@Param('id') id: string) {
    return this.dispatchService.deleteBooking(id);
  }

  @Post('bookings/assign')
  @ApiOperation({ summary: 'Ghép 1 hoặc nhiều Booking vào Sà lan / Chuyến (Điều độ 1 chạm)' })
  assignBookings(@Body() body: { booking_ids: string[]; vessel_id: string; voyage_id?: string; voyage_no?: string }) {
    return this.dispatchService.assignBookingsToBarge(body);
  }

  @Patch('voyages/:id/settlement')
  @ApiOperation({ summary: 'Cập nhật chi phí nhiên liệu / cảng / lương chuyến để chốt lãi lỗ' })
  updateSettlement(@Param('id') id: string, @Body() body: any) {
    return this.dispatchService.updateVoyageSettlement(id, body);
  }
}
