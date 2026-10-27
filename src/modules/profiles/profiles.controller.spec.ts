import { Test, TestingModule } from '@nestjs/testing';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { UsersV1 } from '@devconnect-microservices/devconnect-contracts';

describe('ProfilesController', () => {
  let controller: ProfilesController;
  let findByUserId: jest.Mock;
  let module: TestingModule;

  beforeEach(async () => {
    findByUserId = jest.fn();

    module = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [
        {
          provide: ProfilesService,
          useValue: { findByUserId },
        },
      ],
    }).compile();

    controller = module.get<ProfilesController>(ProfilesController);
  });

  it('should return user profile', async () => {
    const now = new Date();
    const dateObj = {
      seconds: Math.floor(now.getTime() / 1000),
      nanos: (now.getTime() % 1000) * 1_000_000,
    };

    const data = {
      userId: 'af58fbcd-e98b-43f8-8172-4c2d3f8f5823',
    };

    const profile = {
      id: 'test-id-1',
      userId: data.userId,
      displayName: 'test-display-name',
      bio: null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    findByUserId.mockResolvedValueOnce(profile);

    const result = await controller.getProfile(data);
    expect(result).toEqual({
      ...profile,
      bio: undefined,
      avatarUrl: undefined,
      createdAt: dateObj,
      updatedAt: dateObj,
    });

    expect(findByUserId).toHaveBeenCalledTimes(1);
    expect(findByUserId).toHaveBeenCalledWith(data.userId);
  });

  it('should throw an RpcException with NOT_FOUND when the user is not found', async () => {
    findByUserId.mockResolvedValueOnce(null);

    const data = { userId: '00000000-0000-4000-8000-000000000001' };
    let error: unknown;
    try {
      await controller.getProfile(data);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(RpcException);

    expect((error as RpcException).getError()).toEqual({
      code: status.NOT_FOUND,
      details: "We couldn't find a profile for this user.",
    });

    expect(findByUserId).toHaveBeenCalledTimes(1);
    expect(findByUserId).toHaveBeenCalledWith(data.userId);
  });

  it('should reject an invalid UUID before calling the service', async () => {
    const data = { userId: 'not-a-uuid' };

    let error: unknown;
    try {
      await controller.getProfile(data);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(RpcException);

    expect((error as RpcException).getError()).toEqual({
      code: status.INVALID_ARGUMENT,
      details: 'userId must be a valid UUID.',
    });

    expect(findByUserId).not.toHaveBeenCalled();
  });

  it('should throw an RpcException with INVALID_ARGUMENT for an empty userId, before reaching Prisma', async () => {
    const data = { userId: '' };

    let error: unknown;
    try {
      await controller.getProfile(data);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(RpcException);

    expect((error as RpcException).getError()).toEqual({
      code: status.INVALID_ARGUMENT,
      details: 'userId must be a valid UUID.',
    });

    expect(findByUserId).not.toHaveBeenCalled();
  });

  it('should reject a boolean userId before calling the service', async () => {
    const data = { userId: true } as unknown as UsersV1.GetProfileByIdRequest;

    let error: unknown;
    try {
      await controller.getProfile(data);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(RpcException);

    expect((error as RpcException).getError()).toEqual({
      code: status.INVALID_ARGUMENT,
      details: 'userId must be a valid UUID.',
    });

    expect(findByUserId).not.toHaveBeenCalled();
  });
});
