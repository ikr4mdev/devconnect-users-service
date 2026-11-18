import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { ProfilesService } from './profiles.service';
import { UsersV1 } from '@ikr4mdev/devconnect-contracts';
import { status } from '@grpc/grpc-js';
import { isValidUuid } from '@/core';

interface GrpcTimestamp {
  seconds: number;
  nanos: number;
}

interface GetProfileByIdGrpcResponse {
  id: string;
  userId: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: GrpcTimestamp;
  updatedAt: GrpcTimestamp;
}

@Controller()
export class ProfilesController {
  constructor(private readonly profileService: ProfilesService) {}

  @GrpcMethod('UsersService', 'GetProfileByUserId')
  async getProfile(
    data: UsersV1.GetProfileByIdRequest,
  ): Promise<GetProfileByIdGrpcResponse> {
    if (!isValidUuid(data.userId)) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        details: 'userId must be a valid UUID.',
      });
    }

    const user = await this.profileService.findByUserId(data.userId);

    if (!user) {
      throw new RpcException({
        code: status.NOT_FOUND,
        details: "We couldn't find a profile for this user.",
      });
    }

    return {
      id: user.id,
      userId: user.userId,
      displayName: user.displayName,
      bio: user.bio ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      createdAt: {
        seconds: Math.floor(user.createdAt.getTime() / 1000),
        nanos: (user.createdAt.getTime() % 1000) * 1_000_000,
      },
      updatedAt: {
        seconds: Math.floor(user.updatedAt.getTime() / 1000),
        nanos: (user.updatedAt.getTime() % 1000) * 1_000_000,
      },
    };
  }
}
