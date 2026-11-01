import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsumeMessage, Channel } from 'amqplib';
import { RabbitMqService } from '../../infrastructure/rabbitmq/rabbitmq-connection.service';
import { ProfilesService } from './profiles.service';
import { isValidUuid } from '@/core';

interface UserRegisteredEvent {
  userId: string;
  email: string;
  displayName: string;
}

@Injectable()
export class UserRegisteredConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserRegisteredConsumer.name);
  private readonly queue = 'devconnect.users.user-registered';
  private readonly routingKey = 'user.registered';
  private channel!: Channel;
  private consumerTag?: string;

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly profilesService: ProfilesService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.channel = this.rabbitMqService.getChannel();

    const exchange = this.configService.get<string>('RABBITMQ_EXCHANGE');

    if (!exchange) {
      throw new Error('RABBITMQ_EXCHANGE is not configured.');
    }

    await this.channel.assertExchange(exchange, 'topic', {
      durable: true,
    });

    await this.channel.assertQueue(this.queue, {
      durable: true,
    });

    await this.channel.bindQueue(this.queue, exchange, this.routingKey);

    await this.channel.prefetch(1);

    const result = await this.channel.consume(
      this.queue,
      (message) => {
        if (message) {
          void this.handleMessage(message);
        }
      },
      { noAck: false },
    );

    this.consumerTag = result.consumerTag;

    this.logger.log(`Listening for ${this.routingKey} events`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
    }
  }

  private async handleMessage(message: ConsumeMessage): Promise<void> {
    let event: UserRegisteredEvent;

    try {
      event = JSON.parse(message.content.toString()) as UserRegisteredEvent;

      if (typeof event !== 'object' || event === null || Array.isArray(event)) {
        this.logger.warn('Received invalid user.registered event');
        this.channel.nack(message, false, false);
        return;
      }
    } catch {
      this.logger.warn('Received malformed user.registered JSON');
      this.channel.nack(message, false, false);
      return;
    }

    if (
      typeof event.userId !== 'string' ||
      typeof event.displayName !== 'string' ||
      !event.userId.trim() ||
      !event.displayName.trim() ||
      !isValidUuid(event.userId)
    ) {
      this.logger.warn('Received invalid user.registered event');
      this.channel.nack(message, false, false);
      return;
    }

    try {
      await this.profilesService.createFromRegistration(
        event.userId,
        event.displayName,
      );

      this.channel.ack(message);
      this.logger.log(`Processed user.registered for ${event.userId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Failed to process user.registered event: ${errorMessage}`,
      );

      this.channel.nack(message, false, true);
    }
  }
}
