ALTER TABLE "site_settings" ADD COLUMN "security_config" jsonb DEFAULT '{}'::jsonb NOT NULL;
