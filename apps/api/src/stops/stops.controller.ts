import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUserId, OptionalUserId } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';
import { StopsService } from './stops.service';
import { CreateStopDto } from './dto/create-stop.dto';
import { ListStopsQueryDto } from './dto/list-stops-query.dto';
import { NearbyStopsQueryDto } from './dto/nearby-stops-query.dto';

@Controller('stops')
export class StopsController {
  constructor(private readonly stopsService: StopsService) {}

  @Public()
  @Get()
  findAll(@Query() query: ListStopsQueryDto) {
    return this.stopsService.findAll(query);
  }

  // Must be declared before @Get(':id') so 'nearby' isn't matched as an id.
  @Public()
  @Get('nearby')
  findNearby(@Query() query: NearbyStopsQueryDto) {
    return this.stopsService.findNearby(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string, @OptionalUserId() userId?: string) {
    return this.stopsService.findOne(id, userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateStopDto) {
    return this.stopsService.create(userId, dto);
  }
}
