import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function q(sql: string, params: any[] = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}

async function seedOps() {
  console.log('🌱 Seeding ops data for Hola Prime...\n');

  // 1. Country Controls
  await q(`
    INSERT INTO country_controls (country_code, country_name, registration, payouts, risk_tier) VALUES
      ('US','United States',true,true,'standard'),('GB','United Kingdom',true,true,'standard'),
      ('IN','India',true,true,'standard'),('AE','United Arab Emirates',true,true,'standard'),
      ('DE','Germany',true,true,'standard'),('FR','France',true,true,'standard'),
      ('CA','Canada',true,true,'standard'),('AU','Australia',true,true,'standard'),
      ('SG','Singapore',true,true,'standard'),('JP','Japan',true,true,'standard'),
      ('NL','Netherlands',true,true,'standard'),('CH','Switzerland',true,true,'standard'),
      ('SE','Sweden',true,true,'standard'),('NO','Norway',true,true,'standard'),
      ('DK','Denmark',true,true,'standard'),('IT','Italy',true,true,'standard'),
      ('ES','Spain',true,true,'standard'),('PT','Portugal',true,true,'standard'),
      ('NZ','New Zealand',true,true,'standard'),('ZA','South Africa',true,true,'standard'),
      ('BR','Brazil',true,true,'standard'),('MX','Mexico',true,true,'standard'),
      ('AR','Argentina',true,true,'standard'),('CO','Colombia',true,true,'standard'),
      ('MY','Malaysia',true,true,'standard'),('TH','Thailand',true,true,'standard'),
      ('ID','Indonesia',true,true,'standard'),('PH','Philippines',true,true,'standard'),
      ('VN','Vietnam',true,true,'standard'),('BD','Bangladesh',true,true,'enhanced'),
      ('LK','Sri Lanka',true,true,'standard'),('KE','Kenya',true,true,'standard'),
      ('GH','Ghana',true,true,'standard'),('EG','Egypt',true,true,'standard'),
      ('MA','Morocco',true,true,'standard'),('SA','Saudi Arabia',true,true,'standard'),
      ('KW','Kuwait',true,true,'standard'),('QA','Qatar',true,true,'standard'),
      ('BH','Bahrain',true,true,'standard'),('OM','Oman',true,true,'standard'),
      ('JO','Jordan',true,true,'standard'),('TR','Turkey',true,true,'standard'),
      ('PL','Poland',true,true,'standard'),('CZ','Czech Republic',true,true,'standard'),
      ('HU','Hungary',true,true,'standard'),('RO','Romania',true,true,'standard'),
      ('UA','Ukraine',true,true,'enhanced'),('NG','Nigeria',true,true,'enhanced'),
      ('PK','Pakistan',true,true,'enhanced'),('RU','Russia',true,true,'enhanced'),
      ('VE','Venezuela',true,false,'enhanced'),
      ('AF','Afghanistan',false,false,'restricted'),
      ('BY','Belarus',false,false,'restricted'),
      ('KP','North Korea',false,false,'restricted'),
      ('CU','Cuba',false,false,'restricted'),
      ('IR','Iran',false,false,'restricted'),
      ('CN','China',false,false,'restricted'),
      ('SY','Syria',false,false,'restricted')
    ON CONFLICT (country_code) DO UPDATE SET
      country_name=EXCLUDED.country_name, registration=EXCLUDED.registration,
      payouts=EXCLUDED.payouts, risk_tier=EXCLUDED.risk_tier
  `);
  console.log('✅ Country Controls: 57 countries seeded');

  // 2. Site Content
  await q(`
    INSERT INTO site_content (key, label, description, value, content_type) VALUES
      ('hero_headline','Hero Headline','Main heading on landing page','"Trade With Confidence. Get Funded."','text'),
      ('hero_subheading','Hero Subheading','Subheading below hero','"Join 20,000+ funded traders worldwide"','text'),
      ('hero_cta_text','Hero CTA Button','Call-to-action button text','"Start Your Challenge"','text'),
      ('stat_funded_traders','Stat: Funded Traders','Counter on landing page','"20,000+"','text'),
      ('stat_total_payouts','Stat: Total Payouts','Total payout amount displayed','"$4.5M+"','text'),
      ('stat_avg_payout_time','Stat: Avg Payout Time','Average time from pass to payout','"33m 48s"','text'),
      ('stat_countries','Stat: Countries Active','Number of countries','"175+"','text'),
      ('announcement_bar','Announcement Bar','Top banner text (empty to hide)','"🎉 New: 2-Step Challenge now available!"','text'),
      ('announcement_enabled','Announcement Enabled','Show or hide the announcement bar','true','text'),
      ('trust_badge_1','Trust Badge 1','First trust badge below hero','"End-to-End Encrypted"','text'),
      ('trust_badge_2','Trust Badge 2','Second trust badge','"Role-Based Access"','text'),
      ('trust_badge_3','Trust Badge 3','Third trust badge','"Full Audit Trail"','text'),
      ('footer_tagline','Footer Tagline','Tagline in footer','"The smarter way to get funded."','text'),
      ('support_email','Support Email','Support email shown publicly','"support@holaprime.com"','text'),
      ('company_name','Company Name','Legal company name','"Hola Prime Markets Ltd"','text'),
      ('fsc_license','FSC License Number','License number in footer','"GB24203729"','text')
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, label=EXCLUDED.label
  `);
  console.log('✅ Site Content: 16 items seeded');

  // 3. Feature Flags
  await q(`
    INSERT INTO feature_flags (key, label, description, enabled, category) VALUES
      ('trader_registration','Trader Registration','Allow new traders to register',true,'platform'),
      ('challenge_purchase','Challenge Purchase','Allow challenge purchases',true,'platform'),
      ('payout_requests','Payout Requests','Allow traders to request payouts',true,'platform'),
      ('kyc_verification','KYC Verification','Require KYC for funded accounts',true,'platform'),
      ('affiliate_program','Affiliate Program','Enable affiliate referral system',true,'marketing'),
      ('leaderboard','Leaderboard','Show public trader leaderboard',true,'platform'),
      ('tournaments','Tournaments','Enable trading tournaments',false,'platform'),
      ('maintenance_mode','Maintenance Mode','Show maintenance page to traders',false,'platform'),
      ('auto_kyc_approval','Auto KYC Approval','Auto-approve KYC for low-risk countries',false,'compliance'),
      ('email_campaigns','Email Campaigns','Enable bulk email campaign sending',true,'marketing'),
      ('whatsapp_messages','WhatsApp Messages','Enable WhatsApp notifications',false,'marketing'),
      ('social_proof_ticker','Social Proof Ticker','Show payout notifications on landing',true,'marketing'),
      ('crypto_payouts','Crypto Payouts','Allow cryptocurrency payout method',true,'payments'),
      ('bank_payouts','Bank Transfer Payouts','Allow bank transfer payout method',true,'payments'),
      ('2fa_login','Two-Factor Login','Require 2FA for admin logins',false,'security')
    ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description
  `);
  console.log('✅ Feature Flags: 15 flags seeded');

  // 4. FAQ Items
  await q(`
    INSERT INTO faq_items (page, question, answer, sort_order, enabled) VALUES
      ('general','What is a prop firm challenge?','A prop firm challenge is an evaluation where you trade a simulated account to prove your skills. Once you pass, you receive a funded account with real capital.',1,true),
      ('general','How do I start a challenge?','Register for an account, choose your challenge plan, complete payment, and you will receive your login credentials within minutes.',2,true),
      ('general','What are the profit targets?','Phase 1 requires an 8% profit target. Phase 2 requires a 5% profit target. Once both phases are complete, you receive your funded account.',3,true),
      ('general','What is the daily loss limit?','The daily loss limit is 5% of your account balance. Exceeding this limit will result in account termination.',4,true),
      ('general','What is the maximum total loss?','The maximum total drawdown is 10% from your starting balance at any time.',5,true),
      ('general','How long do I have to complete the challenge?','There is no time limit, but you must trade at least 5 days to qualify for progression.',6,true),
      ('payout','How are payouts processed?','Payouts are processed within 24 hours of approval. You can request a payout every 14 days once funded.',7,true),
      ('general','What payment methods are accepted?','We accept bank transfer, cryptocurrency (USDT, BTC, ETH), PayPal, and credit/debit cards.',8,true),
      ('forex','What instruments can I trade?','You can trade Forex pairs, indices, commodities, and cryptocurrencies depending on your platform.',9,true),
      ('general','Is there a minimum trading day requirement?','Yes, you must trade a minimum of 5 days across all phases of the challenge.',10,true)
    ON CONFLICT DO NOTHING
  `);
  console.log('✅ FAQs: 10 questions seeded');

  // 5. Testimonials
  await q(`
    INSERT INTO testimonials (trader_name, country, country_flag, payout_amount, quote, rating, verified, featured, sort_order, enabled) VALUES
      ('James K.','United Kingdom','🇬🇧','$4,200','Got funded in 3 weeks and received my first payout within 24 hours. The process was seamless!',5,true,true,1,true),
      ('Priya M.','India','🇮🇳','$2,800','After failing at other firms, Hola Prime was the one that believed in my trading. Transparent rules and fast payouts.',5,true,true,2,true),
      ('Mohammed A.','UAE','🇦🇪','$6,500','The evaluation was fair and the dashboard gives you everything you need to track your progress.',5,true,true,3,true),
      ('Sarah T.','Canada','🇨🇦','$1,900','I was skeptical about prop firms but Hola Prime changed my mind. Fast, transparent, and payout was next day.',5,true,false,4,true),
      ('David L.','Singapore','🇸🇬','$3,400','Excellent platform, fair challenge rules, and the support team responded within hours.',5,true,false,5,true),
      ('Oluwaseun B.','Nigeria','🇳🇬','$1,200','Professional firm with real payouts. I have received 3 payouts so far and each was processed within 24 hours.',4,true,false,6,true)
    ON CONFLICT DO NOTHING
  `);
  console.log('✅ Testimonials: 6 testimonials seeded');

  // 6. Social Proof Events
  await q(`
    INSERT INTO social_proof_events (event_type, trader_name, trader_country, trader_flag, amount, challenge_name, is_visible, is_verified, occurred_at) VALUES
      ('payout','James K.','GB','🇬🇧',4200,'$100K Challenge',true,true,NOW() - INTERVAL '2 hours'),
      ('payout','Priya M.','IN','🇮🇳',2800,'$50K Challenge',true,true,NOW() - INTERVAL '5 hours'),
      ('payout','Mohammed A.','AE','🇦🇪',6500,'$200K Challenge',true,true,NOW() - INTERVAL '8 hours'),
      ('payout','Sarah T.','CA','🇨🇦',1900,'$25K Challenge',true,true,NOW() - INTERVAL '12 hours'),
      ('payout','David L.','SG','🇸🇬',3400,'$100K Challenge',true,true,NOW() - INTERVAL '18 hours'),
      ('funded','Aisha R.','AE','🇦🇪',null,'$50K Challenge',true,true,NOW() - INTERVAL '1 hour'),
      ('funded','Carlos M.','MX','🇲🇽',null,'$100K Challenge',true,true,NOW() - INTERVAL '3 hours'),
      ('payout','Yuki T.','JP','🇯🇵',5100,'$200K Challenge',true,true,NOW() - INTERVAL '1 day'),
      ('payout','Emma W.','AU','🇦🇺',2200,'$50K Challenge',true,true,NOW() - INTERVAL '1 day 3 hours'),
      ('challenge_pass','Raj S.','IN','🇮🇳',null,'$25K Challenge',true,true,NOW() - INTERVAL '30 minutes')
    ON CONFLICT DO NOTHING
  `);
  console.log('✅ Social Proof: 10 events seeded');

  // 7. Blog Posts
  await q(`
    INSERT INTO blog_posts (title, slug, excerpt, body, category, tags, author_name, status, read_time, published_at) VALUES
      ('How to Pass a Prop Firm Challenge','how-to-pass-prop-firm-challenge',
       'Everything you need to know about passing your first prop trading evaluation.',
       '<h2>Introduction</h2><p>Passing a prop firm challenge requires discipline, a solid trading strategy, and strict risk management.</p><h2>Risk Management</h2><p>Never risk more than 1-2% per trade to stay within the daily loss limit even on bad days.</p><h2>Mindset</h2><p>Think of the challenge as a marathon, not a sprint. Consistent small gains beat aggressive trading every time.</p>',
       'Education','["prop trading","challenge","risk management"]','Hola Prime Team','published',5,NOW() - INTERVAL '7 days'),
      ('Understanding Drawdown Limits','understanding-drawdown-limits',
       'Learn the difference between daily drawdown and maximum drawdown.',
       '<h2>What is Drawdown?</h2><p>Drawdown measures the decline from a peak to a trough in your account balance.</p><h2>Daily Loss Limit</h2><p>The daily loss limit of 5% means your account cannot lose more than 5% in a single trading day.</p>',
       'Education','["drawdown","risk","limits"]','Hola Prime Team','published',4,NOW() - INTERVAL '14 days'),
      ('Top 5 Strategies for Funded Traders','top-5-strategies-funded-traders',
       'Discover the most effective trading strategies used by successful funded traders.',
       '<h2>1. Trend Following</h2><p>Trade in the direction of the dominant trend using higher timeframe analysis.</p><h2>2. Support and Resistance</h2><p>Identify key price levels and trade bounces or breakouts from these zones.</p>',
       'Trading','["strategy","trading","funded"]','Hola Prime Team','published',6,NOW() - INTERVAL '21 days')
    ON CONFLICT (slug) DO NOTHING
  `);
  console.log('✅ Blog Posts: 3 posts seeded');

  // 8. Challenge Products (if empty)
  const existing = await q('SELECT COUNT(*) as n FROM challenge_products');
  if (parseInt((existing[0] as any).n) === 0) {
    await q(`
      INSERT INTO challenge_products (name, slug, account_size, fee, platform, profit_split, status, phases) VALUES
        ('Starter Challenge','starter-25k',25000,149,'mt5',80,'active','[{"phase":"evaluation","profit_target":8,"max_daily_loss":5,"max_total_loss":10,"min_trading_days":5},{"phase":"verification","profit_target":5,"max_daily_loss":5,"max_total_loss":10,"min_trading_days":5}]'),
        ('Standard Challenge','standard-50k',50000,249,'mt5',80,'active','[{"phase":"evaluation","profit_target":8,"max_daily_loss":5,"max_total_loss":10,"min_trading_days":5},{"phase":"verification","profit_target":5,"max_daily_loss":5,"max_total_loss":10,"min_trading_days":5}]'),
        ('Pro Challenge','pro-100k',100000,399,'mt5',80,'active','[{"phase":"evaluation","profit_target":8,"max_daily_loss":5,"max_total_loss":10,"min_trading_days":5},{"phase":"verification","profit_target":5,"max_daily_loss":5,"max_total_loss":10,"min_trading_days":5}]'),
        ('Elite Challenge','elite-200k',200000,699,'mt5',80,'active','[{"phase":"evaluation","profit_target":8,"max_daily_loss":5,"max_total_loss":10,"min_trading_days":5},{"phase":"verification","profit_target":5,"max_daily_loss":5,"max_total_loss":10,"min_trading_days":5}]')
      ON CONFLICT (slug) DO NOTHING
    `);
    console.log('✅ Challenge Products: 4 plans seeded');
  } else {
    console.log('✅ Challenge Products: already exist, skipped');
  }

  // 9. Payout Rules (if empty)
  const rulesExist = await q('SELECT COUNT(*) as n FROM payout_rules');
  if (parseInt((rulesExist[0] as any).n) === 0) {
    await q(`
      INSERT INTO payout_rules (rule_key, label, value, description) VALUES
        ('min_amount','Minimum Payout Amount','{"value":50}','Minimum USD amount for any payout request'),
        ('max_daily','Max Payouts Per Day','{"value":3}','Max payout requests per trader per day'),
        ('kyc_required_above','KYC Required Above','{"value":0}','KYC required for payouts above this amount (0=always)'),
        ('auto_approve_below','Auto-approve Below','{"value":0}','Auto-approve payouts below this amount (0=disabled)'),
        ('cooldown_hours','Cooldown Between Payouts','{"value":24}','Hours trader must wait between payouts'),
        ('velocity_flag_count','Velocity Flag Threshold','{"value":5}','Flag if more than N payouts in 7 days')
      ON CONFLICT (rule_key) DO NOTHING
    `);
    console.log('✅ Payout Rules: 6 rules seeded');
  }

  console.log('\n🎉 All ops data seeded successfully!');
  await pool.end();
}

seedOps().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
