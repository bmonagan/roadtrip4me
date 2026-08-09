import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator';
import { TripsService } from './trips.service';
import { AddStopDto } from './dto/add-stop.dto';
import { AddWaypointDto } from './dto/add-waypoint.dto';
import { CreateTripDto } from './dto/create-trip.dto';
import { ListTripsQueryDto } from './dto/list-trips-query.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateTripDto) {
    return this.tripsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUserId() userId: string, @Query() query: ListTripsQueryDto) {
    return this.tripsService.findAll(userId, query);
  }

  @Get(':id')
  findOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.tripsService.findOne(userId, id);
  }

  @Patch(':id')
  update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: UpdateTripDto) {
    return this.tripsService.update(userId, id, dto);
  }

  @Post(':id/stops')
  addStop(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: AddStopDto) {
    return this.tripsService.addStop(userId, id, dto.stopId);
  }

  @Delete(':id/stops/:stopId')
  removeStop(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('stopId') stopId: string,
  ) {
    return this.tripsService.removeStop(userId, id, stopId);
  }

  @Post(':id/waypoints')
  addWaypoint(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: AddWaypointDto,
  ) {
    return this.tripsService.addWaypoint(userId, id, dto);
  }

  @Delete(':id/waypoints/:waypointId')
  removeWaypoint(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('waypointId') waypointId: string,
  ) {
    return this.tripsService.removeWaypoint(userId, id, waypointId);
  }

  @Delete(':id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.tripsService.remove(userId, id);
  }
}
