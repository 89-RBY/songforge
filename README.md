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

## Generazione delle canzoni (fase b)

Il flusso è asincrono. L'app web accoda un job nella tabella `Job` di PostgreSQL. Un worker separato lo prende con `FOR UPDATE SKIP LOCKED`, chiama il provider musicale, salva l'audio nello storage e aggiorna la canzone.

```bash
npm run worker              # in un secondo terminale, accanto a npm run dev
```

Endpoint (tutti richiedono la sessione):

| Metodo | Percorso | Cosa fa |
|---|---|---|
| `GET` | `/api/providers` | provider attivi, durate supportate e costo stimato in centesimi |
| `POST` | `/api/songs` | crea una canzone: `{ prompt, lyrics?, instrumental?, durationMode: "CLIP" \| "SONG", providerId }` |
| `GET` | `/api/songs/{id}` | stato e dettagli (solo del proprietario) |
| `GET` | `/api/songs/{id}/audio` | audio della canzone pronta (solo del proprietario) |

Stati di una canzone: `QUEUED` → `GENERATING` → `READY` oppure `FAILED`. Gli errori transitori (rate limit, timeout, rete) vengono ritentati con backoff; `BLOCKED` no.

Provider:

- **Lyria** (`GEMINI_API_KEY`): modelli `lyria-3.5` per i brani e `lyria-3-clip-preview` per le clip da 30 secondi.
- **Mock** (`MOCK_PROVIDER=true`): genera un WAV di prova senza chiamare nessun servizio. Non è ammesso in produzione.

Storage: `STORAGE_DRIVER=local` salva in `STORAGE_LOCAL_DIR`; `s3` usa un bucket S3-compatibile (Cloudflare R2 o altro).

Limiti: una utente può avere al massimo due canzoni in lavorazione. Un prompt che nomina un artista reale viene rifiutato (`MODERATION_BLOCKED`).

## Crediti e pagamenti (fase e)

- Ogni generazione costa crediti: costo del modello × moltiplicatore (2,5), arrotondato per eccesso a crediti da 10 centesimi. Con i prezzi Lyria attuali (4 centesimi la clip, 8 la canzone) una clip costa 1 credito e una canzone 2. Impostazioni provvisorie, da confermare.
- Il saldo è in `User.creditBalance`; ogni variazione passa dalla tabella `CreditEntry` (registro append-only) nella stessa transazione, con il blocco della riga utente. Un saldo non può andare sotto zero, anche con richieste parallele.
- Addebito alla creazione della canzone. Se la generazione fallisce in modo definitivo (anche per rifiuto del modello), i crediti vengono restituiti nella stessa transazione. Durante i tentativi automatici non c'è rimborso né addebito aggiuntivo.
- Bonus di benvenuto: 10 crediti alla prima registrazione (`signupCredits`).
- Pacchetti provvisori: 25 crediti a 2,50 €, 100 a 9 €, 400 a 30 €. Prezzi in euro.
- Pagamenti: Stripe Checkout, pagamento unico in EUR. Il webhook `POST /api/stripe/webhook` accredita i crediti su `checkout.session.completed` (e `checkout.session.async_payment_succeeded`) solo con firma valida. Ogni sessione Stripe vale una sola volta (`referenceKey = stripe:<session>`), quindi le consegne ripetute non duplicano i crediti.

### Configurazione Stripe (modalità test)

1. Crea un account Stripe e attiva la modalità test.
2. Copia la chiave segreta di test (`sk_test_...`) in `STRIPE_SECRET_KEY`.
3. Crea un endpoint webhook su `APP_URL/api/stripe/webhook` con gli eventi `checkout.session.completed` e `checkout.session.async_payment_succeeded`.
4. Copia il "Signing secret" (`whsec_...`) in `STRIPE_WEBHOOK_SECRET`. Le due variabili vanno impostate insieme.
5. Per provare un acquisto usa la carta di test `4242 4242 4242 4242`, qualsiasi data futura e qualsiasi CVC.

Senza queste variabili la pagina crediti mostra gli acquisti come non disponibili e il webhook risponde 503.

### Sviluppo senza costi

Con `MOCK_PROVIDER=true` il modello di prova è gratuito. Imposta `MOCK_COST_CENTS=4` per simulare il costo di una clip e provare gli addebiti e i rimborsi senza chiamare il servizio reale.

### Stato della verifica

- Verificato automaticamente: ledger con concorrenza e idempotenza, addebito e rimborso delle canzoni, firma e doppia consegna dei webhook, parametri del checkout, E2E nel browser con webhook firmati in locale.
- Non verificato: un checkout reale con Stripe. La sandbox di sviluppo non raggiunge `api.stripe.com`, quindi il flusso completo va provato in modalità test prima di attivare i pagamenti reali.

## Amministrazione (fase f)

- Area: `/{locale}/admin`. Chi non è amministratore non vede contenuto dell'area; per le pagine protette la risposta HTTP è un reindirizzamento o una pagina 404 inviata nello stream (limite di Next.js con il rendering in streaming, da non confondere con l'accesso ai dati, che non avviene mai).
- Panoramica: canzoni create, completate e non riuscite, utenti attivi e totali, ricavi, costo API, margine lordo, crediti venduti e spesi, spesa API del giorno rispetto al tetto, errori degli ultimi 7 giorni. Ricavi e costi sono stime, al netto di IVA e commissioni.
- Utenti: ricerca per email o nome, dettaglio con blocco e sblocco, rettifica manuale dei crediti (registrata nel registro con il motivo). Non puoi bloccare il tuo account.
- Impostazioni: moltiplicatore, valore del credito, crediti di benvenuto, tetto giornaliero, prezzi dei pacchetti e modelli disattivabili. Le modifiche non cambiano gli addebiti già fatti.
- Errori: ultime 100 canzoni non riuscite, con codice e messaggio. Il testo del prompt non viene mostrato.
- Ogni azione dell'amministratore finisce nella tabella `AuditLog` (chi, cosa, quando).

