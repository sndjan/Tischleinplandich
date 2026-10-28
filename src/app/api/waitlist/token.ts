import { z } from 'zod/v4';

const TokenSchema = z.object({ token: z.uuid() });

/** The waitlist token from a JSON body, or null when it is missing or malformed. */
export async function readWaitlistToken(request: Request) {
  const parsed = TokenSchema.safeParse(await request.json().catch(() => null));
  return parsed.success ? parsed.data.token : null;
}
