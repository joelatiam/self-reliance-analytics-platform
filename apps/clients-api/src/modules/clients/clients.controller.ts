import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';

import { ApiKeyGuard, API_KEY_HEADER } from '../auth/guards/api-key.guard';
import { ClientsService } from './clients.service';
import {
  AdvisorySessionsQueryDto,
  BusinessMetricsQueryDto,
  CreateAdvisorySessionDto,
} from './dto/advisory-session.dto';
import {
  BusinessCodeParamDto,
  BusinessesQueryDto,
  CreateBusinessDto,
} from './dto/business.dto';
import {
  ClientCodeParamDto,
  ClientsQueryDto,
  CreateClientDto,
} from './dto/client.dto';
import {
  CreateLoanDto,
  LoanCodeParamDto,
  LoansQueryDto,
  RepaymentsQueryDto,
} from './dto/loan.dto';
import {
  SeedSimulationDto,
  SummaryQueryDto,
  TriggerActivityTickDto,
} from './dto/simulation.dto';
import { swaggerDefinitions } from './swagger/clients-swagger';

@ApiTags('Service')
@ApiSecurity(API_KEY_HEADER)
@Controller({ version: '1' })
@UseGuards(ApiKeyGuard)
export class ClientsController {
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

  @ApiTags('Clients')
  @Get('/clients')
  @ApiOperation(swaggerDefinitions.listClientsOperation)
  @ApiQuery(swaggerDefinitions.countryQueryParam)
  @ApiQuery(swaggerDefinitions.updatedSinceQueryParam)
  @ApiQuery(swaggerDefinitions.pageQueryParam)
  @ApiQuery(swaggerDefinitions.limitQueryParam)
  @ApiOkResponse(swaggerDefinitions.listClientsSuccess)
  listClients(@Query() query: ClientsQueryDto) {
    return this.clientsService.listClients(query);
  }

  @ApiTags('Clients')
  @Get('/clients/:clientCode')
  @ApiOperation(swaggerDefinitions.getClientOperation)
  @ApiParam(swaggerDefinitions.clientCodeParam)
  @ApiOkResponse(swaggerDefinitions.getClientSuccess)
  @ApiNotFoundResponse(swaggerDefinitions.clientNotFound)
  getClient(@Param() params: ClientCodeParamDto) {
    return this.clientsService.getClient(params.clientCode);
  }

  @ApiTags('Clients')
  @Post('/clients')
  @ApiOperation(swaggerDefinitions.createClientOperation)
  @ApiBody({
    type: CreateClientDto,
    examples: swaggerDefinitions.createClientExamples,
  })
  @ApiCreatedResponse(swaggerDefinitions.createClientSuccess)
  @ApiBadRequestResponse(swaggerDefinitions.createClientBadRequest)
  createClient(@Body() body: CreateClientDto) {
    return this.clientsService.createClient(body);
  }

  @ApiTags('Businesses')
  @Get('/businesses')
  @ApiOperation(swaggerDefinitions.listBusinessesOperation)
  @ApiQuery(swaggerDefinitions.countryQueryParam)
  @ApiQuery(swaggerDefinitions.sectorQueryParam)
  @ApiQuery(swaggerDefinitions.updatedSinceQueryParam)
  @ApiOkResponse(swaggerDefinitions.listBusinessesSuccess)
  listBusinesses(@Query() query: BusinessesQueryDto) {
    return this.clientsService.listBusinesses(query);
  }

  @ApiTags('Businesses')
  @Get('/businesses/:businessCode')
  @ApiOperation(swaggerDefinitions.getBusinessOperation)
  @ApiParam(swaggerDefinitions.businessCodeParam)
  @ApiOkResponse(swaggerDefinitions.getBusinessSuccess)
  @ApiNotFoundResponse(swaggerDefinitions.businessNotFound)
  getBusiness(@Param() params: BusinessCodeParamDto) {
    return this.clientsService.getBusiness(params.businessCode);
  }

  @ApiTags('Businesses')
  @Post('/businesses')
  @ApiOperation(swaggerDefinitions.createBusinessOperation)
  @ApiBody({
    type: CreateBusinessDto,
    examples: swaggerDefinitions.createBusinessExamples,
  })
  @ApiCreatedResponse(swaggerDefinitions.getBusinessSuccess)
  @ApiNotFoundResponse(swaggerDefinitions.clientNotFound)
  createBusiness(@Body() body: CreateBusinessDto) {
    return this.clientsService.createBusiness(body);
  }

