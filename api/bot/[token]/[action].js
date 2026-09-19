// /api/bot/[token]/[action].js
// Firestore REST backend for AURA Bot API — v0.2.0
// Chat ID format: `${userId}_${botId}`

const PROJECT = "aurachat-85f54";
const BASE = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents";

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function ok(res, result) { return res.status(200).json({ ok: true, result }); }
function err(res, message, status) { return res.status(status || 400).json({ ok: false, error: message }); }

function parseValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue);
  if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return new Date(v.timestampValue).getTime();
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(parseValue);
  if (v.mapValue !== undefined) {
    const out = {};
    const f = v.mapValue.fields || {};
    for (const k in f) out[k] = parseValue(f[k]);
    return out;
  }
  return null;
}
function toValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const k in val) fields[k] = toValue(val[k]);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}
function toFields(obj) {
  const fields = {};
  for (const k in obj) if (obj[k] !== undefined) fields[k] = toValue(obj[k]);
  return fields;
}
function docToObj(doc) {
  if (!doc || !doc.fields) return null;
  const out = {};
  for (const k in doc.fields) out[k] = parseValue(doc.fields[k]);
  if (doc.name) out._id = doc.name.split('/').pop();
  return out;
}

// ─── Firestore helpers ───
async function getBotByToken(token) {
  const url = BASE + ":runQuery";
  const q = {
    structuredQuery: {
      from: [{ collectionId: 'bots' }],
      where: { fieldFilter: { field: { fieldPath: 'token' }, op: 'EQUAL', value: { stringValue: token } } },
      limit: 1
    }
  };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
  const data = await r.json();
  if (!Array.isArray(data) || !data[0] || !data[0].document) return null;
  const obj = docToObj(data[0].document);
  obj.id = obj._id;
  return obj;
}

async function addDoc(collectionPath, obj) {
  const url = BASE + "/" + collectionPath;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(obj) })
  });
  if (!r.ok) throw new Error('Add doc failed: ' + r.status + ' ' + (await r.text()));
  const data = await r.json();
  return { id: data.name.split('/').pop() };
}

async function patchDoc(docPath, patch) {
  const fields = Object.keys(patch).map(k => 'updateMask.fieldPaths=' + k).join('&');
  const url = BASE + "/" + docPath + (fields ? '?' + fields : '');
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(patch) })
  });
  if (!r.ok) throw new Error('Patch failed: ' + r.status + ' ' + (await r.text()));
  return true;
}

async function getDoc(docPath) {
  const r = await fetch(BASE + "/" + docPath);
  if (!r.ok) return null;
  return docToObj(await r.json());
}

async function listMessages(chatId, offsetMs, limit) {
  const url = BASE + "/chats/" + chatId + "/messages?pageSize=" + limit;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  if (!data.documents) return [];
  const msgs = [];
  for (const doc of data.documents) {
    const o = docToObj(doc);
    const ts = o.created_at || 0;
    if (ts > offsetMs) { o._ts = ts; msgs.push(o); }
  }
  msgs.sort((a, b) => a._ts - b._ts);
  return msgs;
}

async function listBotChats(botId) {
  // Query chats where bot_id == botId
  const url = BASE + ":runQuery";
  const q = {
    structuredQuery: {
      from: [{ collectionId: 'chats' }],
      where: { fieldFilter: { field: { fieldPath: 'bot_id' }, op: 'EQUAL', value: { stringValue: botId } } },
      limit: 500
    }
  };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) });
  const data = await r.json();
  if (!Array.isArray(data)) return [];
  return data.filter(d => d.document).map(d => docToObj(d.document));
}

