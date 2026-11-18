import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { Pool } from 'pg';
import { PrismaClient } from '../../generated/prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const url = configService.get<string>('DATABASE_URL');

    if (!url) {
      throw new Error('DATABASE_URL must be configured.');
    }

    const pool = new Pool({
      connectionString: url,
    });

    const adapter = new PrismaPg(pool);

    super({ adapter });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
