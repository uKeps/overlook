---
type: concept
area: programming
tags: [web, api]
review_on: 2026-02-01
interval: 4
---

# REST

> [!abstract] In one sentence
> An API style where URLs name resources and [[HTTP]] methods say what to do with them.

`GET /students/42` reads, `PUT /students/42` replaces, `DELETE /students/42` deletes. The server keeps no
session: each request explains itself. See also [[Idempotency]].
