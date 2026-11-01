import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { UserProfile } from '../../generated/prisma/client';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    return this.prisma.userProfile.findUnique({
      where: { userId },
    });
  }

  async createFromRegistration(
    userId: string,
    displayName: string,
  ): Promise<UserProfile> {
    // If the profile doesn't exist, create it.
    // If it already exists, leave it unchanged.
    return this.prisma.userProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, displayName },
    });
  }
}
