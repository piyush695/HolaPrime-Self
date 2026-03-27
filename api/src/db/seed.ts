import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
dotenvConfig({ path: resolve(process.cwd(), '.env') });
dotenvConfig({ path: resolve(process.cwd(), '..', '.env') });

import { pool, query, queryOne } from './index.js';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Running seed...');

  const password = process.env.ADMIN_PASSWORD || 'Admin@HolaPrime1';
  const hash     = await bcrypt.hash(password, 12);

  // Remove old wrong-domain account
  await query("DELETE FROM admin_users WHERE email = 'admin@holaprimemarkets.com'");

  const existing = await queryOne(
    "SELECT id FROM admin_users WHERE email = 'admin@holaprime.com'"
  );

  if (existing) {
    await query(
      "UPDATE admin_users SET password_hash = $1, role = 'superadmin' WHERE email = 'admin@holaprime.com'",
      [hash]
    );
    console.log('✓ Admin password updated');
  } else {
    await query(
      `INSERT INTO admin_users (email, password_hash, first_name, last_name, role)
       VALUES ('admin@holaprime.com', $1, 'Super', 'Admin', 'superadmin')`,
      [hash]
    );
    console.log('✓ Admin user created');
  }

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  Hola Prime Admin Credentials:');
  console.log('  Email:    admin@holaprime.com');
  console.log(`  Password: ${password}`);
  console.log('  URL:      http://localhost:5173');
  console.log('═══════════════════════════════════════════');
  console.log('');


  // ── Seed sample challenge products ─────────────────────────────────────────
  const existingProduct = await queryOne('SELECT id FROM challenge_products LIMIT 1');
  if (!existingProduct) {
    const products = [
      {
        name: '2-Step Prime 10K', slug: '2-step-prime-10k', account_size: 10000, fee: 99,
        currency: 'USD', platform: 'mt5', profit_split: 90, leverage: '1:100',
        instruments: ['forex','indices','commodities'],
        phases: JSON.stringify([
          { phase:'evaluation', profit_target:10, max_daily_loss:5, max_total_loss:10, min_trading_days:3 },
          { phase:'verification', profit_target:5, max_daily_loss:5, max_total_loss:10, min_trading_days:3 },
        ]),
      },
      {
        name: '2-Step Prime 25K', slug: '2-step-prime-25k', account_size: 25000, fee: 189,
        currency: 'USD', platform: 'mt5', profit_split: 90, leverage: '1:100',
        instruments: ['forex','indices','commodities','crypto'],
        phases: JSON.stringify([
          { phase:'evaluation', profit_target:10, max_daily_loss:5, max_total_loss:10, min_trading_days:3 },
          { phase:'verification', profit_target:5, max_daily_loss:5, max_total_loss:10, min_trading_days:3 },
        ]),
      },
      {
        name: '2-Step Prime 50K', slug: '2-step-prime-50k', account_size: 50000, fee: 299,
        currency: 'USD', platform: 'mt5', profit_split: 90, leverage: '1:100',
        instruments: ['forex','indices','commodities','crypto'],
        phases: JSON.stringify([
          { phase:'evaluation', profit_target:10, max_daily_loss:5, max_total_loss:10, min_trading_days:3 },
          { phase:'verification', profit_target:5, max_daily_loss:5, max_total_loss:10, min_trading_days:3 },
        ]),
      },
      {
        name: '1-Step Pro 10K', slug: '1-step-pro-10k', account_size: 10000, fee: 84,
        currency: 'USD', platform: 'mt5', profit_split: 95, leverage: '1:100',
        instruments: ['forex','indices','commodities'],
        phases: JSON.stringify([
          { phase:'evaluation', profit_target:8, max_daily_loss:4, max_total_loss:8, min_trading_days:5 },
        ]),
      },
      {
        name: '1-Step Pro 25K', slug: '1-step-pro-25k', account_size: 25000, fee: 174,
        currency: 'USD', platform: 'mt5', profit_split: 95, leverage: '1:100',
        instruments: ['forex','indices','commodities','crypto'],
        phases: JSON.stringify([
          { phase:'evaluation', profit_target:8, max_daily_loss:4, max_total_loss:8, min_trading_days:5 },
        ]),
      },
      {
        name: '1-Step Pro 100K', slug: '1-step-pro-100k', account_size: 100000, fee: 449,
        currency: 'USD', platform: 'mt5', profit_split: 95, leverage: '1:100',
        instruments: ['forex','indices','commodities','crypto'],
        phases: JSON.stringify([
          { phase:'evaluation', profit_target:8, max_daily_loss:4, max_total_loss:8, min_trading_days:5 },
        ]),
      },
    ];

    for (const p of products) {
      await query(
        `INSERT INTO challenge_products
          (name, slug, account_size, fee, currency, platform, profit_split,
           leverage, instruments_allowed, phases, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active')
         ON CONFLICT (slug) DO NOTHING`,
        [p.name, p.slug, p.account_size, p.fee, p.currency, p.platform,
         p.profit_split, p.leverage, p.instruments, p.phases]
      );
    }
    console.log('✓ Sample challenge products seeded (6 plans)');
  } else {
    console.log('✓ Challenge products already exist — skipping');
  }

  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
