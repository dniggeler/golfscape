# golfscape

Browserbasierte Golfplatz-Karte für die Schweiz und angrenzende Regionen. Die App verwendet React, TypeScript und Vite; die Karte ist eine stilisierte, frei skalierbare SVG-Grafik (`src/SwissMap.tsx`) mit je einem Fähnchen pro Golfplatz. Platzdaten, Kartengeometrie (Landesgrenze, Seen, Städte, Autobahnen in `src/data/map-geometry.json`) und Datensatzhinweise liegen lokal als JSON vor.

## Starten

```sh
npm install
npm run dev
```

## Checks

```sh
npm run build
npm run lint
npm run data:check
```

## Platzdaten bearbeiten

Golfplätze sind in `src/data/golf-courses.json` definiert. Jeder Eintrag enthält eine stabile `id`, Name, Ort/Region/Land, Koordinaten und einen Kartenlink. Löcher, Club-Website und Bilddaten sind optional. Bilder dürfen nur mit vollständig gepflegter Quelle, Urheberangabe und Lizenz eingebunden werden; ohne geprüftes Bild zeigt die Detailansicht eine lokale Illustration.

`src/data/dataset-info.json` beschreibt Geltungsbereich, Datenstand und bekannte Einschränkungen. Der derzeit enthaltene Datensatz umfasst 22 redaktionelle Vorschau-Einträge und ist nicht vollständig oder systematisch validiert. Koordinaten und Angaben bitte vor Veröffentlichung mit offiziellen Clubquellen/OpenStreetMap prüfen und ergänzen. Die Kartengeometrie ist eine grobe, vereinfachte Darstellung und nicht massstabsgetreu. Optional kann ein Eintrag `labelAnchor` (`start`/`end`) und `labelDy` enthalten, um die Beschriftung des Fähnchens zu verschieben.
