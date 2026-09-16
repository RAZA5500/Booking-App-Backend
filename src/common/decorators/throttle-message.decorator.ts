import { SetMetadata } from '@nestjs/common';

export const THROTTLE_MESSAGE_KEY = 'stayscape:throttle-message';

/** Overrides the 429 body for a route that has its own rate limit. */
export const ThrottleMessage = (message: string) => SetMetadata(THROTTLE_MESSAGE_KEY, message);
