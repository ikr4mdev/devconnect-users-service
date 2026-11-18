import { Module } from '@nestjs/common';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ProfilesModule],
})
export class AppModule {}
