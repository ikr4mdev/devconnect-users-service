import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { join } from 'node:path';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'users.v1',
        protoPath: join(
          process.cwd(),
          'node_modules/@devconnect-microservices/devconnect-contracts/proto/users/v1/users.proto',
        ),
        url: process.env.GRPC_URL ?? '0.0.0.0:5002',
        loader: {
          keepCase: false,
        },
      },
    },
  );

  await app.listen();
}
void bootstrap();
