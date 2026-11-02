import { z } from 'zod';

export const sendEmailPayloadSchema = z
  .object({
    to: z.string().min(3).max(320),
    subject: z.string().min(1).max(200),
    text: z.string().min(1).max(5000),
  })
  .strict();

export const invalidateSessionsPayloadSchema = z
  .object({
    userId: z.uuid(),
  })
  .strict();

export type SendEmailPayload = z.infer<typeof sendEmailPayloadSchema>;
export type InvalidateSessionsPayload = z.infer<
  typeof invalidateSessionsPayloadSchema
>;

export function readSendEmailPayload(payload: object): SendEmailPayload {
  const parsed = sendEmailPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Invalid SEND_EMAIL payload');
  }
  return parsed.data;
}

export function readInvalidateSessionsPayload(
  payload: object,
): InvalidateSessionsPayload {
  const parsed = invalidateSessionsPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Invalid INVALIDATE_SESSIONS payload');
  }
  return parsed.data;
}
