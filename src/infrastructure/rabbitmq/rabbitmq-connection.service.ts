import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { EventEmitter } from 'node:events';

@Injectable()
export class RabbitMqService
  extends EventEmitter
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMqService.name);

  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private url: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isShuttingDown = false;

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const url = this.configService.get<string>('RABBITMQ_URL');

    if (!url) {
      throw new Error(
        'RABBITMQ_URL is not configured. Set it in your environment or .env file.',
      );
    }

    this.url = url;

    await this.connect();
  }

  private async connect(): Promise<boolean> {
    if (this.isShuttingDown || this.isConnecting) {
      return false;
    }

    this.isConnecting = true;

    let connection: amqp.ChannelModel | undefined;
    let channel: amqp.Channel | undefined;

    try {
      if (!this.url) {
        throw new Error('RabbitMQ URL is not configured.');
      }

      connection = await amqp.connect(this.url);
      channel = await connection.createChannel();

      if (this.isShuttingDown) {
        this.logger.warn(
          'RabbitMQ connection attempt completed during shutdown, closing new resources.',
        );
        try {
          await channel.close();
        } catch (error) {
          this.logger.warn(
            `Failed to close channel during shutdown race: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        try {
          await connection.close();
        } catch (error) {
          this.logger.warn(
            `Failed to close connection during shutdown race: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        return false;
      }

      this.connection = connection;
      this.channel = channel;

      connection.on('close', () => {
        this.handleDisconnect(connection, channel);
      });

      connection.on('error', (error) => {
        this.logger.error(`RabbitMQ connection error: ${error.message}`);
      });

      channel.on('close', () => {
        this.handleDisconnect(connection, channel);
      });

      channel.on('error', (error) => {
        this.logger.error(`RabbitMQ channel error: ${error.message}`);
      });

      this.cancelReconnect();

      this.emit('connected');

      this.logger.log('Connected to RabbitMQ, channel ready');

      return true;
    } catch (error) {
      const details =
        error instanceof Error
          ? `${error.name}: ${error.message || 'Empty error message'}`
          : String(error);

      this.logger.error(
        `Failed to connect to RabbitMQ: ${details}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (channel) {
        try {
          await channel.close();
        } catch (channelError) {
          this.logger.warn(
            `Failed to close RabbitMQ channel during cleanup: ${
              channelError instanceof Error
                ? channelError.message
                : String(channelError)
            }`,
          );
        }
      }

      if (connection) {
        try {
          await connection.close();
        } catch (connectionError) {
          this.logger.warn(
            `Failed to close RabbitMQ connection during cleanup: ${
              connectionError instanceof Error
                ? connectionError.message
                : String(connectionError)
            }`,
          );
        }
      }

      if (this.channel === channel) {
        this.channel = null;
      }

      if (this.connection === connection) {
        this.connection = null;
      }

      this.scheduleReconnect();

      return false;
    } finally {
      this.isConnecting = false;
    }
  }

  private handleDisconnect(
    connection: amqp.ChannelModel | undefined,
    channel: amqp.Channel | undefined,
  ): void {
    if (this.isShuttingDown) {
      return;
    }

    const connectionIsActive = this.connection === connection;
    const channelIsActive = this.channel === channel;

    if (!connectionIsActive || !channelIsActive) {
      return;
    }

    this.connection = null;
    this.channel = null;

    if (connection) {
      void connection.close().catch((error) => {
        this.logger.warn(
          `Failed to close old RabbitMQ connection after disconnect: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }

    this.emit('disconnected');

    this.logger.warn('RabbitMQ disconnected.');

    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect()
        .then((started) => {
          if (!started && !this.isShuttingDown) {
            this.scheduleReconnect();
          }
        })
        .catch((error) => {
          this.logger.error('Unexpected error in reconnect loop', error);
          if (!this.isShuttingDown) {
            this.scheduleReconnect();
          }
        });
    }, 5000);
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;

    this.cancelReconnect();

    try {
      if (this.channel) {
        await this.channel.close();
      }
    } catch (error) {
      this.logger.warn(
        `Error closing RabbitMQ channel (may already be closed): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    try {
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      this.logger.warn(
        `Error closing RabbitMQ connection (may already be closed): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    this.channel = null;
    this.connection = null;
  }

  getConnection(): amqp.ChannelModel {
    if (!this.connection) {
      throw new Error('RabbitMQ connection is not available.');
    }

    return this.connection;
  }

  getChannel(): amqp.Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available.');
    }

    return this.channel;
  }

  get isReady(): boolean {
    return !!(this.connection && this.channel);
  }
}
