import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { DatabaseService } from './database/database.service';
import { FleetModule } from './modules/fleet/fleet.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { OrdersModule } from './modules/orders/orders.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { MobileModule } from './modules/mobile/mobile.module';

@Controller('health')
class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      service: 'salanvietsun-tms-api',
      databaseConnected: this.db.connected,
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    FleetModule,
    DispatchModule,
    TrackingModule,
    OrdersModule,
    MaintenanceModule,
    MobileModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
