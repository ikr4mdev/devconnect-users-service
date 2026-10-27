import { Test, TestingModule } from '@nestjs/testing';
import { ProfilesService } from './profiles.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('ProfilesService', () => {
  let service: ProfilesService;
  let findUnique: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        {
          provide: PrismaService,
          useValue: {
            userProfile: {
              findUnique,
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
});
