# Vidéo de présentation Restafy (Remotion)

Vidéo **1920×1080**, **30 fps**, **45 s** : restaurants, clients, billetterie, production, CTA vers **https://restafy.shop/demo**.

## Bonnes pratiques utilisées

- **`Sequence`** : une séquence par chapitre (timings explicites, facile à retravailler).
- **`spring` / `interpolate`** : animations déterministes, adaptées au rendu headless.
- **Props JSON** sur la composition (`demoUrl`, `appUrl`, `vitrineUrl`) : personnalisation sans toucher au code.
- **Durée fixe** `durationInFrames` alignée sur la somme des séquences (évite les cadres noirs).

Références : [Compositions](https://www.remotion.dev/docs/composition), [Player — best practices](https://www.remotion.dev/docs/player/best-practices).

## Prérequis

- Node 18+

## Installation

```bash
cd remotion
npm install
```

## Prévisualiser (Studio)

```bash
npm run dev
```

## Rendu MP4

```bash
npm run render
```

Fichier sorti : `out/restafy-presentation.mp4` (créer le dossier `out` si besoin, ou laisser Remotion le créer).

## Image fixe (poster)

```bash
npm run render:still
```

## Personnaliser les URLs

Dans **Remotion Studio**, onglet **Props** de la composition `RestafyPresentation`, ou dans `src/Root.tsx` (`defaultProps`).
