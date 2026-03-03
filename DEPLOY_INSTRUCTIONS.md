# Handleiding voor Publiceren op Vimexx (of andere shared hosting)

Omdat de automatische publicatie niet werkt, kun je de applicatie handmatig uploaden naar je hostingpakket.

## ⚠️ Belangrijk over de API Key

Deze applicatie draait volledig in de browser (Client-Side). Dit betekent dat je **Gemini API Key** zichtbaar is in de broncode voor iedereen die weet waar ze moeten kijken.
*   Zorg dat je in Google Cloud Console **beperkingen (restrictions)** instelt op je API Key.
*   Beperk de key tot alleen jouw domeinnaam (bijv. `jouw-domein.nl`) en `localhost` (voor testen).
*   Dit voorkomt dat anderen jouw key op hun eigen websites kunnen gebruiken.

## Stap 1: De Applicatie Bouwen

Je moet de broncode omzetten naar bestanden die de browser begrijpt (HTML, CSS, JS).

1.  Zorg dat je een bestand genaamd `.env` hebt in de hoofdmap van je project (naast `package.json`).
2.  Zet hierin je API key:
    ```
    GEMINI_API_KEY=jouw_api_key_hier
    ```
3.  Open je terminal en voer het volgende commando uit:
    ```bash
    npm run build
    ```
4.  Dit maakt een nieuwe map aan genaamd `dist`.

## Stap 2: Uploaden naar Vimexx

1.  Log in op het **DirectAdmin** of **cPanel** van Vimexx (of gebruik een FTP-programma zoals FileZilla).
2.  Ga naar de map `public_html` (of de map van je subdomein).
3.  Verwijder eventuele bestaande bestanden (zoals `index.php` of `default.html`) als je de hele site wilt vervangen.
4.  Upload **alle inhoud** van de map `dist` naar `public_html`.
    *   Je zou nu een `index.html`, een `assets` map, en een `.htaccess` bestand moeten zien in `public_html`.

## Stap 3: Controleren

Ga naar je domeinnaam in de browser. De applicatie zou nu moeten werken!

### Problemen oplossen

*   **Wit scherm?** Controleer de Console in je browser (F12 -> Console) op foutmeldingen.
*   **404 Not Found bij verversen?** Zorg dat het `.htaccess` bestand is meegeüpload. Dit bestand zorgt ervoor dat alle pagina's netjes naar de applicatie worden gestuurd.
*   **API werkt niet?** Controleer of je API key correct is en of je domeinnaam is toegestaan in de Google Cloud Console.