### Promuovere un amministratore

L'utente deve aver già effettuato l'accesso almeno una volta. Poi, dal server (o dal terminale con le stesse variabili d'ambiente):

```bash
npm run admin:promote -- utente@tuodominio.it          # concede il ruolo
npm run admin:promote -- --revoke utente@tuodominio.it  # lo rimuove
```

Lo script non è esposto da nessuna pagina: chi può eseguirlo ha accesso al database.

## Sicurezza, limiti e conformità (fase g)

- Limiti di richiesta su database (`RateLimit`), a finestra fissa e in una sola istruzione atomica: creazione canzoni e rigenerazioni (20 l'ora per utente, 60 l'ora per indirizzo IP), testi (30 l'ora per utente), checkout (10 l'ora per utente), link di accesso (5 ogni 15 minuti per email, 20 per indirizzo IP). Risposta `429` con `Retry-After`. I contatori scaduti vengono cancellati dal worker dopo 24 ore.
- Indirizzo IP: il limite per IP usa l'ultimo indirizzo aggiunto dal proxy (`X-Forwarded-For`) e richiede `TRUST_PROXY=true` dietro Caddy. Senza proxy fidato il limite per IP è disattivato, invece di condividere un unico contatore tra tutti i visitatori.
- Tetto giornaliero di spesa API (`dailyApiCapCents`, nelle impostazioni admin): le canzoni a pagamento oltre il tetto non vengono create fino al giorno successivo (UTC). `0` significa nessun tetto.
- Moderazione a due livelli: lista locale di artisti reali, poi, se è impostata `ANTHROPIC_API_KEY`, una verifica con un modello che classifica imitazioni di artisti, odio, contenuti sessuali con minori e violenza esplicita. Se la verifica non risponde la canzone non viene creata (`MODERATION_UNAVAILABLE`). Senza chiave resta solo il primo livello. La verifica dipende dal modello e può sbagliare: non è una garanzia assoluta.
- Account: esportazione dei dati in JSON (profilo, canzoni senza audio, movimenti di crediti) e cancellazione con conferma dell'email. La cancellazione rimuove audio e canzoni e lascia i movimenti di crediti senza collegamento al profilo.
- Cookie: solo cookie tecnici (sessione, protezione dei moduli, lingua). Il banner ricorda questo e salva la chiusura nel browser, senza cookie.
- Termini e privacy: bozze in `src/content/legal.ts` (italiano e inglese; le altre lingue mostrano l'inglese con un avviso). Le parti tra parentesi quadre vanno completate e verificate da un professionista prima della pubblicazione.

## Deploy (fase g)

Serve un VPS Linux con Docker e Docker Compose. Su Hostinger va scelto un piano VPS: il hosting condiviso non può eseguire Postgres e il worker in modo continuo. Serve anche un dominio il cui record A punta al server.

Il file `docker-compose.yml` avvia cinque servizi: database Postgres, migrazioni (`prisma migrate deploy`, una volta sola), app web, worker e Caddy, che ottiene il certificato HTTPS.

1. Sul server: clona il repository, poi `cp .env.example .env.production` e compila almeno `APP_DOMAIN`, `APP_URL` e `AUTH_URL` (https://…), `AUTH_SECRET` (`openssl rand -base64 48`), `POSTGRES_PASSWORD`, `EMAIL_TRANSPORT="smtp"` con `SMTP_URL` ed `EMAIL_FROM`, `MOCK_PROVIDER="false"` con `GEMINI_API_KEY`. `DATABASE_URL` e `TRUST_PROXY` li imposta già il file compose.
2. `docker compose config` per controllare la sintassi, poi `docker compose up -d --build`.
3. Controlla `https://<dominio>/api/health` e `docker compose logs -f worker`.
4. Registrati una volta con la tua email, poi rendila amministratore: `docker compose exec app npm run admin:promote -- tua@email`.
5. Stripe, modalità test: crea un endpoint su `https://<dominio>/api/stripe/webhook` con gli eventi `checkout.session.completed` e `checkout.session.async_payment_succeeded`. Copia il secret in `STRIPE_WEBHOOK_SECRET` e `STRIPE_SECRET_KEY` (`sk_test_…`), poi `docker compose up -d app worker`. Prova un acquisto con la carta `4242 4242 4242 4242`.
6. Prima di passare alle chiavi live: testi legali verificati, prezzi confermati, scelta dei dati fiscali. L'app non emette fatture.

Backup, da pianificare con cron: `docker compose exec -T db pg_dump -U songforge songforge > backup-$(date +%F).sql`, più una copia del volume `audio` (le canzoni sono lì). Aggiornamento: `git pull && docker compose up -d --build`; le migrazioni girano prima dell'avvio.

### Non verificato in questo ambiente

- Dockerfile, `docker-compose.yml` e Caddyfile non sono stati eseguiti: nel sandbox di sviluppo non c'è un demone Docker. Il primo avvio va fatto sul server, con `docker compose config` e i log.
- L'audio è su un volume locale: per più server o per non dipendere dal disco del VPS serve `STORAGE_DRIVER="s3"` con Cloudflare R2 o un altro storage compatibile.
- Gli account Google e Stripe reali, l'invio SMTP reale e la chiamata a Lyria non sono stati provati: vanno verificati in modalità test prima del lancio.
