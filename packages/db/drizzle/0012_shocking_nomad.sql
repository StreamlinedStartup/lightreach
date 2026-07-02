ALTER TABLE `connections` ADD `consecutive_failures` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `connections` ADD `imap_uid_validity` integer;--> statement-breakpoint
ALTER TABLE `inbound_emails` ADD `is_bounce` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `messages_status_scheduled_idx` ON `messages` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `messages_status_sent_idx` ON `messages` (`status`,`sent_at`);--> statement-breakpoint
CREATE INDEX `messages_lead_status_idx` ON `messages` (`lead_id`,`status`);