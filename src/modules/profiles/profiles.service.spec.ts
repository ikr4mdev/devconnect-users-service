import { Test, TestingModule } from '@nestjs/testing';
import { ProfilesService } from './profiles.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('ProfilesService', () => {
  let service: ProfilesService;
  let findUnique: jest.Mock;
  let upsert: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();
    upsert = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        {
          provide: PrismaService,
          useValue: {
            userProfile: {
              findUnique,
              upsert,
            },
          },
        },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  it('should return the user profile when found by userId', async () => {
    const userId = 'a3f1c2d4-5e6b-4a7c-8d9e-0f1a2b3c4d5e';
    const now = new Date();

    const profile = {
      id: 'b4e2d3c5-6f7a-4b8d-9e0f-1a2b3c4d5e6f',
      userId,
      displayName: 'test-user',
      bio: null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    findUnique.mockResolvedValueOnce(profile);

    const result = await service.findByUserId(userId);

    expect(result).toMatchObject(profile);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId },
    });
  });

  it('should return null when user not found', async () => {
    const userId = 'a3f1c2d4-5e6b-4a7c-8d9e-0f1a2b3c4d5e';

    findUnique.mockResolvedValueOnce(null);

    await expect(service.findByUserId(userId)).resolves.toBeNull();

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId },
    });
  });

  it('should propagate database errors when profile creation fails', async () => {
    const databaseError = new Error('Database connection failed');

    upsert.mockRejectedValueOnce(databaseError);

    await expect(
      service.createFromRegistration(
        'a3f1c2d4-5e6b-4a7c-8d9e-0f1a2b3c4d5e',
        'test-name',
      ),
    ).rejects.toThrow('Database connection failed');

    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('should create user profile successfully', async () => {
    const now = new Date();
    const data = {
      id: 'c5f3e4d6-7a8b-4c9e-0f1a-2b3c4d5e6f7a',
      userId: 'a3f1c2d4-5e6b-4a7c-8d9e-0f1a2b3c4d5e',
      displayName: 'test-name',
      bio: null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    const request = {
      userId: data.userId,
      displayName: data.displayName,
    };

    upsert.mockResolvedValueOnce(data);

    const result = await service.createFromRegistration(
      request.userId,
      request.displayName,
    );

    expect(result).toMatchObject(data);

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({
      where: { userId: request.userId },
      update: {},
      create: { userId: request.userId, displayName: request.displayName },
    });
  });

  it('should preserve the existing display name when the profile already exists', async () => {
    const now = new Date();

    const existingProfile = {
      id: 'b4e2d3c5-6f7a-4b8d-9e0f-1a2b3c4d5e6f',
      userId: 'a3f1c2d4-5e6b-4a7c-8d9e-0f1a2b3c4d5e',
      displayName: 'original-name',
      bio: null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };

    const incomingDisplayName = 'different-name';

    upsert.mockResolvedValueOnce(existingProfile);

    const result = await service.createFromRegistration(
      existingProfile.userId,
      incomingDisplayName,
    );

    expect(result.displayName).toBe('original-name');
    expect(result).toMatchObject(existingProfile);

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith({
      where: { userId: existingProfile.userId },
      update: {},
      create: {
        userId: existingProfile.userId,
        displayName: incomingDisplayName,
      },
    });
  });
});
