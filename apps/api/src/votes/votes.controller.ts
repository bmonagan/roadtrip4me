import { Body, Controller, Delete, Param, Put } from '@nestjs/common';
import { CurrentUserId } from '../auth/current-user.decorator';
import { VotesService } from './votes.service';
import { CastVoteDto } from './dto/cast-vote.dto';

@Controller('votes')
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Put(':stopId')
  cast(@CurrentUserId() userId: string, @Param('stopId') stopId: string, @Body() dto: CastVoteDto) {
    return this.votesService.cast(userId, stopId, dto.value);
  }

  @Delete(':stopId')
  remove(@CurrentUserId() userId: string, @Param('stopId') stopId: string) {
    return this.votesService.remove(userId, stopId);
  }
}
