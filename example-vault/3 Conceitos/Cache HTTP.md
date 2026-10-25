---
tipo: conceito
area: programacao
tags: [web, desempenho]
---

# Cache HTTP

> [!abstract] Em uma frase
> O servidor diz por quanto tempo uma resposta pode ser reaproveitada, e o navegador ou a CDN deixa de pedir de novo.

`Cache-Control: max-age=3600` libera uma hora sem perguntar. Passado o prazo, `ETag` permite
perguntar "mudou?" e receber `304` sem corpo. Depende do [[HTTP]] ser sem estado.
