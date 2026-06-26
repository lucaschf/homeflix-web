# ADR-001: Variantes Canônicas de Controle (Button/IconButton) + Tokens de Geometria

**Status:** Aceito  
**Data:** 2026-06-26  
**Deciders:** Lucas Cristovam  
**Technical Story:** Uma auditoria de consistência MUI dos dois _action bars_ que coexistem numa linha — o de detalhe de mídia (`Assistir` + bookmark + `Trailer`) e a toolbar de fila (`ORDENAR` + `Aleatório` + `Reproduzir fila`) — encontrou divergência acidental de forma entre controles irmãos: **quatro** `border-radius`, **três** tratamentos de borda hairline e **dois** caminhos de código distintos para o mesmo CTA coral. A action bar de detalhe estava reimplementada inline e desincronizada entre `MovieDetail` e `SeriesDetail`. Branch `feat/canonical-control-variants`.

---

## Contexto

A cor já estava centralizada: `palette.primary = peach` (`#D97757`), e todos os CTAs coral usam `primary.main`. **Forma e ritmo vertical, não.** A geometria de cada controle era carimbada à mão no call-site via `sx`, então o mesmo conceito visual divergia:

- **`border-radius` — quatro valores em uso, vários na mesma linha:**

  | valor | onde | origem |
  |---|---|---|
  | 5px (`0.625`) | `Aleatório`, `Reproduzir fila` | override em `AdminButton` |
  | 8px (`shape` / `1`) | `Assistir`, bookmark+Trailer (Movie) | `theme.shape` + `sx` |
  | 12px (`1.5`) | bookmark (Series) | `sx` |
  | 14px (`1.75`) | pill `ORDENAR`, segmented control | `sx` |

- **Borda "secundária / outlined" — três tratamentos:** `whiteAlpha(0.08)` (AdminButton + pill), `whiteAlpha(0.12)` (Movie), `whiteAlpha(0.2)` (Series). Nenhum era _o_ secundário.

- **CTA coral por dois caminhos:** `Assistir` era `<Button variant="contained">` cru (radius 8, `fontSize` `0.875rem` hardcoded fora da escala, `height: 46`); `Reproduzir fila` era `AdminButton variant="primary"` (radius 5, `fontSize.control`). Ambos coral, geometrias diferentes.

- **Action bar de detalhe reimplementada 2×:** `MovieDetail` (altura 46, bookmark 46×46 r8, Trailer sem variant) vs `SeriesDetail` (altura 38, bookmark 38×38 r12, Trailer `outlined`). Mudar a barra exigia editar dois arquivos que já tinham desincronizado — _Shotgun Surgery_ + divergência visível ao usuário.

- **Controle `ORDENAR` reimplementado:** um `<Box component="button">` com `borderRadius: 1.75`, **duplicado** em `QueueToolbar` e `MyLists`, em vez de um `Select`/Button reutilizável.

A raiz comum: o `theme` definia `MuiButton` (radius) mas **nenhuma `variant`**, e não havia `MuiSelect`/`MuiIconButton` canônicos. Sem uma forma de referência, cada tela inventou a sua. O `AdminButton` resolveu localmente para o admin, mas com seu próprio radius (5px) e duplicando os estilos por variante.

## Decisão

**Registrar as variantes de controle canônicas no `theme` e migrar os call-sites para elas, separando _look_ (variante) de _escala_ (`sx`/altura).**

1. **Variantes de `Button` no theme** (`theme.components.MuiButton.variants`, com _module augmentation_ de `ButtonPropsVariantOverrides`): `cta` (CTA coral), `hairline` (secundário outlined), `ghost` (transparente) e `danger` (vermelho). Cada variante carrega o **look completo** — cores, borda hairline, peso, padding compacto e `text-transform: none`. O **radius NÃO é setado na variante**: herda `shape.borderRadius` (**8px**), o único radius canônico de controle. O override redundante de `MuiButton.root.borderRadius` foi removido.

