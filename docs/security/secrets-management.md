# Secrets Management

## Estado atual

Aura usa principalmente variaveis de ambiente. Isso e aceitavel para desenvolvimento local, mas insuficiente como estrategia enterprise.

## Regras

- nenhum segredo no frontend publico
- nenhum segredo em docs, scripts ou git
- tokens locais devem ser rotacionaveis e fortes
- separar credenciais por ambiente

## Recomendacao

1. usar secret manager por ambiente
2. rotacionar credenciais de Supabase e providers
3. impedir uso de valores default em producao
4. habilitar secret scanning no CI
