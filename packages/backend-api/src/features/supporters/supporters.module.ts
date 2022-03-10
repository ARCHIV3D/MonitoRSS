import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PatronFeature } from './entities/patron.entity';
import { SupporterFeature } from './entities/supporter.entity';
import { PatronsService } from './patrons.service';
import { SupportersService } from './supporters.service';

@Module({
  providers: [SupportersService, PatronsService],
  imports: [MongooseModule.forFeature([SupporterFeature, PatronFeature])],
  exports: [SupportersService],
})
export class SupportersModule {}
