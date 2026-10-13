// Draft legal texts. They are NOT final: a lawyer must check them before the service goes live.
// Text in [square brackets] is a placeholder or a point to confirm. Only Italian and English are written;
// other languages show the English text with a notice (see legalFor).
import type { Locale } from "@/i18n/routing";

export type LegalSection = { heading: string; paragraphs: string[] };
export type LegalDocument = { title: string; sections: LegalSection[] };
export type LegalLanguage = "it" | "en";

export const LEGAL_UPDATED = "2026-10-13";

export const LEGAL: Record<LegalLanguage, { terms: LegalDocument; privacy: LegalDocument }> = {
  it: {
    terms: {
      title: "Termini di servizio",
      sections: [
        {
          heading: "1. Oggetto",
          paragraphs: [
            "Questi termini regolano l'uso di SongForge, il servizio che crea canzoni con l'intelligenza artificiale a partire dalle tue indicazioni. Usando il servizio li accetti.",
          ],
        },
        {
          heading: "2. Il servizio",
          paragraphs: [
            "SongForge invia la tua richiesta a modelli di intelligenza artificiale di terze parti (oggi Google Lyria per la musica e un modello di Anthropic per i testi) e conserva il risultato nella tua libreria.",
            "Il servizio può cambiare nel tempo. La disponibilità dei modelli non è garantita: se un modello non è disponibile, la richiesta può non andare a buon fine.",
          ],
        },
        {
          heading: "3. Account",
          paragraphs: [
            "Accedi con un link inviato alla tua email, o con Google quando è disponibile. Sei responsabile di quanto avviene con il tuo account.",
            "[Età minima da confermare: in Italia il consenso digitale è valido dai 14 anni.]",
          ],
        },
        {
          heading: "4. Crediti e pagamenti",
          paragraphs: [
            "Le canzoni si pagano con crediti. Il prezzo dei pacchetti e il valore di un credito sono indicati nella pagina Crediti.",
            "Un credito viene addebitato quando una canzone entra in coda. Se la generazione non riesce in modo definitivo, i crediti vengono restituiti.",
            "Salvo questo caso, i crediti acquistati non sono rimborsabili, nei limiti previsti dalla legge per i contenuti digitali [da confermare con un professionista]. I crediti non sono denaro e non si trasferiscono ad altri account.",
          ],
        },
        {
          heading: "5. Canzoni create",
          paragraphs: [
            "Le canzoni sono generate dall'intelligenza artificiale a partire dalla tua descrizione. Sei responsabile del loro uso: non devono violare diritti di terzi, marchi o diritti d'autore.",
            "Quando pubblichi un brano, dichiara che è stato generato con intelligenza artificiale. Non garantiamo che un brano sia originale o registrabile.",
          ],
        },
        {
          heading: "6. Uso consentito",
          paragraphs: [
            "Non puoi chiedere canzoni che imitino o citino artisti reali; che contengano odio, molestie o minacce; che abbiano contenuti sessuali con minori o allusioni a minori; che descrivano violenza esplicita; che diffondano dati personali di terzi.",
            "Possiamo rifiutare richieste, sospendere account ed eliminare contenuti in caso di violazione.",
          ],
        },
        {
          heading: "7. Condivisione",
          paragraphs: [
            "Il link pubblico di una canzone mostra solo titolo e audio. Puoi revocarlo in qualsiasi momento dalla libreria.",
          ],
        },
        {
          heading: "8. Conservazione dell'audio",
          paragraphs: [
            "L'audio è conservato per [90] giorni dalla generazione e poi rimosso. La canzone resta in libreria senza audio, e puoi rigenerarla con un nuovo addebito.",
          ],
        },
        {
          heading: "9. Cancellazione dell'account",
          paragraphs: [
            "Puoi eliminare l'account dalla pagina Account. L'operazione rimuove le canzoni e l'audio. Alcuni dati restano per obblighi di legge, come descritto nell'informativa privacy.",
          ],
        },
        {
          heading: "10. Responsabilità",
          paragraphs: [
            "Il servizio è fornito così com'è. Nei limiti consentiti dalla legge, la nostra responsabilità è limitata all'importo dei crediti acquistati nei dodici mesi precedenti.",
            "Non limitiamo i diritti che la legge riconosce ai consumatori.",
          ],
        },
        {
          heading: "11. Legge applicabile",
          paragraphs: [
            "Si applica la legge italiana. Per i consumatori resta competente il foro del luogo di residenza [da confermare].",
          ],
        },
        {
          heading: "12. Modifiche e contatti",
          paragraphs: [
            "Possiamo aggiornare questi termini e ti avviseremo via email delle modifiche sostanziali. Per domande: [email di contatto].",
          ],
        },
      ],
    },
    privacy: {
      title: "Informativa privacy",
      sections: [
        {
          heading: "1. Titolare del trattamento",
          paragraphs: ["[Nome o ragione sociale], [indirizzo], [partita IVA], [email di contatto]."],
        },
        {
          heading: "2. Dati che trattiamo",
          paragraphs: [
            "Email (per l'accesso), nome e immagine del profilo se accedi con Google.",
            "Dati del servizio: canzoni create, descrizioni e testi che inserisci, stato delle generazioni, movimenti di crediti.",
            "Pagamenti: li gestisce interamente Stripe. Non vediamo né conserviamo il numero della carta.",
            "Dati di sicurezza: contatori di richieste per account e per indirizzo IP, cancellati entro 24 ore, e registro delle azioni dell'amministrazione.",
          ],
        },
        {
          heading: "3. Finalità e basi giuridiche",
          paragraphs: [
            "Fornire il servizio e gestire il tuo account: esecuzione del contratto (art. 6.1.b GDPR).",
            "Prevenire abusi e proteggere il servizio: interesse legittimo (art. 6.1.f GDPR).",
            "Adempimenti fiscali e contabili: obbligo di legge (art. 6.1.c GDPR).",
            "Email di servizio, come i link di accesso: esecuzione del contratto.",
          ],
        },
        {
          heading: "4. Fornitori (destinatari dei dati)",
          paragraphs: [
            "Hosting, database e storage degli audio: [fornitore e sede dei server].",
            "Stripe, per i pagamenti. Google, per i modelli musicali Lyria. Anthropic, per la generazione dei testi e la verifica dei contenuti. Un fornitore di posta, per i link di accesso.",
            "Alcuni fornitori possono trattare dati fuori dall'Unione europea: [da verificare con i contratti e le clausole contrattuali standard].",
          ],
        },
        {
          heading: "5. Contenuti inviati ai modelli",
          paragraphs: [
            "Le descrizioni e i testi che scrivi vengono inviati ai fornitori di intelligenza artificiale per creare la canzone e per verificarne il contenuto. Non inserire dati personali di terzi né informazioni sensibili.",
          ],
        },
        {
          heading: "6. Tempi di conservazione",
          paragraphs: [
            "Account e canzoni: fino alla cancellazione dell'account.",
            "Audio: [90] giorni dalla generazione.",
            "Movimenti di crediti: [10] anni per obblighi fiscali, senza più un collegamento diretto al profilo dopo la cancellazione.",
            "Contatori di richieste: 24 ore. Registro delle azioni dell'amministrazione: [12] mesi [da confermare].",
          ],
        },
        {
          heading: "7. I tuoi diritti",
          paragraphs: [
            "Hai diritto di accedere ai tuoi dati, rettificarli, cancellarli, limitarne il trattamento, portarli via e opporti al trattamento.",
            "Puoi scaricare i tuoi dati dalla pagina Account ed eliminare l'account in qualsiasi momento. Per altre richieste scrivi a [email di contatto]. Hai diritto di proporre reclamo al Garante per la protezione dei dati personali.",
          ],
        },
        {
          heading: "8. Cookie e memoria del browser",
          paragraphs: [
            "Usiamo solo cookie tecnici e necessari: il cookie di sessione per restare collegato, quello di protezione dei moduli e quello della lingua. Non usiamo cookie di profilazione, analitici o pubblicitari, quindi non serve un consenso.",
            "Il banner informativo ricorda questo. La sua chiusura viene salvata nel browser, senza cookie.",
          ],
        },
        {
          heading: "9. Sicurezza",
          paragraphs: [
            "Le chiavi dei fornitori restano solo sui nostri server. L'accesso avviene con link, senza password. Le connessioni sono cifrate e l'accesso ai dati è limitato a chi ne ha bisogno.",
          ],
        },
        {
          heading: "10. Minori",
          paragraphs: ["Il servizio non è rivolto a minori sotto l'età prevista dalla legge per il consenso digitale [da confermare]."],
        },
        {
          heading: "11. Modifiche",
          paragraphs: ["Possiamo aggiornare questa informativa. La data di aggiornamento è indicata in cima alla pagina."],
        },
      ],
    },
  },
  en: {
    terms: {
      title: "Terms of service",
      sections: [
        {
          heading: "1. Scope",
          paragraphs: [
            "These terms govern the use of SongForge, a service that creates songs with artificial intelligence from your instructions. By using the service you accept them.",
          ],
        },
        {
          heading: "2. The service",
          paragraphs: [
            "SongForge sends your request to third-party AI models (today Google Lyria for music, and a model from Anthropic for lyrics) and keeps the result in your library.",
            "The service may change over time. Model availability is not guaranteed: if a model is unavailable, a request may fail.",
          ],
        },
        {
          heading: "3. Account",
          paragraphs: [
            "You sign in with a link sent to your email, or with Google where available. You are responsible for what happens in your account.",
            "[Minimum age to confirm: the age for digital consent depends on the country.]",
          ],
        },
        {
          heading: "4. Credits and payments",
          paragraphs: [
            "Songs are paid with credits. Package prices and the value of a credit are shown on the Credits page.",
            "A credit is charged when a song is queued. If generation fails for good, the credits are returned.",
            "Apart from that case, purchased credits are not refundable, within the limits set by law for digital content [to be confirmed with a professional]. Credits are not money and cannot be transferred to other accounts.",
          ],
        },
        {
          heading: "5. Songs you create",
          paragraphs: [
            "Songs are generated by artificial intelligence from your description. You are responsible for how you use them: they must not infringe third-party rights, trademarks or copyright.",
            "When you publish a track, state that it was generated with artificial intelligence. We do not guarantee that a track is original or registrable.",
          ],
        },
        {
          heading: "6. Acceptable use",
          paragraphs: [
            "You may not request songs that imitate or name real artists; that contain hate, harassment or threats; that have sexual content involving minors or references to minors; that describe explicit violence; or that spread third-party personal data.",
            "We may refuse requests, suspend accounts and remove content in case of violation.",
          ],
        },
        {
          heading: "7. Sharing",
          paragraphs: ["A public link to a song shows only its title and audio. You can revoke it at any time from your library."],
        },
        {
          heading: "8. Audio retention",
          paragraphs: [
            "Audio is kept for [90] days after generation and then removed. The song stays in your library without audio, and you can generate it again with a new charge.",
          ],
        },
        {
          heading: "9. Deleting your account",
          paragraphs: [
            "You can delete your account from the Account page. This removes your songs and audio. Some data is kept where the law requires it, as described in the privacy notice.",
          ],
        },
        {
          heading: "10. Liability",
          paragraphs: [
            "The service is provided as is. To the extent permitted by law, our liability is limited to the amount of credits you bought in the previous twelve months.",
            "We do not limit the rights that the law grants to consumers.",
          ],
        },
        {
          heading: "11. Governing law",
          paragraphs: ["Italian law applies. For consumers, the courts of their place of residence remain competent [to be confirmed]."],
        },
        {
          heading: "12. Changes and contact",
          paragraphs: [
            "We may update these terms and will tell you by email about material changes. Questions: [contact email].",
          ],
        },
      ],
    },
    privacy: {
      title: "Privacy notice",
      sections: [
        {
          heading: "1. Data controller",
          paragraphs: ["[Name or company name], [address], [VAT number], [contact email]."],
        },
        {
          heading: "2. Data we process",
          paragraphs: [
            "Email (for sign-in), name and profile picture if you sign in with Google.",
            "Service data: songs you create, descriptions and lyrics you enter, generation status, credit movements.",
            "Payments: handled entirely by Stripe. We do not see or store your card number.",
            "Security data: request counters per account and per IP address, deleted within 24 hours, and a log of administrative actions.",
          ],
        },
        {
          heading: "3. Purposes and legal bases",
          paragraphs: [
            "Providing the service and managing your account: performance of a contract (art. 6.1.b GDPR).",
            "Preventing abuse and protecting the service: legitimate interest (art. 6.1.f GDPR).",
            "Tax and accounting obligations: legal obligation (art. 6.1.c GDPR).",
            "Service emails, such as sign-in links: performance of a contract.",
          ],
        },
        {
          heading: "4. Providers (recipients of data)",
          paragraphs: [
            "Hosting, database and audio storage: [provider and server location].",
            "Stripe, for payments. Google, for the Lyria music models. Anthropic, for lyrics generation and content checks. An email provider, for sign-in links.",
            "Some providers may process data outside the European Union: [to be checked against their contracts and standard contractual clauses].",
          ],
        },
        {
          heading: "5. Content sent to models",
          paragraphs: [
            "The descriptions and lyrics you write are sent to AI providers to create the song and to check its content. Do not enter third parties' personal data or sensitive information.",
          ],
        },
        {
          heading: "6. Retention",
          paragraphs: [
            "Account and songs: until you delete your account.",
            "Audio: [90] days after generation.",
            "Credit movements: [10] years for tax obligations, no longer linked to your profile after deletion.",
            "Request counters: 24 hours. Log of administrative actions: [12] months [to be confirmed].",
          ],
        },
        {
          heading: "7. Your rights",
          paragraphs: [
            "You have the right to access, correct, erase, restrict, port and object to the processing of your data.",
            "You can download your data from the Account page and delete your account at any time. For other requests, write to [contact email]. You have the right to lodge a complaint with the supervisory authority (in Italy, the Garante per la protezione dei dati personali).",
          ],
        },
        {
          heading: "8. Cookies and browser storage",
          paragraphs: [
            "We use only technical, strictly necessary cookies: the session cookie to keep you signed in, the form-protection cookie and the language cookie. We use no profiling, analytics or advertising cookies, so no consent is needed.",
            "The notice banner says so. Dismissing it is stored in your browser, without a cookie.",
          ],
        },
        {
          heading: "9. Security",
          paragraphs: [
            "Provider keys stay on our servers only. Sign-in uses links, so there are no passwords. Connections are encrypted and access to data is limited to those who need it.",
          ],
        },
        {
          heading: "10. Minors",
          paragraphs: ["The service is not directed at children below the age set by law for digital consent [to be confirmed]."],
        },
        {
          heading: "11. Changes",
          paragraphs: ["We may update this notice. The update date is shown at the top of the page."],
        },
      ],
    },
  },
};

// Italian and English are written. Other languages read the English text, with a notice in their own language.
export function legalFor(locale: Locale): { language: LegalLanguage; fallback: boolean } {
  if (locale === "it") return { language: "it", fallback: false };
  if (locale === "en") return { language: "en", fallback: false };
  return { language: "en", fallback: true };
}
