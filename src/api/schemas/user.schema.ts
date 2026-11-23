import { z } from 'zod';

/** Contract schemas validate real responses against the shape our models promise. */
export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(['admin', 'user']),
});

export const loginResponseSchema = z.object({
  token: z.string().min(1),
  expiresIn: z.number().optional(),
});

export const orderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(z.object({ sku: z.string(), quantity: z.number(), unitPrice: z.number() })),
  total: z.number(),
  status: z.enum(['pending', 'paid', 'cancelled']),
});
