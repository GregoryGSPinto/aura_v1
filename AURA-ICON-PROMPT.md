# PROMPT: Configurar ícone da Aura como PWA + iOS Home Screen

O arquivo `aura-icon.svg` está na raiz do projeto (~/Projetos/aura_v1/aura-icon.svg).
É o ícone oficial da Aura — fundo escuro (#0A0E1A → #0F1628), símbolo ✦ verde (#00D4AA),
anéis orbitais, pontos de energia, texto "AURA" embaixo.

## TAREFA 1 — Gerar PNGs em todos os tamanhos necessários

Use o `sips` (nativo do macOS) ou `convert` (ImageMagick) para gerar PNGs a partir do SVG.
Se nenhum dos dois suportar SVG direto, use `rsvg-convert` (brew install librsvg) ou
crie um script Python com cairosvg/Pillow.

Gere estes tamanhos e salve em `~/Projetos/aura_v1/aura/frontend/public/icons/`:

```
icon-16x16.png      → favicon pequeno
icon-32x32.png      → favicon padrão
icon-48x48.png      → favicon grande
icon-72x72.png      → Android
icon-96x96.png      → Android
icon-128x128.png    → Chrome Web Store
icon-144x144.png    → Android/Windows
icon-152x152.png    → iPad
icon-180x180.png    → iPhone (apple-touch-icon)
icon-192x192.png    → PWA Android (manifest)
icon-384x384.png    → PWA Android (manifest)
icon-512x512.png    → PWA splash/install (manifest)
```

Também copie o SVG original:
```
cp ~/Projetos/aura_v1/aura-icon.svg ~/Projetos/aura_v1/aura/frontend/public/icons/icon.svg
```

Se não conseguir converter SVG → PNG nativamente, use esta alternativa Python:
```python
# pip install cairosvg --break-system-packages
import cairosvg
sizes = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512]
for s in sizes:
    cairosvg.svg2png(
        url="aura-icon.svg",
        write_to=f"aura/frontend/public/icons/icon-{s}x{s}.png",
        output_width=s, output_height=s
    )
```

## TAREFA 2 — Configurar manifest.json (PWA)

### Crie ou atualize: `frontend/public/manifest.json`

```json
{
  "name": "Aura — Autonomous AI",
  "short_name": "Aura",
  "description": "Personal AI agent with voice commands, tool calling, and Mac automation",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0A0E1A",
  "theme_color": "#00D4AA",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-72x72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/icons/icon-96x96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "/icons/icon-128x128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144x144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152x152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-384x384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

## TAREFA 3 — Configurar meta tags no HTML

### Modifique: `frontend/app/layout.tsx` (ou `_document.tsx` ou `<head>`)

Adicione dentro do `<head>` (se Next.js App Router, use `metadata` export ou `<head>` direto):

```tsx
// Se usando metadata export do Next.js:
export const metadata = {
  // ... metadata existente ...
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aura',
  },
  themeColor: '#00D4AA',
};
```

Se o projeto usa `<head>` direto, adicione:
```html
<link rel="manifest" href="/manifest.json">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Aura">
<meta name="theme-color" content="#00D4AA">
```

## TAREFA 4 — Favicon

Copie o ícone 32x32 como favicon:
```bash
cp frontend/public/icons/icon-32x32.png frontend/public/favicon.png
```

Se o projeto já tem um `favicon.ico`, substitua. Se não, crie usando:
```bash
# Se tiver ImageMagick:
convert frontend/public/icons/icon-32x32.png frontend/public/favicon.ico

# Se não, o PNG como favicon funciona em todos os browsers modernos
```

## TAREFA 5 — Verificação

1. Rode o frontend e abra no browser:
```bash
cd ~/Projetos/aura_v1/aura/frontend && pnpm dev
```

2. Verifique:
   - Favicon aparece na tab do browser (deve ser o ✦ verde em fundo escuro)
   - `http://localhost:3000/manifest.json` retorna o manifest correto
   - `http://localhost:3000/icons/icon-512x512.png` carrega a imagem

3. No iPhone Safari:
   - Acesse via ngrok URL
   - Tap no botão de compartilhar (⬆️)
   - "Adicionar à Tela de Início"
   - O ícone da Aura deve aparecer como app na home screen
   - Ao abrir, deve rodar fullscreen sem barra do Safari

## TAREFA 6 — Commit e push

```bash
cd ~/Projetos/aura_v1
git add -A
git commit -m "✦ brand: Aura icon + PWA manifest + iOS home screen support"
git push
```

## REGRAS

1. NÃO modifique o SVG — ele já está pronto, use como está
2. O diretório de ícones é `frontend/public/icons/` — crie se não existir
3. Se a conversão SVG → PNG falhar, tente TODAS as alternativas (sips, convert, rsvg-convert, cairosvg) antes de desistir
4. O manifest.json deve ficar em `frontend/public/` para Next.js servir automaticamente
5. Não quebre o build — rode `pnpm tsc --noEmit` no final
6. O background_color do manifest DEVE ser #0A0E1A (igual ao fundo do ícone)
7. O theme_color DEVE ser #00D4AA (verde Aura)
