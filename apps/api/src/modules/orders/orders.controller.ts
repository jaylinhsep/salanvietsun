import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';

@ApiTags('Order, Billing & Accounting')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('customers')
  @ApiOperation({ summary: 'Danh sách khách hàng & tổng công nợ phải thu' })
  listCustomers() {
    return this.ordersService.listCustomers();
  }

  @Post('customers')
  @ApiOperation({ summary: 'Thêm mới khách hàng' })
  createCustomer(@Body() body: any) {
    return this.ordersService.createCustomer(body);
  }

  @Patch('customers/:id')
  @ApiOperation({ summary: 'Chỉnh sửa thông tin khách hàng' })
  updateCustomer(@Param('id') id: string, @Body() body: any) {
    return this.ordersService.updateCustomer(id, body);
  }

  @Delete('customers/:id')
  @ApiOperation({ summary: 'Xóa khách hàng' })
  deleteCustomer(@Param('id') id: string) {
    return this.ordersService.deleteCustomer(id);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách đơn hàng vận tải sà lan' })
  listOrders() {
    return this.ordersService.listOrders();
  }

  @Post()
  @ApiOperation({ summary: 'Tạo đơn hàng & tự động tính cước vận chuyển' })
  createOrder(@Body() body: any) {
    return this.ordersService.createOrder(body);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Danh sách hóa đơn & công nợ' })
  listInvoices() {
    return this.ordersService.listInvoices();
  }

  @Patch('invoices/:id/payment')
  @ApiOperation({ summary: 'Ghi nhận thanh toán công nợ hóa đơn' })
  recordPayment(@Param('id') id: string, @Body('amount') amount: number) {
    return this.ordersService.recordPayment(id, Number(amount));
  }

  @Get('accounting/pnl')
  @ApiOperation({ summary: 'Báo cáo Tổng hợp Doanh thu - Chi phí - Lợi nhuận tháng & lũy kế năm' })
  getAccountingPnl(@Query('year') year?: string, @Query('month') month?: string) {
    const now = new Date();
    const y = Number(year) || now.getFullYear();
    const m = Number(month) || now.getMonth() + 1;
    return this.ordersService.getAccountingPnlReport(y, m);
  }

  @Get('accounting/:kind')
  @ApiOperation({ summary: 'Danh sách sổ kế toán (fixed-costs, port-expenses, fuel-entries, supplies, vendor-costs)' })
  listAccounting(
    @Param('kind') kind: any,
    @Query('month') month?: string,
    @Query('vessel_code') vessel_code?: string,
    @Query('category') category?: string,
  ) {
    return this.ordersService.listAccounting(kind, { month, vessel_code, category });
  }

  @Post('accounting/fixed-costs')
  @ApiOperation({ summary: 'Lưu / cập nhật chi phí cố định hàng tháng theo sà lan' })
  saveFixedCost(@Body() dto: any) {
    return this.ordersService.saveFixedCost(dto);
  }

  @Post('accounting/port-expenses')
  @ApiOperation({ summary: 'Thêm chi phí cảng vụ / cầu bến / bồi dưỡng / chi phí khác' })
  createPortExpense(@Body() dto: any) {
    return this.ordersService.createPortExpense(dto);
  }

  @Post('accounting/fuel-entries')
  @ApiOperation({ summary: 'Thêm phát sinh đổ dầu DO hoặc tiêu thụ dầu theo chặng' })
  createFuelEntry(@Body() dto: any) {
    return this.ordersService.createFuelEntry(dto);
  }

  @Post('accounting/supplies')
  @ApiOperation({ summary: 'Thêm chi phí mua vật tư / sửa chữa / lên đà sà lan' })
  createSupplyEntry(@Body() dto: any) {
    return this.ordersService.createSupplyEntry(dto);
  }

  @Post('accounting/vendor-costs')
  @ApiOperation({ summary: 'Thêm cước thuê ngoài Vendor (tàu ngoài)' })
  createVendorCost(@Body() dto: any) {
    return this.ordersService.createVendorCost(dto);
  }

  @Delete('accounting/:kind/:id')
  @ApiOperation({ summary: 'Xóa 1 dòng trong sổ kế toán' })
  deleteAccounting(@Param('kind') kind: any, @Param('id') id: string) {
    return this.ordersService.deleteAccounting(kind, id);
  }
}
