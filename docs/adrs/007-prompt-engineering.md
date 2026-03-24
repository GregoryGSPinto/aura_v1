# ADR-007: Prompt Engineering Philosophy

## Status
Aceito — 2026-03-21

## Contexto
O system prompt é o componente mais impactante e menos testável do sistema inteiro.
Uma palavra errada muda o comportamento de TODA interação.
Prompts genéricos produzem IAs genéricas. Aura não é genérica.

## Decisão

### Estrutura em Seções XML
O prompt usa tags XML (`<aura_identity>`, `<filosofia_fundamental>`, etc.) porque:
- Claude processa XML como delimitadores semânticos, não como decoração
- Cada seção pode ser testada independentemente
- O Context Builder pode injetar/remover seções dinamicamente
- Facilita versionamento (diff legível entre versões)

### Injeção de Contexto Dinâmico
O prompt é dividido em:
- **Estático** (DNA): identidade, filosofia, regras, formato — não muda entre sessões
- **Dinâmico** (memória viva): knowledge entries, estado da sessão, ações pendentes, budget tier

O `buildAuraPrompt()` monta o prompt final. Isso permite:
- Otimizar tokens (menos contexto quando budget está baixo)
- Adaptar comportamento por tier (respostas curtas em red/blocked)
- Injetar knowledge por relevância (sort por confidence)

### Anti-Patterns Explícitos
O prompt lista explicitamente frases proibidas ("Como IA, eu não posso...", "Boa pergunta!", etc.) porque:
- LLMs tendem a defaults polidos que desperdiçam tokens
- Cada frase genérica é tempo do Gregory desperdiçado
- Anti-patterns são mais eficazes que "seja concisa" (que é vago)

### Calibração por Exemplos
Quatro exemplos cobrindo os cenários mais comuns:
- Pedido de ação (prospecção) → mostra formato de action
- Emocional (cansaço) → mostra prioridade humana
- L2 (email) → mostra fluxo de aprovação
- L3 (financeiro) → mostra bloqueio firme mas respeitoso

Exemplos são o mecanismo de few-shot learning mais eficaz para Claude.

### Detecção de Overwork como Obrigação
Não é feature. Não é nice-to-have. É enforcement da filosofia fundamental.
Se Aura detecta padrões de overwork e não age, está falhando no seu propósito.

### Boot Message Protocol
A primeira mensagem de cada sessão é intencionalmente NÃO-genérica:
- Nome → reconhecimento pessoal
- Ações pendentes → continuidade
- Contexto recente → memória demonstrada
- Esperar input → respeito pelo tempo

## Consequências

### Positivas
- Aura se comporta como parceira, não como assistente genérica
- Token usage é controlado (respostas proporcionais ao tier)
- Conhecimento acumulado é usado ativamente
- Gregory nunca precisa repetir informação que já deu
- Overwork é detectado e endereçado proativamente

### Negativas
- Prompt é grande (~3000 tokens estático + contexto dinâmico)
- Custo fixo por request é maior que chatbot simples
- Atualizar prompt requer cuidado (risco de regressão comportamental)
- Anti-patterns podem ser muito restritivos em edge cases

### Métricas de Sucesso
- Gregory nunca diz "eu já te falei isso" → memória funcionando
- Tempo médio de resposta < 3s → concisão funcionando
- Zero ações L3 sugeridas como executáveis → bloqueio funcionando
- Gregory não trabalha depois das 22h → detecção de overwork funcionando
- Satisfação subjetiva: Gregory sente que Aura o conhece
