# Cantastorie AI: Scrittura & Narrazione

Un'applicazione web innovativa che trasforma le tue immagini in storie avvincenti, offrendo un set completo di strumenti basati sull'intelligenza artificiale per scrivere, affinare, illustrare e narrare le tue creazioni.

![Screenshot dell'editor di Cantastorie AI](public/screenshot-editor.png)

## ✨ Caratteristiche Principali

- **Da Immagine a Storia**: Carica un'immagine, scegli un genere e l'IA genererà un incipit avvincente basato sull'atmosfera, i colori e i soggetti presenti.
- **Sviluppo Interattivo**: Non sei mai bloccato. Fai **continuare** la storia all'IA, aggiungi un **colpo di scena** inaspettato o chiedile di scrivere una **conclusione** soddisfacente.
- **AI Writing Coach**: Un chatbot integrato che conosce il contesto della tua storia. Chiedigli consigli, feedback sui personaggi, suggerimenti sulla trama e applica le sue proposte direttamente al testo.
- **Affinamento della Prosa**: Migliora la qualità della scrittura con un clic. L'IA analizza e riscrive la storia per migliorarne il ritmo, le descrizioni e lo stile, mantenendo la trama originale.
- **Illustrazioni Guidate dall'IA**: Genera illustrazioni uniche per ogni paragrafo. L'IA si basa sull'immagine originale per mantenere uno stile artistico coerente.
- **Narrazione Audio**: Ascolta la tua storia letta ad alta voce da una voce narrante generata dall'IA. Puoi anche scaricare il file audio in formato `.wav`.
- **Esportazione in HTML**: Esporta la tua storia completa, incluse le immagini e il player audio, in un singolo file HTML stilizzato in base al genere scelto.
- **Archivio Permanente**: Salva le tue storie in un archivio personale basato su IndexedDB. Le tue creazioni sono al sicuro nel tuo browser, pronte per essere riprese in qualsiasi momento.

## 🚀 Come Funziona

1.  **Carica un'Immagine**: Scegli un'immagine dal tuo dispositivo che ispiri una storia.
2.  **Definisci il Contesto**: Seleziona un genere (Fantasy, Sci-Fi, Horror, etc.) e aggiungi dettagli opzionali come tema, personaggi e luogo.
3.  **Genera**: L'IA scrive il primo paragrafo della tua storia.
4.  **Crea e Modifica**: Usa gli strumenti a disposizione per continuare la narrazione, rigenerare parti di testo, inserire colpi di scena o illustrare i paragrafi.
5.  **Salva e Gestisci**: Salva la tua opera nell'archivio per non perdere i progressi. Ricaricala in seguito per continuare a modificarla.

## 📸 Galleria

| Editor Principale                                       | Archivio Storie Personale                               |
| ------------------------------------------------------- | ------------------------------------------------------- |
| ![Screenshot dell'editor](public/screenshot-editor.png) | ![Screenshot dell'archivio](public/screenshot-archive.png) |
| _L'interfaccia di scrittura con tutti gli strumenti._     | _L'archivio dove ogni storia è salvata e consultabile._ |

## 🛠️ Stack Tecnologico

-   **Frontend**: React, TypeScript, Tailwind CSS
-   **Intelligenza Artificiale**: Google Gemini API (modelli `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-image`, `gemini-2.5-flash-preview-tts`)
-   **Archiviazione Locale**: IndexedDB per un salvataggio permanente e robusto nel browser.

## ⚙️ Setup Locale

Per eseguire questo progetto in locale, segui questi passaggi:

1.  **Clona il repository**:
    ```bash
    git clone https://github.com/tuo-username/cantastorie-ai.git
    cd cantastorie-ai
    ```

2.  **Crea un file `.env`**:
    Nella directory principale del progetto, crea un file chiamato `.env` e aggiungi la tua chiave API di Google Gemini:
    ```
    API_KEY=LA_TUA_CHIAVE_API_QUI
    ```

3.  **Installa le dipendenze e avvia**:
    Questo progetto è configurato per funzionare direttamente da un file `index.html` con dipendenze caricate tramite CDN. Per un'esperienza di sviluppo ottimale, puoi servirlo tramite un semplice server locale. Se hai Node.js installato:
    ```bash
    # Installa un server statico come 'serve'
    npm install -g serve

    # Avvia il server nella cartella del progetto
    serve .
    ```
    Apri il browser e naviga all'indirizzo fornito (solitamente `http://localhost:3000`).

---

Sviluppato con passione per dare vita alla creatività.
