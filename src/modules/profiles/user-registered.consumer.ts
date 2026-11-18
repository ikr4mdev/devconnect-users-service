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
  private channel: Channel | null = null;
  private consumerTag?: string;
  private isStarting = false;
  private isConsuming = false;
  private isShuttingDown = false;

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly profilesService: ProfilesService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.rabbitMqService.on('disconnected', this.handleDisconnected);
    this.rabbitMqService.on('connected', this.handleConnected);

    if (this.rabbitMqService.isReady) {
      await this.startConsumer();
    }
  }

  private readonly handleDisconnected = (): void => {
    this.channel = null;
    this.consumerTag = undefined;
    this.isConsuming = false;
  };

  private readonly handleConnected = (): void => {
    void this.startConsumer();
  };

  private async startConsumer(): Promise<void> {
    if (this.isShuttingDown || this.isStarting || this.isConsuming) {
      return;
    }

    this.isStarting = true;

    try {
      const channel = this.rabbitMqService.getChannel();
      this.channel = channel;

      const exchange = this.configService.get<string>('RABBITMQ_EXCHANGE');

      if (!exchange) {
        throw new Error('RABBITMQ_EXCHANGE is not configured.');
      }

      await channel.assertExchange(exchange, 'topic', {
        durable: true,
      });

      await channel.assertQueue(this.queue, {
        durable: true,
      });

      await channel.bindQueue(this.queue, exchange, this.routingKey);

      await channel.prefetch(1);

      const result = await channel.consume(
        this.queue,
        (message) => {
          if (message) {
            this.handleMessage(message, channel).catch((error) => {
              this.logger.error(
                `Unhandled error while processing message (deliveryTag=${message.fields.deliveryTag})`,
                error instanceof Error ? error.stack : String(error),
              );
            });
          }
        },
        { noAck: false },
      );

      if (
        this.isShuttingDown ||
        !this.rabbitMqService.isReady ||
        this.rabbitMqService.getChannel() !== channel
      ) {
        try {
          await channel.cancel(result.consumerTag);
        } catch {
          this.logger.debug(
            'Could not cancel stale consumer; its channel may already be closed.',
          );
        }
        return;
      }

      this.consumerTag = result.consumerTag;

      this.isConsuming = true;

      this.logger.log(`Listening for ${this.routingKey} events`);
    } catch (error) {
      this.logger.error(
        'Failed to start user.registered consumer',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isStarting = false;

      try {
        if (
          !this.isShuttingDown &&
          this.rabbitMqService.isReady &&
          !this.isConsuming &&
          this.rabbitMqService.getChannel() !== this.channel
        ) {
          void this.startConsumer();
        }
      } catch (err) {
        this.logger.debug(
          'Skipped consumer restart: connection lost while checking channel',
          err,
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    this.rabbitMqService.off('disconnected', this.handleDisconnected);
    this.rabbitMqService.off('connected', this.handleConnected);

    if (this.consumerTag && this.channel) {
      try {
        await this.channel.cancel(this.consumerTag);
      } catch (error) {
        this.logger.warn(
          `Failed to cancel consumer during shutdown (consumerTag=${this.consumerTag})`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
  }

  private async handleMessage(
    message: ConsumeMessage,
    channel: Channel,
  ): Promise<void> {
    let event: UserRegisteredEvent;

    try {
      event = JSON.parse(message.content.toString()) as UserRegisteredEvent;

      if (typeof event !== 'object' || event === null || Array.isArray(event)) {
        this.logger.warn('Received invalid user.registered event');
        channel.nack(message, false, false);
        return;
      }
    } catch {
      this.logger.warn('Received malformed user.registered JSON');
      channel.nack(message, false, false);
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
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.profilesService.createFromRegistration(
        event.userId,
        event.displayName,
      );

      channel.ack(message);
      this.logger.log(`Processed user.registered for ${event.userId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Failed to process user.registered event: ${errorMessage}`,
      );

      channel.nack(message, false, true);
    }
  }
}