  @ApiTags('Businesses')
  @Get('/business-metrics')
  @ApiOperation(swaggerDefinitions.listBusinessMetricsOperation)
  @ApiQuery(swaggerDefinitions.countryQueryParam)
  @ApiQuery(swaggerDefinitions.periodQueryParam)
  @ApiQuery(swaggerDefinitions.updatedSinceQueryParam)
  @ApiOkResponse(swaggerDefinitions.listBusinessMetricsSuccess)
  listBusinessMetrics(@Query() query: BusinessMetricsQueryDto) {
    return this.clientsService.listBusinessMetrics(query);
  }

  @ApiTags('Loans')
  @Get('/loans')
  @ApiOperation(swaggerDefinitions.listLoansOperation)
  @ApiQuery(swaggerDefinitions.countryQueryParam)
  @ApiQuery(swaggerDefinitions.loanStatusQueryParam)
  @ApiQuery(swaggerDefinitions.updatedSinceQueryParam)
  @ApiOkResponse(swaggerDefinitions.listLoansSuccess)
  listLoans(@Query() query: LoansQueryDto) {
    return this.clientsService.listLoans(query);
  }

  @ApiTags('Loans')
  @Get('/loans/:loanCode')
  @ApiOperation(swaggerDefinitions.getLoanOperation)
  @ApiParam(swaggerDefinitions.loanCodeParam)
  @ApiOkResponse(swaggerDefinitions.getLoanSuccess)
  @ApiNotFoundResponse(swaggerDefinitions.loanNotFound)
  getLoan(@Param() params: LoanCodeParamDto) {
    return this.clientsService.getLoan(params.loanCode);
  }

  @ApiTags('Loans')
  @Post('/loans')
  @ApiOperation(swaggerDefinitions.createLoanOperation)
  @ApiBody({
    type: CreateLoanDto,
    examples: swaggerDefinitions.createLoanExamples,
  })
  @ApiCreatedResponse(swaggerDefinitions.createLoanSuccess)
  @ApiNotFoundResponse(swaggerDefinitions.businessNotFound)
  createLoan(@Body() body: CreateLoanDto) {
    return this.clientsService.createLoan(body);
  }

  @ApiTags('Loans')
  @Get('/loan-repayments')
  @ApiOperation(swaggerDefinitions.listRepaymentsOperation)
  @ApiQuery(swaggerDefinitions.countryQueryParam)
  @ApiQuery(swaggerDefinitions.updatedSinceQueryParam)
  @ApiOkResponse(swaggerDefinitions.listRepaymentsSuccess)
  listRepayments(@Query() query: RepaymentsQueryDto) {
    return this.clientsService.listRepayments(query);
  }

  @ApiTags('Advisory')
  @Get('/advisory-sessions')
  @ApiOperation(swaggerDefinitions.listAdvisorySessionsOperation)
  @ApiQuery(swaggerDefinitions.countryQueryParam)
  @ApiQuery(swaggerDefinitions.updatedSinceQueryParam)
  @ApiOkResponse(swaggerDefinitions.listAdvisorySessionsSuccess)
  listAdvisorySessions(@Query() query: AdvisorySessionsQueryDto) {
    return this.clientsService.listAdvisorySessions(query);
  }

  @ApiTags('Advisory')
  @Post('/advisory-sessions')
  @ApiOperation(swaggerDefinitions.createAdvisorySessionOperation)
  @ApiCreatedResponse(swaggerDefinitions.createAdvisorySessionSuccess)
  @ApiNotFoundResponse(swaggerDefinitions.clientNotFound)
  createAdvisorySession(@Body() body: CreateAdvisorySessionDto) {
    return this.clientsService.createAdvisorySession(body);
  }

  @ApiTags('Simulation')
  @Get('/simulation/status')
  @ApiOperation(swaggerDefinitions.statusOperation)
  @ApiOkResponse(swaggerDefinitions.statusSuccess)
  getSimulationStatus() {
    return this.clientsService.getSimulationStatus();
  }

  @ApiTags('Simulation')
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

  @ApiTags('Simulation')
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

  @ApiTags('Simulation')
  @Get('/summary')
  @ApiOperation(swaggerDefinitions.summaryOperation)
  @ApiQuery(swaggerDefinitions.countryQueryParam)
  @ApiOkResponse(swaggerDefinitions.summarySuccess)
  getSummary(@Query() query: SummaryQueryDto) {
    return this.clientsService.getPortfolioSummary(query.country);
  }
}
