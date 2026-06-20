CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inbound_emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`connection_id` integer,
	`uid` integer,
	`message_id` text,
	`in_reply_to` text,
	`references` text,
	`from_name` text DEFAULT '' NOT NULL,
	`from_email` text DEFAULT '' NOT NULL,
	`to_email` text DEFAULT '' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body_text` text,
	`body_html` text,
	`is_warmup` integer DEFAULT false NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`received_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inbound_email_uid_unique` ON `inbound_emails` (`connection_id`,`uid`);