import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateContextDto } from './dto/create-context.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  me() {
    return this.usersService.me();
  }

  @Delete()
  @HttpCode(204)
  deleteMe() {
    this.usersService.deleteMe();
  }

  @Post('contexts')
  createContext(@Body() dto: CreateContextDto) {
    return this.usersService.createContext(dto);
  }

  @Get('contexts')
  contextHistory() {
    return this.usersService.contextHistory();
  }

  @Get('contexts/current')
  currentContext() {
    return this.usersService.currentContext();
  }
}
