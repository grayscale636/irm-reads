import { Router, Response } from 'express';
import { pool } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getPagesContext, searchRelevantChunks, getAllCharacters } from '../lib/qdrant';

const router = Router();
router.use(authMiddleware);

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  user_id: string;
  book_id: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/ai/chats/:bookId
 * Returns the saved chat session for a book
 */
router.get('/chats/:bookId', async (req: AuthRequest, res: Response) => {
  try {
    const { bookId } = req.params;
    const result = await pool.query(
      `SELECT id, user_id, book_id, messages, created_at::text, updated_at::text
       FROM ai_chats
       WHERE user_id = $1 AND book_id = $2`,
      [req.userId, bookId]
    );

    if (result.rows.length === 0) {
      res.json({ messages: [] });
      return;
    }

    const session = result.rows[0] as ChatSession;
    res.json({ id: session.id, messages: session.messages });
  } catch (error) {
    console.error('Get chat session error:', error);
    res.status(500).json({ error: 'Gagal mengambil sesi chat' });
  }
});

/**
 * DELETE /api/ai/chats/:bookId
 * Clear chat history for a book
 */
router.delete('/chats/:bookId', async (req: AuthRequest, res: Response) => {
  try {
    const { bookId } = req.params;
    await pool.query(
      `DELETE FROM ai_chats WHERE user_id = $1 AND book_id = $2`,
      [req.userId, bookId]
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Delete chat session error:', error);
    res.status(500).json({ error: 'Gagal menghapus sesi chat' });
  }
});

/**
 * POST /api/ai/discuss
 * Body: { bookId: string, message: string }
 *
 * Acts as a story reminder — helps the reader recall what happened so far
 * based on the book's PDF content (from Qdrant) up to pagesRead.
 * Persists chat history to DB for session continuity.
 */
router.post('/discuss', async (req: AuthRequest, res: Response) => {
  try {
    const { bookId, message } = req.body;
    if (!bookId || !message?.trim()) {
      res.status(400).json({ error: 'bookId and message are required' });
      return;
    }

    // 1. Fetch book info
    const bookResult = await pool.query(`
      SELECT id, title, author, status, pages_read, total_pages
      FROM books WHERE id = $1 AND user_id = $2
    `, [bookId, req.userId]);

    if (bookResult.rows.length === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const book = bookResult.rows[0];
    const pagesRead = book.pages_read ?? book.pagesRead ?? 0;
    const totalPages = book.total_pages ?? book.totalPages ?? 0;
    const pct = totalPages > 0 ? Math.round((pagesRead / totalPages) * 100) : 0;

    // 2. Check if this is a character listing query
    const charQueryPattern = /^(sebutkan|daftar|list|tolong sebutkan|apa aja|semua)\s.*(tokoh|karakter|pemeran|nama|orang)|(tokoh|karakter).*(apa|siapa|sebutkan|list)|(semua|daftar).*(karakter|tokoh)/i;
    const isCharacterListQuery = charQueryPattern.test(message.trim());

    // 3. Get PDF context from Qdrant (up to pagesRead — no spoilers)
    let pdfContext: string[] = [];
    if (book.status === 'reading' || book.status === 'completed') {
      try {
        if (isCharacterListQuery) {
          const characters = await getAllCharacters(bookId, pagesRead);
          if (characters.length > 0) {
            const charFormatted = characters
              .map((c, i) => `${i + 1}. **${c.name}** — muncul di halaman ${c.firstAppearance} (${c.frequency}x)`)
              .join('\n');
            pdfContext = [`=== DAFTAR TOKOH (sampai halaman ${pagesRead}) ===\n\nBerikut ${characters.length} tokoh yang tercatat:\n\n${charFormatted}\n\n\n(Catatan: AI bisa kasih detail tambahan per tokoh kalau ditanya lebih lanjut.)`];
          } else {
            pdfContext = [`(Belum ada data tokoh untuk buku ini hingga halaman ${pagesRead})`];
          }
        } else {
          const relevantChunks = await searchRelevantChunks(bookId, pagesRead, message, 5);
          if (relevantChunks.length > 0) {
            pdfContext = relevantChunks.map(c =>
              `[Halaman ${c.page} (relevansi: ${Math.round(c.score * 100)}%)]\n${c.text}`
            );
          } else {
            pdfContext = await getPagesContext(bookId, pagesRead, 5000);
          }
        }
      } catch (qdrantErr) {
        console.log('Qdrant not available:', (qdrantErr as Error).message);
      }
    }

    // 4. Fetch user notes for this book
    let notesContext = '';
    try {
      const notesResult = await pool.query(`
        SELECT text, created_at::text as "createdAt"
        FROM book_notes
        WHERE book_id = $1 AND user_id = $2
        ORDER BY created_at ASC
      `, [bookId, req.userId]);
      if (notesResult.rows.length > 0) {
        const notesFormatted = notesResult.rows
          .map((n, i) => `${i + 1}. ${n.text}`)
          .join('\n');
        notesContext = `\n=== CATATAN PEMBACA ===\n${notesFormatted}`;
      }
    } catch (noteErr) {
      console.log('Failed to fetch notes:', (noteErr as Error).message);
    }

    // 5. Load existing chat session from DB
    let historyMessages: Message[] = [];
    try {
      const sessionResult = await pool.query(
        `SELECT messages FROM ai_chats WHERE user_id = $1 AND book_id = $2`,
        [req.userId, bookId]
      );
      if (sessionResult.rows.length > 0) {
        historyMessages = sessionResult.rows[0].messages as Message[];
      }
    } catch (dbErr) {
      console.log('Failed to load chat session:', (dbErr as Error).message);
    }

    // 6. Build context block
    const statusLabels: Record<string, string> = {
      'reading': 'Sedang dibaca',
      'completed': 'Selesai',
      'want-to-read': 'Pengin dibaca',
      'paused': 'Dihentikan sementara',
      'dnf': 'Tidak dilanjutkan',
    };

    const contextParts: string[] = [
      `Judul: "${book.title}"`,
      `Penulis: ${book.author}`,
      `Status: ${statusLabels[book.status] || book.status}`,
    ];

    if (book.status !== 'want-to-read') {
      contextParts.push(`Progress: halaman ${pagesRead} dari ${totalPages} (${pct}%)`);
    }

    if (pdfContext.length > 0) {
      contextParts.push(`\n=== ISI BUKU YANG UDAH DIBACA (halaman 1-${pagesRead}) ===\n${pdfContext.join('\n\n')}`);
    } else {
      contextParts.push(`\n(Catatan: tidak ada isi buku yang tersedia untuk direkap.)`);
    }

    if (notesContext) {
      contextParts.push(notesContext);
    }

    const contextBlock = contextParts.join('\n');

    // SPOILER GUARD
    const spoilerGuard = book.status === 'completed'
      ? 'Buku ini SUDAH SELESAI dibaca. Boleh bahas seluruh isi buku.'
      : book.status === 'want-to-read'
      ? 'Buku ini BELUM PERNAH dibaca. JANGAN berpura-pura tahu isi buku.'
      : `BATAS SPOILER: halaman ${pagesRead} dari ${totalPages}. JANGAN SEBUT, BAHAS, atau BERI PETUNJUK apapun tentang kejadian, karakter, atau detail di luar halaman ${pagesRead}. INI MUTLAK.`;

    const systemPrompt =
`Kamu adalah "Bacain" — asisten pengingat cerita yang santai. Tugas kamu adalah membantu pembaca MENGINGAT KEMBALI apa yang sudah terjadi di buku yang mereka baca. BAHASA INDONESIA (campur Inggris dikit gapapa).

=== DATA BUKU ===
${contextBlock}
==================

### PERAN KAMU ###
Kamu adalah "pengingat cerita". Kalau pembaca lupa "siapa tokoh ini?" atau "apa yang terjadi sebelumnya?", kamu rekap dengan ringkas dari isi buku yang tersedia. Kamu BUKAN teman diskusi — kamu alat bantu ingatan.

### ⚠️ ATURAN ###

1. 🚫 SPOILER: ${spoilerGuard}

2. 🚫 JANGAN HALUSINASI: Cuma bicara dari konteks di atas. Kalau pembaca nanya sesuatu yang nggak ada di konteks, jangan dibuat-buat.

3. 🙋 BILANG TIDAK TAHU: "Maaf, saya nggak punya informasi cukup buat itu" atau "Saya nggak tau."

4. 📝 CATATAN PEMBACA: Kalau ada bagian "=== CATATAN PEMBACA ===" di atas, itu adalah catatan pribadi pembaca tentang buku ini. Kamu BOLEH dan HARUS merujuk catatan ini kalau relevan — ini sumber tambahan yang valid. Kalau pembaca nanya hal yang ada di catatannya, kasih tau!

6. 🎯 SINGKAT & PADAT: Rekap secukupnya aja. Nggak usah analisis berlebihan. Cukup "Oh ini, di halaman X terjadi Y."`;

    // 7. Call DeepSeek API with full history
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'AI tidak dikonfigurasi - hubungi admin' });
      return;
    }

    // Build messages: system + history + new user message
    const apiMessages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message },
    ];

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: apiMessages,
        temperature: 0.5,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error:', response.status, errText);
      res.status(502).json({ error: 'Gagal memproses pertanyaan. Coba lagi nanti.' });
      return;
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      res.status(502).json({ error: 'Gagal mendapatkan jawaban. Coba lagi.' });
      return;
    }

    // 8. Save to DB (upsert: user + book = unique)
    const updatedMessages: Message[] = [
      ...historyMessages,
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ];

    try {
      await pool.query(`
        INSERT INTO ai_chats (user_id, book_id, messages)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (user_id, book_id)
        DO UPDATE SET messages = $3::jsonb, updated_at = NOW()
      `, [req.userId, bookId, JSON.stringify(updatedMessages)]);
    } catch (saveErr) {
      console.log('Failed to save chat session:', (saveErr as Error).message);
    }

    res.json({ reply, messages: updatedMessages });

  } catch (error) {
    console.error('AI discuss error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan. Coba lagi nanti.' });
  }
});