2. **Tokens de geometria** (`theme/tokens.ts`): `ACTION_BAR_HEIGHT = 46` (altura única dos controles do action bar de detalhe, inclusive o bookmark quadrado) e `border.hairline`/`border.hairlineStrong` (borda secundária resting/hover única).

3. **A escala é layerizada por `sx`, nunca o look.** Um CTA herói usa `<Button variant="cta" sx={{ height: ACTION_BAR_HEIGHT, px: 3.25 }}>`; um CTA de toolbar usa `variant="cta"` com o padding compacto da variante. A mesma variante serve às duas escalas.

4. **`AdminButton` vira um _shim_ fino** que só mapeia o vocabulário admin (`primary | secondary | ghost | danger`) para as variantes do theme — sem mais estilos duplicados nem radius próprio.

5. **Componentes compartilhados para os controles que estavam reimplementados:** `SortMenuButton<T>` (substitui o pill `ORDENAR` hand-rolled duplicado, agora sobre a variante `hairline`) e `WatchlistIconButton` (bookmark quadrado em `ACTION_BAR_HEIGHT` com a borda hairline canônica, usado por ambas as páginas de detalhe).

## Consequências

### Positivas

- **Uma fonte para a forma do controle.** Mudar radius/altura/CTA passa a tocar o theme (ou um token), não N call-sites. Os dois action bars convergem; a divergência Movie vs Series some.
- Os dois CTAs coral saem da **mesma** variante; os secundários da **mesma** borda hairline.
- O pill `ORDENAR` deixa de ser o ponto fora da curva (14px → 8px) e a sua duplicação colapsa em `SortMenuButton`.
- Acessibilidade colateral: o `ORDENAR` era um `Box component="button"`; agora é um `Button` MUI de fato.

### Negativas

- **Blast radius do radius canônico:** todos os botões do admin migram de 5px → 8px de raio. É a convergência pretendida, mas é uma mudança visual ampla — exige _retest_ visual das superfícies de admin.
- O `Assistir` converge de `0.875rem` para `fontSize.control` (`0.8125rem`); leve redução, intencional (estava fora da escala).
- O bookmark/Trailer de detalhe convergem da borda `0.12/0.2` para a hairline `0.08` (mais sutil).

### Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Regressão visual em admin pelo radius 5→8 | Média | Baixo | Migração incremental (Strangler Fig); `tsc -b` + `eslint` limpos; conferir as telas de maior tráfego primeiro. |
| `style` de variante como função `({ theme })` não resolver em MUI v7 | Baixa | Médio | Suportado a partir do MUI v6; build (`tsc -b`) e render validados em v7.3.9. |
| Altura 46 do action bar quebrar layout de série (era 38) | Baixa | Baixo | É um row hero com `flexWrap`; ambas as páginas usam o mesmo token agora. |

## Alternativas Consideradas

- **Manter `AdminButton` como o ponto único e só alinhar os call-sites a ele.** Rejeitado: `AdminButton` é um wrapper de admin; os action bars do consumer não deveriam depender dele, e ele ainda carregava radius/estilos próprios. Elevar a decisão ao theme é o nível correto.
- **`sx` compartilhado (constante exportada) em vez de variante de theme.** Rejeitado: não é descobrível via a API padrão `variant=` do MUI e não cobre `defaultProps`/override por componente; variante de theme é o mecanismo idiomático.
- **Big-bang (trocar tudo de uma vez).** Rejeitado em favor de Strangler Fig: registrar as variantes sem tocar call-sites, migrar tela a tela começando pelos action bars auditados.

## Escopo desta mudança

Migrados nesta branch: `Assistir`/`Trailer`/bookmark em `MovieDetail`, `SeriesDetail` e `HeroBanner` (as três cópias do mesmo trio); `Reproduzir fila`/`Aleatório`/`ORDENAR` em `QueueToolbar`; `ORDENAR` + segmented control em `MyLists`; `AdminButton`. Novos: `SortMenuButton`, `WatchlistIconButton`, e os tokens `ACTION_BAR_HEIGHT`/`border`. Demais superfícies de admin convergem ao radius 8px por herdarem `AdminButton`/`shape` — sem edição de call-site, mas exigem _retest_ visual.
