import type { PublicUser, User } from '../types/models';

/** Everything a client is allowed to see about an account — never the hash. */
export const publicUser = (user: User): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  hotelId: user.hotelId,
  avatarSeed: user.avatarSeed,
  active: user.active,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});
