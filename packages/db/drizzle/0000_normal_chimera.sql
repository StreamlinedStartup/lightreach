CREATE TABLE `campaign_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`connection_id` integer NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_connection_unique` ON `campaign_connections` (`campaign_id`,`connection_id`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`template_id` integer,
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
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`from_name` text NOT NULL,
	`from_email` text NOT NULL,
	`smtp_host` text NOT NULL,
	`smtp_port` integer DEFAULT 587 NOT NULL,
	`smtp_secure` integer DEFAULT false NOT NULL,
	`smtp_user` text NOT NULL,
	`smtp_pass_encrypted` text NOT NULL,
	`daily_limit` integer DEFAULT 50 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_tested_at` integer,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`list_id` integer NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`email` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`opening_line` text DEFAULT '' NOT NULL,
	`custom_fields` text DEFAULT '{}',
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`lead_id` integer NOT NULL,
	`connection_id` integer,
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
CREATE TABLE `templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