/**
 * POST /api/ai/generate
 * Body: { bookId: string, mode: 'recap' | 'reflection' }
 *
 * One-shot draft generator (NOT saved to chat history). Uses the same
 * spoiler-safe RAG context + reader notes as /discuss, but returns a draft the
 * reader can edit:
 *   - recap:      concise chronological recap of what's happened so far.
 *   - reflection: a first-person reflection draft synthesized from the reader's
 *                 notes + reading, structured to match the reflection prompts.
 */
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { bookId, mode } = req.body;
    if (!bookId || (mode !== 'recap' && mode !== 'reflection')) {
      res.status(400).json({ error: "bookId and a valid mode ('recap'|'reflection') are required" });
      return;
    }

    // 1. Fetch book
    const bookResult = await pool.query(`
      SELECT id, title, author, status, pages_read, total_pages, rating
      FROM books WHERE id = $1 AND user_id = $2
    `, [bookId, req.userId]);

    if (bookResult.rows.length === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const book = bookResult.rows[0];
    const pagesRead = book.pages_read ?? 0;
    const totalPages = book.total_pages ?? 0;

    if (book.status === 'want-to-read') {
      res.status(400).json({ error: 'Buku ini belum mulai dibaca — belum ada yang bisa dirangkum.' });
      return;
    }

    // 2. Spoiler-safe book content. Completed books get everything; otherwise
    //    only up to the page the reader has reached.
    const maxPage = book.status === 'completed' ? Math.max(totalPages, pagesRead, 999999) : pagesRead;
    let pdfContext: string[] = [];
    try {
      pdfContext = await getPagesContext(bookId, maxPage, 8000);
    } catch (qdrantErr) {
      console.log('Qdrant not available:', (qdrantErr as Error).message);
    }

    // 3. Reader notes (the heart of a reflection draft)
    let notesContext = '';
    try {
      const notesResult = await pool.query(`
        SELECT text, note_type, page_ref
        FROM book_notes
        WHERE book_id = $1 AND user_id = $2
        ORDER BY COALESCE(page_ref, 0) ASC, created_at ASC
      `, [bookId, req.userId]);
      if (notesResult.rows.length > 0) {
        const notesFormatted = notesResult.rows
          .map((n, i) => {
            const loc = n.page_ref ? ` (hal. ${n.page_ref})` : '';
            const kind = n.note_type && n.note_type !== 'note' ? `[${n.note_type}] ` : '';
            return `${i + 1}. ${kind}${n.text}${loc}`;
          })
          .join('\n');
        notesContext = `\n=== CATATAN PEMBACA ===\n${notesFormatted}`;
      }
    } catch (noteErr) {
      console.log('Failed to fetch notes:', (noteErr as Error).message);
    }

    if (mode === 'reflection' && !notesContext && pdfContext.length === 0) {
      res.status(400).json({ error: 'Belum ada catatan atau isi buku buat dijadiin bahan refleksi.' });
      return;
    }

    // 4. Build context + spoiler guard
    const pct = totalPages > 0 ? Math.round((pagesRead / totalPages) * 100) : 0;
    const contextParts: string[] = [
      `Judul: "${book.title}"`,
      `Penulis: ${book.author}`,
      `Progress: halaman ${pagesRead} dari ${totalPages} (${pct}%)`,
    ];
    if (pdfContext.length > 0) {
      contextParts.push(`\n=== ISI BUKU (halaman 1-${book.status === 'completed' ? totalPages : pagesRead}) ===\n${pdfContext.join('\n\n')}`);
    }
    if (notesContext) contextParts.push(notesContext);
    const contextBlock = contextParts.join('\n');

    const spoilerGuard = book.status === 'completed'
      ? 'Buku ini SUDAH SELESAI dibaca. Boleh bahas seluruh isi buku.'
      : `BATAS SPOILER: halaman ${pagesRead}. JANGAN sebut atau beri petunjuk apapun di luar halaman ${pagesRead}. INI MUTLAK.`;

    const systemPrompt = mode === 'recap'
      ? `Kamu adalah "Bacain" — asisten pengingat cerita. Buatkan RANGKUMAN singkat dari apa yang sudah terjadi di buku ini, buat bantu pembaca inget jalan cerita sebelum lanjut baca.

=== DATA BUKU ===
${contextBlock}
==================

### ATURAN ###
1. 🚫 SPOILER: ${spoilerGuard}
2. 🚫 JANGAN HALUSINASI: cuma dari konteks di atas. Kalau isinya tipis, rangkum seadanya, jangan ngarang.
3. 📝 Format: paragraf ringkas atau poin-poin kronologis. Bahasa Indonesia santai.
4. 🎯 Maksimal ~200 kata. Ini catatan pengingat, bukan esai.
5. Langsung isi rangkumannya aja, tanpa kalimat pembuka macam "Berikut rangkumannya".`
      : `Kamu adalah "Bacain" — asisten jurnal baca. Buatkan DRAFT REFLEKSI pribadi (sudut pandang pembaca, pakai "aku") berdasarkan CATATAN PEMBACA dan isi buku di bawah. Ini draft yang nanti diedit sendiri sama pembaca — jadi jujur, personal, dan grounded ke catatannya.

=== DATA BUKU ===
${contextBlock}
==================

### ATURAN ###
1. 🚫 SPOILER: ${spoilerGuard}
2. 🚫 JANGAN NGARANG opini yang nggak ada di catatan/isi buku. Kalau catatan tipis, tetep singkat & jujur.
3. Utamakan CATATAN PEMBACA sebagai bahan utama — refleksi ini punya dia, bukan review umum.
4. Bahasa Indonesia santai, sudut pandang orang pertama ("aku").
5. WAJIB output PERSIS dalam format markdown ini, pakai heading ini apa adanya:

**Yang paling nempel**
<1-3 kalimat>

**Rekomendasiin ke**
<1-2 kalimat, buat siapa buku ini cocok>

**Alasan rating**
<1-2 kalimat soal kenapa buku ini berkesan / kurang; kalau ada rating ${book.rating || 0}/5 boleh disinggung>

Jangan tambah heading lain, jangan ada kalimat pembuka/penutup di luar tiga bagian itu.`;

    // 5. Call DeepSeek (one-shot, no history, not persisted)
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'AI tidak dikonfigurasi - hubungi admin' });
      return;
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: mode === 'recap'
            ? 'Tolong rangkum apa yang udah terjadi sejauh ini.'
            : 'Tolong bikin draft refleksiku buat buku ini.' },
        ],
        temperature: 0.6,
        max_tokens: 700,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API error:', response.status, errText);
      res.status(502).json({ error: 'Gagal membuat draft. Coba lagi nanti.' });
      return;
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const draft = data.choices?.[0]?.message?.content?.trim();

    if (!draft) {
      res.status(502).json({ error: 'Gagal membuat draft. Coba lagi.' });
      return;
    }

    res.json({ draft });

  } catch (error) {
    console.error('AI generate error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan. Coba lagi nanti.' });
  }
});

export default router;
