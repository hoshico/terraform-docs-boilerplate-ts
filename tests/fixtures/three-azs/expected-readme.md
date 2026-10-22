# test

<!-- BEGIN: communication-table (自動生成のため直接編集しない) -->
| ID | Source | Destination | Via | Protocol | Port | Description |
|---|---|---|---|---|---|---|
| users-to-alb | users | alb |  | tcp | 443 | Comma, "quote" and \| pipe |
| admins-to-bastion | admins | bastion |  | tcp | 22 | 複数行の<br>説明 |
| alb-to-app | alb | app |  | tcp | 8080 | ALB to app |
| app-to-db | app | db |  | tcp | 5432 | App to DB |
| batch-to-db | batch | db |  | tcp | 5432 | Batch to DB |
| batch-to-app | batch | app |  | udp | 53 | Batch to app (upward) |
| app-to-saas | app | saas | nat | tcp | 443 | App to SaaS via NAT |
<!-- END: communication-table -->

footer
