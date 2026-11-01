import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { ConfigModule } from '@nestjs/config';
import { RabbitMqModule } from './infrastructure/rabbitmq/rabbitmq-connection.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ProfilesModule],
})
export class AppModule {}
