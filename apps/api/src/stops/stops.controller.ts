import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { OptionalUserId } from '../common/decorators/optional-user-id.decorator';
import { StopsService } from './stops.service';
import { CreateStopDto } from './dto/create-stop.dto';
import { ListStopsQueryDto } from './dto/list-stops-query.dto';
import { NearbyStopsQueryDto } from './dto/nearby-stops-query.dto';

@Controller('stops')
export class StopsController {
  constructor(private readonly stopsService: StopsService) {}

  @Get()
  findAll(@Query() query: ListStopsQueryDto) {
    return this.stopsService.findAll(query);
  }

  // Must be declared before @Get(':id') so 'nearby' isn't matched as an id.
  @Get('nearby')
  findNearby(@Query() query: NearbyStopsQueryDto) {
    return this.stopsService.findNearby(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @OptionalUserId() userId?: string) {
    return this.stopsService.findOne(id, userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateStopDto) {
    return this.stopsService.create(userId, dto);
  }
}
