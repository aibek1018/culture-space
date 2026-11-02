import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Context } from '@nestjs/graphql';
import { AppConfigService } from '../../config/app-config.service';
import { AuthenticatedGuard } from '../../common/auth/guards';
import {
  CurrentAccountParam,
  type CurrentAccount,
} from '../../common/auth/current-account';
import { clientIp } from '../../common/security/client-ip';
import { AccountModel } from '../users/graphql/user.types';
import {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '../users/graphql/account.inputs';
import type { AccountView } from '../users/profile.service';
import { AuthService } from './auth.service';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfigService,
  ) {}

  @Mutation(() => AccountModel)
  register(
    @Args('input') input: RegisterInput,
    @Context() context: { req: Request },
  ): Promise<AccountView> {
    return this.auth.register(
      input,
      clientIp(context.req, this.config.nodeEnv),
      context.req,
    );
  }

  @Mutation(() => AccountModel)
  login(
    @Args('input') input: LoginInput,
    @Context() context: { req: Request },
  ): Promise<AccountView> {
    return this.auth.login(
      input.email,
      input.password,
      clientIp(context.req, this.config.nodeEnv),
      context.req,
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthenticatedGuard)
  logout(@Context() context: { req: Request }): Promise<boolean> {
    return this.auth.logout(context.req);
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthenticatedGuard)
  logoutAll(
    @CurrentAccountParam() account: CurrentAccount,
    @Context() context: { req: Request },
  ): Promise<boolean> {
    return this.auth.logoutAll(account, context.req);
  }

  @Mutation(() => AccountModel)
  verifyEmail(@Args('token') token: string): Promise<AccountView> {
    return this.auth.verifyEmail(token);
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthenticatedGuard)
  resendVerificationEmail(
    @CurrentAccountParam() account: CurrentAccount,
  ): Promise<boolean> {
    return this.auth.resendVerification(account);
  }

  @Mutation(() => Boolean)
  requestPasswordReset(@Args('email') email: string): Promise<boolean> {
    return this.auth.requestPasswordReset(email);
  }

  @Mutation(() => Boolean)
  resetPassword(@Args('input') input: ResetPasswordInput): Promise<boolean> {
    return this.auth.resetPassword(input.token, input.newPassword);
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthenticatedGuard)
  changePassword(
    @CurrentAccountParam() account: CurrentAccount,
    @Args('input') input: ChangePasswordInput,
    @Context() context: { req: Request },
  ): Promise<boolean> {
    return this.auth.changePassword(
      account,
      input.currentPassword,
      input.newPassword,
      context.req,
    );
  }
}
