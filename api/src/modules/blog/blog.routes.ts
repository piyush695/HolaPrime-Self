import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';

export async function blogRoutes(app: FastifyInstance) {
  app.get('/public', async (req, reply) => {
    const { category, limit = 20 } = req.query as any;
    const rows = await query(
      `SELECT id, slug, title, excerpt, category, tags, author_name, featured_img, read_time, published_at
       FROM blog_posts WHERE status='published' ${category ? 'AND category=$1' : ''} ORDER BY published_at DESC LIMIT ${limit}`,
      category ? [category] : []
    );
    return reply.send(rows);
  });

  app.get('/public/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const row = await queryOne("SELECT * FROM blog_posts WHERE slug=$1 AND status='published'", [slug]);
    if (!row) return reply.status(404).send({ error: 'Post not found' });
    return reply.send(row);
  });

  app.addHook('onRequest', async (req, reply) => {
    if (req.url.includes('/public')) return;
    return app.authenticate(req, reply);
  });

  app.get('/', async (_req, reply) => {
    const rows = await query('SELECT id, slug, title, category, status, author_name, published_at, created_at FROM blog_posts ORDER BY created_at DESC');
    return reply.send(rows);
  });

  app.get('/:id', async (req, reply) => {
    const row = await queryOne('SELECT * FROM blog_posts WHERE id=$1', [(req.params as any).id]);
    if (!row) return reply.status(404).send({ error: 'Not found' });
    return reply.send(row);
  });

  app.post('/', async (req, reply) => {
    const { title, slug, excerpt, body, category, tags, author_name, featured_img, status, meta_title, meta_desc, read_time } = req.body as any;
    const admin = (req as any).admin;
    const finalSlug = slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g,'');
    const row = await queryOne(
      `INSERT INTO blog_posts (title,slug,excerpt,body,category,tags,author_name,featured_img,status,meta_title,meta_desc,read_time,created_by,published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,slug`,
      [title, finalSlug, excerpt ?? null, body, category ?? 'general', JSON.stringify(tags ?? []), author_name ?? 'Hola Prime Team', featured_img ?? null, status ?? 'draft', meta_title ?? title, meta_desc ?? excerpt ?? null, read_time ?? 5, admin.id, status === 'published' ? new Date().toISOString() : null]
    );
    return reply.status(201).send(row);
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { title, excerpt, body, category, tags, author_name, status, meta_title, meta_desc, read_time, featured_img } = req.body as any;
    const admin = (req as any).admin;
    await query(
      `UPDATE blog_posts SET 
        title=COALESCE($1,title), excerpt=COALESCE($2,excerpt), body=COALESCE($3,body),
        category=COALESCE($4,category), tags=COALESCE($5,tags), author_name=COALESCE($6,author_name),
        status=COALESCE($7,status), meta_title=COALESCE($8,meta_title), meta_desc=COALESCE($9,meta_desc),
        read_time=COALESCE($10,read_time), featured_img=COALESCE($11,featured_img),
        published_at=CASE WHEN $7='published' AND published_at IS NULL THEN NOW() ELSE published_at END,
        updated_at=NOW()
       WHERE id=$12`,
      [title ?? null, excerpt ?? null, body ?? null, category ?? null, tags ? JSON.stringify(tags) : null, author_name ?? null, status ?? null, meta_title ?? null, meta_desc ?? null, read_time ?? null, featured_img ?? null, id]
    );
    return reply.send({ ok: true });
  });

  app.delete('/:id', async (req, reply) => {
    await query("UPDATE blog_posts SET status='archived' WHERE id=$1", [(req.params as any).id]);
    return reply.send({ ok: true });
  });
}
