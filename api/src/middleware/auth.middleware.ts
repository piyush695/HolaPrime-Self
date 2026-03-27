import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { queryOne } from '../db/index.js';

// Augment Fastify typings
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (roles: string[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const payload = await req.jwtVerify<{ sub: string; role: string; type: string }>();
      if (payload.type !== 'admin') {
        return reply.status(401).send({ error: 'Invalid token type' });
      }

      const admin = await queryOne<{
        id: string; email: string; first_name: string;
        last_name: string; role: string; is_active: boolean;
      }>(
        'SELECT id, email, first_name, last_name, role, is_active FROM admin_users WHERE id = $1',
        [payload.sub],
      );

      if (!admin || !admin.is_active) {
        return reply.status(401).send({ error: 'Unauthorised' });
      }

      (req as any).admin = admin;
    } catch {
      return reply.status(401).send({ error: 'Unauthorised' });
    }
  });

  app.decorate('requireRole', (roles: string[]) =>
    async (req: FastifyRequest, reply: FastifyReply) => {
      const admin = (req as any).admin;
      if (!admin || !roles.includes(admin.role)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
    },
  );
}

// fp() makes decorations leak to the parent scope — required for cross-plugin access
export const authMiddleware = fp(authPlugin, {
  name: 'auth-middleware',
  dependencies: ['@fastify/jwt'],
});
