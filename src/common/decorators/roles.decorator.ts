import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../types/models';

export const ROLES_KEY = 'stayscape:roles';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
