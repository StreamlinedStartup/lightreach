PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `sequences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sequence_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sequence_id` integer NOT NULL,
	`position` integer NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`delay_days` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `__new_campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sequence_id` integer,
	`list_id` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`send_window_start` text DEFAULT '09:00' NOT NULL,
	`send_window_end` text DEFAULT '17:00' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`days_of_week` text DEFAULT '[1,2,3,4,5]' NOT NULL,
	`daily_cap` integer DEFAULT 100 NOT NULL,
	`min_delay_seconds` integer DEFAULT 60 NOT NULL,
	`max_delay_seconds` integer DEFAULT 300 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`sequence_id`) REFERENCES `sequences`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_campaigns` (`id`, `name`, `list_id`, `status`, `send_window_start`, `send_window_end`, `timezone`, `days_of_week`, `daily_cap`, `min_delay_seconds`, `max_delay_seconds`, `created_at`) SELECT `id`, `name`, `list_id`, `status`, `send_window_start`, `send_window_end`, `timezone`, `days_of_week`, `daily_cap`, `min_delay_seconds`, `max_delay_seconds`, `created_at` FROM `campaigns`;
--> statement-breakpoint
DROP TABLE `campaigns`;
--> statement-breakpoint
ALTER TABLE `__new_campaigns` RENAME TO `campaigns`;
--> statement-breakpoint
CREATE TABLE `__new_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`lead_id` integer NOT NULL,
	`connection_id` integer,
	`step_position` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`scheduled_at` integer,
	`sent_at` integer,
	`rendered_subject` text,
	`rendered_body` text,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_messages` (`id`, `campaign_id`, `lead_id`, `connection_id`, `status`, `scheduled_at`, `sent_at`, `rendered_subject`, `rendered_body`, `error`, `created_at`) SELECT `id`, `campaign_id`, `lead_id`, `connection_id`, `status`, `scheduled_at`, `sent_at`, `rendered_subject`, `rendered_body`, `error`, `created_at` FROM `messages`;
--> statement-breakpoint
DROP TABLE `messages`;
--> statement-breakpoint
ALTER TABLE `__new_messages` RENAME TO `messages`;
--> statement-breakpoint
DROP TABLE `templates`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
