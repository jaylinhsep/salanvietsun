import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
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
  listVoyages(@Query('scope') scope?: string) {
    return this.dispatchService.listVoyages(scope);
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

  @Delete('voyages/:id')
  @ApiOperation({ summary: 'Xóa chuyến (Hủy kế hoạch) và trả booking về hàng chờ' })
  deleteVoyage(@Param('id') id: string) {
    return this.dispatchService.deleteVoyage(id);
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

  @Get('containers')
  @ApiOperation({ summary: 'Báo cáo sản lượng toàn bộ container (Kế toán & Quyết toán)' })
  listAllContainers() {
    return this.dispatchService.listAllContainers();
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
  listBookings(@Query('scope') scope?: string) {
    return this.dispatchService.listBookings(scope);
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

  @Post('bookings/:id/unassign')
  @ApiOperation({ summary: 'Nhả 1 Booking khỏi chuyến đang gom về trạng thái chờ xếp tàu' })
  unassignBooking(@Param('id') id: string) {
    return this.dispatchService.unassignBooking(id);
  }

  @Post('voyages/:id/release')
  @ApiOperation({ summary: 'Nhả toàn bộ chuyến đang gom (PLANNED) và trả booking về hàng chờ' })
  releasePlannedVoyage(@Param('id') id: string) {
    return this.dispatchService.releasePlannedVoyage(id);
  }

  @Patch('voyages/:id/settlement')
  @ApiOperation({ summary: 'Cập nhật chi phí nhiên liệu / cảng / lương chuyến để chốt lãi lỗ' })
  updateSettlement(@Param('id') id: string, @Body() body: any) {
    return this.dispatchService.updateVoyageSettlement(id, body);
  }

  @Get('sailing-schedule')
  @ApiOperation({ summary: 'Lấy bảng lịch chạy sà lan (Form Excel & Public /lich)' })
  getSailingSchedule() {
    return this.dispatchService.getSailingSchedule();
  }

  @Put('sailing-schedule')
  @ApiOperation({ summary: 'Lưu / cập nhật bảng lịch chạy sà lan' })
  saveSailingSchedule(@Body() body: any) {
    return this.dispatchService.saveSailingSchedule(body);
  }

  @Get('storage-ai-status')
  @ApiOperation({ summary: 'Kiểm tra trạng thái cấu hình Cloudflare R2 & AI Vision' })
  getStorageAiStatus() {
    return this.dispatchService.getStorageAndAiStatus();
  }

  @Get('voyages/:id/tally-photos')
  @ApiOperation({ summary: 'Danh sách hình ảnh Tally & danh sách cont trích xuất bằng AI của chuyến' })
  listTallyPhotos(@Param('id') id: string) {
    return this.dispatchService.listTallyPhotos(id);
  }

  @Post('voyages/:id/tally-photos')
  @ApiOperation({ summary: 'Tải ảnh Tally đã nén lên Cloudflare R2 / máy chủ cho chuyến' })
  uploadTallyPhoto(@Param('id') id: string, @Body() body: any) {
    return this.dispatchService.uploadTallyPhoto(id, body);
  }

  @Get('tally-photos/:photoId/image')
  @ApiOperation({ summary: 'Xem / tải file nhị phân ảnh Tally' })
  async getTallyPhotoImage(@Param('photoId') photoId: string, @Res() res: Response) {
    const bin = await this.dispatchService.getTallyPhotoBinary(photoId);
    res.setHeader('Content-Type', bin.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(bin.buffer);
  }

  @Post('tally-photos/:photoId/extract-ai')
  @ApiOperation({ summary: 'Xử lý hình ảnh Tally bằng AI Vision để trích xuất list số container' })
  extractTallyPhotoAi(
    @Param('photoId') photoId: string,
    @Headers('x-ai-api-key') headerAiKey: string | undefined,
    @Body() body: { api_key?: string } | undefined,
  ) {
    return this.dispatchService.extractTallyPhotoWithAi(photoId, body?.api_key || headerAiKey);
  }

  @Patch('tally-photos/:photoId/extracted')
  @ApiOperation({ summary: 'Cập nhật / hiệu chỉnh danh sách container đã trích xuất từ ảnh Tally' })
  updateTallyPhotoExtracted(
    @Param('photoId') photoId: string,
    @Body() body: { containers: any[] },
  ) {
    return this.dispatchService.updateTallyPhotoExtracted(photoId, body?.containers || []);
  }

  @Delete('tally-photos/:photoId')
  @ApiOperation({ summary: 'Xóa ảnh Tally' })
  deleteTallyPhoto(@Param('photoId') photoId: string) {
    return this.dispatchService.deleteTallyPhoto(photoId);
  }
}
