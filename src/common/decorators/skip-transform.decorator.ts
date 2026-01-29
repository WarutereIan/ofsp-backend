import { SetMetadata } from '@nestjs/common';

export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * Decorator to skip the global TransformInterceptor for a route.
 * Use this for endpoints that need to return raw/plain-text responses
 * (e.g. Africa'sTalking USSD callbacks).
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);
