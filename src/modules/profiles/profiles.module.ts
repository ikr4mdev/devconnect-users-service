import { Module } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { ProfilesController } from './profiles.controller';
import { RabbitMqModule } from '../../infrastructure/rabbitmq/rabbitmq-connection.module';
import { UserRegisteredConsumer } from './user-registered.consumer';

@Module({
  imports: [PrismaModule, RabbitMqModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, UserRegisteredConsumer],
  exports: [ProfilesService],
})
export class ProfilesModule {}
