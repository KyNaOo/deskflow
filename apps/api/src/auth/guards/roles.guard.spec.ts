import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../generated/prisma/client.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(role: Role): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1', tenantId: 't1', role } }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  function givenRouteRoles(roles: Role[] | undefined) {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  }

  it('laisse passer une route sans @Roles()', () => {
    givenRouteRoles(undefined);
    expect(guard.canActivate(contextFor(Role.CUSTOMER))).toBe(true);
  });

  it('laisse passer un rôle autorisé', () => {
    givenRouteRoles([Role.ADMIN, Role.AGENT]);
    expect(guard.canActivate(contextFor(Role.AGENT))).toBe(true);
  });

  it('refuse un rôle non autorisé (403)', () => {
    givenRouteRoles([Role.ADMIN]);
    expect(() => guard.canActivate(contextFor(Role.AGENT))).toThrow(ForbiddenException);
  });
});
