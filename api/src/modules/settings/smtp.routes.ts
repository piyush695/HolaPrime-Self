import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listSmtpConfigs, saveSmtpConfig, deleteSmtpConfig,
  setDefaultSmtpConfig, testSmtpConfig,
} from './smtp.service.js';

export async function smtpRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/',     async (_req, reply) => reply.send(await listSmtpConfigs()));

  app.post('/', async (req, reply) => {
    const id = await saveSmtpConfig(req.body as Parameters<typeof saveSmtpConfig>[0]);
    return reply.status(201).send({ id });
  });

  app.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await saveSmtpConfig({ ...(req.body as Parameters<typeof saveSmtpConfig>[0]), id });
    return reply.send({ ok: true });
  });

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await deleteSmtpConfig(id);
    return reply.send({ ok: true });
  });

  app.post('/:id/set-default', async (req, reply) => {
    const { id } = req.params as { id: string };
    await setDefaultSmtpConfig(id);
    return reply.send({ ok: true });
  });

  app.post('/test', async (req, reply) => {
    const body = z.object({
      provider:      z.string(),
      host:          z.string().optional(),
      port:          z.number().optional(),
      username:      z.string().optional(),
      password:      z.string().optional(),
      apiKey:        z.string().optional(),
      fromEmail:     z.string().email(),
      fromName:      z.string().default('Hola Prime'),
      testRecipient: z.string().email(),
    }).parse(req.body);

    const result = await testSmtpConfig(body);
    return reply.send(result);
  });
}
