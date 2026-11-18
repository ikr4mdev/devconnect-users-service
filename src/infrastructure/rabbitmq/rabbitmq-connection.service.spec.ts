import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import { RabbitMqService } from './rabbitmq-connection.service';

jest.mock('amqplib');

describe('RabbitMqService', () => {
  let service: RabbitMqService;
  let module: TestingModule;
  let mockChannel: any;
  let mockConnection: any;
  let mockConfigService: any;

  const connectedListener = jest.fn();

  beforeEach(async () => {
    mockChannel = {
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };

    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };

    (amqplib.connect as jest.Mock).mockResolvedValue(mockConnection);

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'RABBITMQ_URL') return 'amqp://guest:guest@localhost:5672';
        return null;
      }),
    };

    module = await Test.createTestingModule({
      providers: [
        RabbitMqService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RabbitMqService>(RabbitMqService);
  });

  afterEach(async () => {
    await module.close();
    jest.useRealTimers();
    connectedListener.mockClear();
    jest.clearAllMocks();
  });

  it('should connect to RabbitMQ successfully', async () => {
    service.on('connected', connectedListener);

    await service.onModuleInit();

    expect(amqplib.connect).toHaveBeenCalledTimes(1);
    expect(amqplib.connect).toHaveBeenCalledWith(
      'amqp://guest:guest@localhost:5672',
    );

    expect(mockConnection.createChannel).toHaveBeenCalledTimes(1);

    expect(connectedListener).toHaveBeenCalledTimes(1);

    expect(service.isReady).toBe(true);
  });

  it('should throw when RabbitMQ URL is missing', async () => {
    mockConfigService.get.mockReturnValue(null);

    await expect(service.onModuleInit()).rejects.toThrow(
      'RABBITMQ_URL is not configured.',
    );

    expect(amqplib.connect).not.toHaveBeenCalled();
  });

  it('should log the failure and retry after 5 seconds when the first connect fails', async () => {
    jest.useFakeTimers();

    const connectError = new Error('ECONNREFUSED');
    (amqplib.connect as jest.Mock)
      .mockRejectedValueOnce(connectError)
      .mockResolvedValueOnce(mockConnection);

    const loggerSpy = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation();

    await service.onModuleInit();

    expect(amqplib.connect).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED'),
      expect.anything(),
    );

    expect(amqplib.connect).toHaveBeenCalledTimes(1);

    expect(service.isReady).toBe(false);

    await jest.advanceTimersByTimeAsync(5000);

    expect(amqplib.connect).toHaveBeenCalledTimes(2);
    expect(amqplib.connect).toHaveBeenNthCalledWith(
      2,
      'amqp://guest:guest@localhost:5672',
    );

    expect(service.isReady).toBe(true);

    loggerSpy.mockRestore();
  });

  it('should handle connection close, mark not ready, emit disconnected, and reconnect after 5 seconds', async () => {
    jest.useFakeTimers();

    await service.onModuleInit();
    expect(amqplib.connect).toHaveBeenCalledTimes(1);

    const disconnectedListener = jest.fn();
    service.on('disconnected', disconnectedListener);

    const closeHandler = mockConnection.on.mock.calls.find(
      ([event]) => event === 'close',
    )?.[1];

    expect(closeHandler).toBeDefined();

    closeHandler();

    await Promise.resolve();

    expect(service.isReady).toBe(false);

    expect(disconnectedListener).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5000);

    expect(service.isReady).toBe(true);
    expect(mockConnection.createChannel).toHaveBeenCalledTimes(2);

    expect(amqplib.connect).toHaveBeenCalledTimes(2);
  });

  it('should handle channel close, mark not ready, emit disconnected, and reconnect after 5 seconds', async () => {
    jest.useFakeTimers();

    await service.onModuleInit();
    expect(service.isReady).toBe(true);

    const disconnectedListener = jest.fn();
    service.on('disconnected', disconnectedListener);

    const closeHandler = mockChannel.on.mock.calls.find(
      ([event]) => event === 'close',
    )?.[1];

    expect(closeHandler).toBeDefined();

    closeHandler();

    await Promise.resolve();

    expect(service.isReady).toBe(false);
    expect(disconnectedListener).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5000);

    expect(amqplib.connect).toHaveBeenCalledTimes(2);
    expect(service.isReady).toBe(true);
  });

  it('should close the channel and connection on destroy and not reconnect', async () => {
    jest.useFakeTimers();

    await service.onModuleInit();
    expect(amqplib.connect).toHaveBeenCalledTimes(1);
    expect(service.isReady).toBe(true);

    await service.onModuleDestroy();

    await Promise.resolve();

    expect(mockChannel.close).toHaveBeenCalledTimes(1);

    expect(mockConnection.close).toHaveBeenCalledTimes(1);

    expect(service.isReady).toBe(false);

    await jest.advanceTimersByTimeAsync(5000);

    expect(amqplib.connect).toHaveBeenCalledTimes(1);
  });

  it('should ignore a delayed close event from the old connection after reconnect', async () => {
    jest.useFakeTimers();

    await service.onModuleInit();
    expect(amqplib.connect).toHaveBeenCalledTimes(1);
    expect(service.isReady).toBe(true);

    const oldCloseHandler = mockConnection.on.mock.calls.find(
      ([event]) => event === 'close',
    )?.[1];
    expect(oldCloseHandler).toBeDefined();

    const disconnectedListener = jest.fn();
    service.on('disconnected', disconnectedListener);

    oldCloseHandler();
    await Promise.resolve();

    expect(service.isReady).toBe(false);
    expect(disconnectedListener).toHaveBeenCalledTimes(1);

    const secondChannel = {
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };
    const secondConnection = {
      createChannel: jest.fn().mockResolvedValue(secondChannel),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };
    (amqplib.connect as jest.Mock).mockResolvedValueOnce(secondConnection);

    await jest.advanceTimersByTimeAsync(5000);

    expect(amqplib.connect).toHaveBeenCalledTimes(2);
    expect(service.isReady).toBe(true);

    const newCloseHandler = secondConnection.on.mock.calls.find(
      ([event]) => event === 'close',
    )?.[1];
    expect(newCloseHandler).toBeDefined();
    expect(newCloseHandler).not.toBe(oldCloseHandler);

    oldCloseHandler();
    await Promise.resolve();

    expect(service.isReady).toBe(true);
    expect(disconnectedListener).toHaveBeenCalledTimes(1);
  });
});