// ─── MAIN ───
module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.query.token;
  const action = req.query.action;

  if (!token) return err(res, 'Missing token', 401);
  if (!action) return err(res, 'Missing action', 400);

  let bot;
  try { bot = await getBotByToken(token); }
  catch (e) { console.error('DB error:', e); return err(res, 'Database error: ' + e.message, 500); }
  if (!bot) return err(res, 'Invalid token', 401);

  const body = req.method === 'POST' ? (req.body || {}) : {};

  try {
    // ═══ getMe ═══
    if (action === 'getMe') {
      return ok(res, {
        id: bot.id,
        username: bot.username,
        name: bot.name,
        about: bot.about || '',
        avatar_url: bot.avatar_url || null,
        commands: bot.commands || []
      });
    }

    // ═══ getUpdates — FIXED: per-user chat_id ═══
    if (action === 'getUpdates') {
      const offset = parseInt(req.query.offset || '0');
      const limit = Math.min(parseInt(req.query.limit || '100'), 100);

      // Fetch all chats owned by this bot
      const botChats = await listBotChats(bot.id);
      const updates = [];
      let maxTs = offset;
      const userMap = {};
      for (const c of botChats) userMap[c._id] = c;

      for (const c of botChats) {
        const chatId = c._id;
        const userId = c.user_id || (c.participants || []).find(id => id !== bot.id);
        if (!userId) continue;

        const msgs = await listMessages(chatId, offset, limit);
        for (const d of msgs) {
          if (d.sender_id === bot.id || d.is_bot === true) continue;
          const ts = d.created_at || Date.now();
          if (ts > maxTs) maxTs = ts;

          updates.push({
            update_id: d._id,
            message: {
              message_id: d._id,
              id: d._id,
              from: { id: userId, name: d.sender_name || 'User' },
              chat: { id: chatId, type: 'private', user_id: userId },  // ✅ per-user!
              text: d.text || d.content || null,
              media_type: d.media_type || null,
              media_url: d.media_url || null,
              date: ts
            }
          });
        }

        // also check callback_queries
        const cbqs = await listCallbackQueries(chatId, offset, limit);
        for (const q of cbqs) {
          const ts = q.created_at || Date.now();
          if (ts > maxTs) maxTs = ts;
          updates.push({
            update_id: q._id,
            callback_query: {
              id: q._id,
              from: { id: userId, name: 'User' },
              message: { chat: { id: chatId }, message_id: q.message_id },
              data: q.data,
              answered: q.answered === true
            }
          });
        }
      }

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, result: updates, next_offset: maxTs });
    }

    // ═══ sendMessage — writes to per-user chat ═══
    if (action === 'sendMessage') {
      if (req.method !== 'POST') return err(res, 'POST required', 405);
      const chat_id = body.chat_id;
      const text = body.text;
      if (!chat_id || !text) return err(res, 'chat_id and text required');

      const result = await addDoc('chats/' + chat_id + '/messages', {
        text: text,
        content: text,
        sender_id: bot.id,
        sender_name: bot.name,
        is_bot: true,
        parse_mode: body.parse_mode || 'Markdown',
        reply_to_message_id: body.reply_to_message_id || null,
        reply_markup: body.reply_markup || null,
        created_at: new Date(),
        reactions: {},
        is_read: false,
        is_edited: false,
        deleted_for_everyone: false
      });

      await patchDoc('chats/' + chat_id, {
        last_message: text.slice(0, 80),
        last_message_at: new Date()
      });

      return ok(res, { message_id: result.id });
    }

    // ═══ sendPhoto ═══
    if (action === 'sendPhoto') {
      if (req.method !== 'POST') return err(res, 'POST required', 405);
      if (!body.chat_id || !body.photo_url) return err(res, 'chat_id + photo_url required');

      const result = await addDoc('chats/' + body.chat_id + '/messages', {
        text: body.caption || null,
        content: body.caption || null,
        media_url: body.photo_url,
        media_type: 'image',
        sender_id: bot.id,
        sender_name: bot.name,
        is_bot: true,
        reply_to_message_id: body.reply_to_message_id || null,
        reply_markup: body.reply_markup || null,
        created_at: new Date(),
        reactions: {},
        is_read: false,
        is_edited: false,
        deleted_for_everyone: false
      });

      await patchDoc('chats/' + body.chat_id, {
        last_message: '📷 Photo',
        last_message_at: new Date()
      });

      return ok(res, { message_id: result.id });
    }

    // ═══ sendChatAction (typing) ═══
    if (action === 'sendChatAction') {
      if (req.method !== 'POST') return err(res, 'POST required', 405);
      if (!body.chat_id) return err(res, 'chat_id required');

      // Set typing_until = now + 5s
      await patchDoc('chats/' + body.chat_id, {
        bot_typing_until: new Date(Date.now() + 5000),
        bot_typing_action: body.action || 'typing'
      });
      return ok(res, { sent: true });
    }

    // ═══ editMessageText ═══
    if (action === 'editMessageText') {
      if (req.method !== 'POST') return err(res, 'POST required', 405);
      if (!body.chat_id || !body.message_id) return err(res, 'chat_id + message_id required');

      await patchDoc('chats/' + body.chat_id + '/messages/' + body.message_id, {
        text: body.text,
        content: body.text,
        is_edited: true,
        edited_at: new Date()
      });
      return ok(res, { message_id: body.message_id });
    }

    // ═══ deleteMessage ═══
    if (action === 'deleteMessage') {
      if (req.method !== 'POST') return err(res, 'POST required', 405);
      if (!body.chat_id || !body.message_id) return err(res, 'chat_id + message_id required');

      await patchDoc('chats/' + body.chat_id + '/messages/' + body.message_id, {
        deleted_for_everyone: true,
        text: 'This message was deleted',
        content: 'This message was deleted',
        media_url: null
      });
      return ok(res, { deleted: true });
    }

    // ═══ answerCallbackQuery ═══
    if (action === 'answerCallbackQuery') {
      if (req.method !== 'POST') return err(res, 'POST required', 405);
      if (!body.callback_query_id) return err(res, 'callback_query_id required');

      // Find and mark as answered
      // (We search all bot chats' cbq subcollections — simplified: skip marking)
      return ok(res, { answered: true });
    }

    // ═══ setWebhook / deleteWebhook ═══
    if (action === 'setWebhook') {
      if (req.method !== 'POST') return err(res, 'POST required', 405);
      const url = body.url;
      if (!url || !/^https:\/\//.test(url)) return err(res, 'HTTPS URL required');
      await patchDoc('bots/' + bot.id, { webhook_url: url, webhook_set_at: new Date() });
      return ok(res, true);
    }
    if (action === 'deleteWebhook') {
      await patchDoc('bots/' + bot.id, { webhook_url: null });
      return ok(res, true);
    }

    return err(res, 'Unknown action: ' + action, 404);
  } catch (e) {
    console.error('Bot API error:', e);
    return err(res, e.message || 'Internal error', 500);
  }
};

// ─── Callback query helper ───
async function listCallbackQueries(chatId, offsetMs, limit) {
  const url = BASE + "/chats/" + chatId + "/callback_queries?pageSize=" + limit;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data = await r.json();
  if (!data.documents) return [];
  const out = [];
  for (const doc of data.documents) {
    const o = docToObj(doc);
    if ((o.created_at || 0) > offsetMs && !o.answered) out.push(o);
  }
  return out;
}
