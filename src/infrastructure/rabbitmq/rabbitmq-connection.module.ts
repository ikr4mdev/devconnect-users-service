import { Module } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq-connection.service';

@Module({
  providers: [RabbitMqService],
  exports: [RabbitMqService],
})
export class RabbitMqModule {}
