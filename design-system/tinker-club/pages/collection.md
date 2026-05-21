# Page override — Collection grid

> Path: `src/app/dashboard/collection/page.tsx` + `CollectionGrid.tsx`
>
> This file overrides `../MASTER.md` for this page only.

## Editorial direction

The collection is the homepage of every visit — it has to feel like a *garage* (someone's cars), not a *table* (admin CRUD). Treat each vehicle like a magazine spread.

- **Display headline** in Playfair Display, generously sized. The "Hi <name>" greeting becomes the editorial moment.
- **Sub-eyebrow** in Inter, all caps, tracked-out — borrowed from car-magazine front matter.
- **Featured card** (first vehicle) spans full width on desktop with a taller image. Remaining cards in a 3-col grid. On mobile everyone is full-width.
- **Image is the card**, not "image inside a card." Push the radius onto the image, lift only the image on hover.

## Tokens

| Token | Value | Notes |
|---|---|---|
| Page background | `#F8FAFC` (ink-50) | overrides global `#FFFFFF` |
| Headline font | Playfair Display 600 | Greeting + featured vehicle title |
| Headline scale | `clamp(2.25rem, 4vw, 3.75rem)` | Editorial, not "h1 bold 24px" |
| Eyebrow font | Inter 500 uppercase `tracking-[0.18em]` | "Your collection · 5 cars" |
| Card image radius | `1.25rem` (rounded-[20px]) | image owns the corner |
| Card lift on hover | `transform: translateY(-2px)` + `shadow-xl` | 200ms ease-out |
| Image zoom on hover | `scale(1.04)` 600ms ease-out | inside overflow-hidden parent |
| Vehicle title font | Playfair Display 500, italic on year | year reads as caption |
| CTA "Add Car" | `bg-[#DC2626]` solid red, white text, `rounded-full` | only red on the page |
| Filter chips | replace `<select>` with chip row when there are ≤4 options | direct manipulation, no dropdown |

## Visibility pill

Drop the colored pill backgrounds — they fight the image. Use a small dot + label sitting on a translucent dark strip across the bottom of the image (gradient `from-black/70 to-transparent`). The dot color carries the meaning:

| State | Dot | Label |
|---|---|---|
| `PRIVATE` | ink-300 | "Private" |
| `CLUB` | accent red | "Shared · {n}" |
| `PUBLIC` | emerald-400 | "Public" |

## Bento layout

```
desktop ≥ lg                          mobile
┌───────────────────────────────┐     ┌───────────┐
│                               │     │  card 1   │
│         featured              │     ├───────────┤
│       (vehicle 0)             │     │  card 2   │
│                               │     ├───────────┤
└───────────────────────────────┘     │   ...     │
┌─────────┬─────────┬─────────┐
│  card 1 │ card 2  │ card 3  │
├─────────┼─────────┼─────────┤
│  card 4 │ card 5  │  ...    │
└─────────┴─────────┴─────────┘
```

If there's only one vehicle, render it as the featured card alone (no empty grid).

## Search + filter

The current row of generic `<select>`s feels admin-like. Replace with:
- Search input at left with a thin underline (no border box) — less form-y.
- Visibility chips (All · Private · Shared · Public) — direct manipulation; current selection has solid ink-900 bg.
- Sort stays as a small text dropdown at right (kept compact; sort doesn't deserve as much visual weight as filter).

## Empty state

When there are zero vehicles: large display-serif "Your garage is empty." + an editorial sentence + the red Add Car CTA centered. No box, no border.

## Motion

- Cards entrance: `prefers-reduced-motion` aware. Fade + 8px translate-up, staggered 40ms per card, total budget < 400ms.
- Hover: image scale + card lift, both 200–300ms.
- No scroll-driven parallax on this page (reserve that for vehicle profile).

## Out of scope (defer)

- Live grouping / collapsing by make
- Drag-to-reorder
- Featured-card auto-rotation
