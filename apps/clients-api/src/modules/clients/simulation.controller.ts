import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import { ApiKeyGuard, API_KEY_HEADER } from '../auth/guards/api-key.guard';
import { ClientsService } from './clients.service';
import {
  SeedSimulationDto,
  SummaryQueryDto,
  TriggerActivityTickDto,
} from './dto/simulation.dto';
import { swaggerDefinitions } from './swagger/clients-swagger';

/** Service info, reference data, and the controls that drive the simulation. */
@ApiTags('Simulation')
@ApiSecurity(API_KEY_HEADER)
@Controller({ version: '1' })
@UseGuards(ApiKeyGuard)
export class SimulationController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation(swaggerDefinitions.homeOperation)
  @ApiResponse(swaggerDefinitions.homeResponse)
  getHome(): string {
    return this.clientsService.home();
  }

  @Get('/reference')
  @ApiOperation(swaggerDefinitions.referenceOperation)
  @ApiOkResponse(swaggerDefinitions.referenceSuccess)
  getReference() {
    return this.clientsService.reference();
  }

  @Get('/simulation/status')
  @ApiOperation(swaggerDefinitions.statusOperation)
  @ApiOkResponse(swaggerDefinitions.statusSuccess)
  getSimulationStatus() {
    return this.clientsService.getSimulationStatus();
  }

  @Post('/simulation/seed')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation(swaggerDefinitions.seedOperation)
  @ApiBody({
    type: SeedSimulationDto,
    examples: swaggerDefinitions.seedExamples,
  })
  @ApiCreatedResponse(swaggerDefinitions.seedSuccess)
  seed(@Body() body: SeedSimulationDto) {
    return this.clientsService.seed(body);
  }

  @Post('/simulation/tick')
  @HttpCode(HttpStatus.OK)
  @ApiOperation(swaggerDefinitions.triggerTickOperation)
  @ApiBody({
    type: TriggerActivityTickDto,
    examples: swaggerDefinitions.triggerTickExamples,
    required: false,
  })
  @ApiOkResponse(swaggerDefinitions.triggerTickSuccess)
  triggerTick(@Body() body: TriggerActivityTickDto) {
    return this.clientsService.triggerTick(body ?? {});
  }

  @Get('/summary')
  @ApiOperation(swaggerDefinitions.summaryOperation)
  @ApiQuery(swaggerDefinitions.countryQueryParam)
  @ApiOkResponse(swaggerDefinitions.summarySuccess)
  getSummary(@Query() query: SummaryQueryDto) {
    return this.clientsService.getPortfolioSummary(query.country);
  }
}
