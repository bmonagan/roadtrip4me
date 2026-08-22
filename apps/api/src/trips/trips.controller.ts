import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, CurrentUserId } from '../auth/current-user.decorator';
import { PremiumGuard } from '../auth/premium.guard';
import { TripsService } from './trips.service';
import { AddStopDto } from './dto/add-stop.dto';
import { AddWaypointDto } from './dto/add-waypoint.dto';
import { AddCollaboratorDto } from './dto/add-collaborator.dto';
import { CreateTripDto } from './dto/create-trip.dto';
import { ListTripsQueryDto } from './dto/list-trips-query.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import type { User as UserModel } from '../generated/prisma/client';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  create(@CurrentUser() user: UserModel, @Body() dto: CreateTripDto) {
    return this.tripsService.create(user.id, dto, user.isPremium);
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
  update(@CurrentUser() user: UserModel, @Param('id') id: string, @Body() dto: UpdateTripDto) {
    return this.tripsService.update(user.id, id, dto, user.isPremium);
  }

  @Post(':id/stops')
  addStop(@CurrentUser() user: UserModel, @Param('id') id: string, @Body() dto: AddStopDto) {
    return this.tripsService.addStop(user.id, id, dto.stopId, user.isPremium);
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

  @UseGuards(PremiumGuard)
  @Post(':id/collaborators')
  addCollaborator(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: AddCollaboratorDto,
  ) {
    return this.tripsService.addCollaborator(userId, id, dto);
  }

  @Delete(':id/collaborators/:collaboratorUserId')
  removeCollaborator(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('collaboratorUserId') collaboratorUserId: string,
  ) {
    return this.tripsService.removeCollaborator(userId, id, collaboratorUserId);
  }

  @Delete(':id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.tripsService.remove(userId, id);
  }
}
