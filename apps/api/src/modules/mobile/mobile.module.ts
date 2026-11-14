import { Module } from '@nestjs/common';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { TrackingModule } from '../tracking/tracking.module';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [TrackingModule, DispatchModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
