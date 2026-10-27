import { Module } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { ProfilesController } from './profiles.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
