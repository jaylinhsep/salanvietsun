import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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
}
