import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { AuthDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { jwtSecret } from 'src/utils/constants';
import { Request, Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async signup(dto: AuthDto) {
    const { email, password } = dto;
    const foundUser = await this.prisma.user.findUnique({ where: { email } });
    if (foundUser) {
      throw new BadRequestException(
        'Email already exists, kindly use another email.',
      );
    }
    const hashedPassword = await this.hashPassword(password);
    await this.prisma.user.create({
      data: {
        email,
        hashedPassword,
      },
    });
    return { message: 'Signup was successfull' };
  }

  async signin(dto: AuthDto, req: Request, res: Response) {
    const { email, password } = dto;
    const foundUser = await this.prisma.user.findUnique({ where: { email } });
    if (!foundUser) {
      throw new BadRequestException('Credentials did not match any account');
    }
    const isMatch = await this.comparePasswords({
      password,
      hash: foundUser.hashedPassword,
    });
    if (!isMatch) {
      throw new BadRequestException('Credentials did not match any account');
    }

    //sign jwt
    const token = await this.signToken({
      id: foundUser.id,
      email: foundUser.email,
    });
    if (!token) {
      throw new ForbiddenException();
    }
    res.cookie('token', token);

    return res.send({ message: 'Logged in successfully' });
  }

  async signout(req: Request, res: Response) {
    res.clearCookie('token');
    return res.send({ message: 'Logged out successfully' });
  }

  //Helper functions
  async hashPassword(password: string) {
    const saltOrRounds = 10;
    return await bcrypt.hash(password, saltOrRounds);
  }

  async comparePasswords(args: { password: string; hash: string }) {
    return await bcrypt.compare(args.password, args.hash);
  }

  async signToken(args: { id: string; email: string }) {
    const payload = args;
    return this.jwt.signAsync(payload, { secret: jwtSecret });
  }
}
