---
type: concept
area: programming
tags: [web, networking]
review_on: 2026-01-10
interval: 2
---

# HTTP

> [!abstract] In one sentence
> A stateless request/response protocol: each request carries everything the server needs to answer it.

A request has a **method**, a **path**, **headers** and an optional body. The response comes back with a
**status code** and a body. Anything that needs state between requests uses a cookie or a token.

The base of [[REST]] and of almost every [[HTTP caching]] setup.
