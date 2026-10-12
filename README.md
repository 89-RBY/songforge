# SongForge

Webapp per creare canzoni complete con l'intelligenza artificiale (Google Lyria), senza competenze musicali.

Stato: **fase (a) — scheletro, autenticazione e database**. La generazione musicale, il wizard, la libreria, i crediti e Stripe arrivano nelle fasi successive.

## Stack

- Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind CSS
- PostgreSQL con Prisma 7 (driver adapter `pg`)
- Auth.js 5 (magic link via email, Google opzionale), sessioni a database
- Zod per la validazione di ambiente e input
- Vitest per i test

## Avvio in locale

Requisiti: Node.js 20.9 o superiore (consigliato 22), PostgreSQL 14 o superiore.

```bash
npm install                 # genera anche il client Prisma (postinstall)
cp .env.example .env        # poi compila DATABASE_URL e AUTH_SECRET
npm run db:migrate          # applica le migrazioni al database di sviluppo
npm run dev                 # http://localhost:3000
```

Con `EMAIL_TRANSPORT=console` (default in sviluppo) il link di accesso compare nei log del server, invece che in una email.

### Test

```bash
npm test                    # unit test + test di integrazione dello schema
npm run typecheck
npm run lint
```

I test di integrazione usano `TEST_DATABASE_URL`. Non girano se la variabile manca o punta allo stesso database di `DATABASE_URL`: la suite cancella dati. Prima del primo run:

```bash
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
```

## Variabili d'ambiente

Vedi `.env.example`. Le variabili vengono validate all'avvio del server (`src/instrumentation.ts`): una configurazione non valida blocca il server con un messaggio chiaro.

| Variabile | Obbligatoria | Note |
|---|---|---|
| `DATABASE_URL` | sì | PostgreSQL |
| `AUTH_SECRET` | sì | almeno 32 caratteri, `openssl rand -base64 48` |
| `APP_URL`, `AUTH_URL` | no | URL pubblico; deve coincidere in produzione |
| `EMAIL_TRANSPORT` | no | `console` (solo sviluppo) o `smtp` |
| `SMTP_URL`, `EMAIL_FROM` | con `smtp` | es. `smtps://utente:password@smtp.tuodominio.it:465` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | vanno impostate insieme |

In produzione `EMAIL_TRANSPORT=console` non è ammesso: i link di accesso non devono finire nei log.

## Struttura

```
prisma/                 schema e migrazioni
src/app/                route Next.js (accesso, dashboard, health check, API Auth.js)
src/server/config/      validazione dell'ambiente (Zod)
src/server/auth/        Data Access Layer: controllo della sessione e del ruolo sul database
src/server/email/       invio dei link di accesso (console o SMTP)
src/auth.ts             configurazione Auth.js
tests/                  unit test e test di integrazione
```

## Sicurezza (stato attuale)

- Le sessioni sono a database: la revoca e il blocco di un account hanno effetto alla richiesta successiva.
- Il link di accesso vale 24 ore e una sola volta.
- Il ruolo e lo stato di blocco vengono letti dal database a ogni richiesta, mai dal solo cookie.
- Le dipendenze di produzione risultano senza vulnerabilità note (`npm audit --omit=dev`). Restano 5 vulnerabilità ad alta gravità negli strumenti di lint (`braces`, senza correzione pubblicata): non finiscono nel runtime.

## Health check

`GET /api/health` restituisce `200` con `{"status":"ok"}` quando il database risponde, altrimenti `503`.
