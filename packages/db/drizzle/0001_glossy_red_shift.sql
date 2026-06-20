ALTER TABLE `connections` ADD `imap_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `connections` ADD `imap_same_as_smtp` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `connections` ADD `imap_host` text;--> statement-breakpoint
ALTER TABLE `connections` ADD `imap_port` integer DEFAULT 993;--> statement-breakpoint
ALTER TABLE `connections` ADD `imap_secure` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `connections` ADD `imap_user` text;--> statement-breakpoint
ALTER TABLE `connections` ADD `imap_pass_encrypted` text;