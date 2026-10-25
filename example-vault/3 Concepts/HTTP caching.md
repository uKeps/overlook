---
type: concept
area: programming
tags: [web, performance]
---

# HTTP caching

> [!abstract] In one sentence
> The server says how long a response can be reused, and the browser or CDN stops asking again.

`Cache-Control: max-age=3600` allows an hour without asking. After that, an `ETag` lets the client ask
"did it change?" and get a `304` with no body. It relies on [[HTTP]] being stateless.
