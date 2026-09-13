const PROJECT = "aurachat-85f54";
const BASE = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents";

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function ok(res, result) {
    return res.status(200).json({ ok: true, result: result });
}

function err(res, message, status) {
    return res.status(status || 400).json({ ok: false, error: message });
}

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
        const fields = v.mapValue.fields || {};
        for (const k in fields) out[k] = parseValue(fields[k]);
        return out;
    }
    return null;
}

function toValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') {
        if (Number.isInteger(val)) return { integerValue: String(val) };
        return { doubleValue: val };
    }
    if (typeof val === 'boolean') return { booleanValue: val };
    if (val instanceof Date) return { timestampValue: val.toISOString() };
    if (Array.isArray(val)) return { arrayValue: { values: val.map(toValue) } };
    if (typeof val === 'object') {
        const fields = {};
        for (const k in val) fields[k] = toValue(val[k]);
        return { mapValue: { fields: fields } };
    }
    return { nullValue: null };
}

function toFields(obj) {
    const fields = {};
    for (const k in obj) {
        if (obj[k] === undefined) continue;
        fields[k] = toValue(obj[k]);
    }
    return fields;
}

function docToObj(doc) {
    if (!doc || !doc.fields) return null;
    const out = {};
    for (const k in doc.fields) out[k] = parseValue(doc.fields[k]);
    if (doc.name) {
        const parts = doc.name.split('/');
        out._id = parts[parts.length - 1];
    }
    return out;
}

async function getBotByToken(token) {
    const q = {
        structuredQuery: {
            from: [{ collectionId: 'bots' }],
            where: {
                fieldFilter: {
                    field: { fieldPath: 'token' },
                    op: 'EQUAL',
                    value: { stringValue: token }
                }
            },
            limit: 1
        }
    };
    const url = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents:runQuery";
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(q)
    });
    const data = await r.json();
    if (!Array.isArray(data) || !data[0] || !data[0].document) return null;
    const obj = docToObj(data[0].document);
    obj.id = obj._id;
    return obj;
}

async function getMessagesSince(chatId, offsetMs, limit) {
    const url = "https://firestore.googleapis.com/v1/projects/" + PROJECT +
        "/databases/(default)/documents/chats/" + chatId + "/messages?pageSize=" + limit;
    const r = await fetch(url);
    if (!r.ok) return [];
    const data = await r.json();
    if (!data.documents) return [];

    const msgs = [];
    for (const doc of data.documents) {
        const obj = docToObj(doc);
        const ts = obj.created_at || 0;
        if (ts > offsetMs) {
            obj._ts = ts;
            msgs.push(obj);
        }
    }
    msgs.sort(function(a, b) { return a._ts - b._ts; });
    return msgs;
}

async function addMessage(chatId, msg) {
    const url = "https://firestore.googleapis.com/v1/projects/" + PROJECT +
        "/databases/(default)/documents/chats/" + chatId + "/messages";
    const body = { fields: toFields(msg) };
    const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!r.ok) {
        const t = await r.text();
        throw new Error('Add message failed: ' + r.status + ' ' + t);
    }
    const data = await r.json();
    const parts = data.name.split('/');
    return { message_id: parts[parts.length - 1] };
}

async function updateChat(chatId, patch) {
    const fields = Object.keys(patch).map(function(k) { return 'updateMask.fieldPaths=' + k; }).join('&');
    const url = "https://firestore.googleapis.com/v1/projects/" + PROJECT +
        "/databases/(default)/documents/chats/" + chatId + "?" + fields;

    const body = { fields: toFields(patch) };
    const r = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!r.ok) {
        const t = await r.text();
        console.error('Update chat failed:', r.status, t);
    }
}

module.exports = async (req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const token = req.query.token;
    const action = req.query.action;

    if (!token) return err(res, 'Missing token', 401);
    if (!action) return err(res, 'Missing action', 400);

    let bot;
    try {
        bot = await getBotByToken(token);
    } catch (e) {
        console.error('DB error:', e);
        return err(res, 'Database error: ' + e.message, 500);
    }

    if (!bot) return err(res, 'Invalid token', 401);

    try {
        if (action === 'getMe') {
            return ok(res, {
                id: bot.id,
                username: bot.username,
                name: bot.name,
                about: bot.about || '',
                avatar_url: bot.avatar_url || null,
                commands: bot.commands || ['/start', '/help']
            });
        }

        if (action === 'getUpdates') {
            const offset = parseInt(req.query.offset || '0');
            const limit = Math.min(parseInt(req.query.limit || '100'), 100);

            const msgs = await getMessagesSince(bot.id, offset, limit);
            const updates = [];
            let maxTs = offset;

            for (const d of msgs) {
                if (d.sender_id === bot.id) continue;
                if (d.is_bot === true) continue;

                const ts = d.created_at || Date.now();
                if (ts > maxTs) maxTs = ts;

                updates.push({
                    update_id: d._id,
                    message: {
                        message_id: d._id,
                        from: { id: d.sender_id, name: d.sender_name || 'User' },
                        chat: { id: bot.id, type: 'private' },
                        text: d.text || d.content || null,
                        media_type: d.media_type || null,
                        media_url: d.media_url || null,
                        date: ts
                    }
                });
            }

            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).json({
                ok: true,
                result: updates,
                next_offset: maxTs
            });
        }

        if (action === 'sendMessage') {
            if (req.method !== 'POST') return err(res, 'POST required', 405);
            const body = req.body || {};
            const chat_id = body.chat_id;
            const text = body.text;
            if (!chat_id || !text) return err(res, 'chat_id and text required');

            const result = await addMessage(chat_id, {
                text: text,
                content: text,
                sender_id: bot.id,
                sender_name: bot.name,
                is_bot: true,
                parse_mode: body.parse_mode || 'Markdown',
                created_at: new Date(),
                reactions: {},
                views: 0,
                is_read: false,
                is_edited: false,
                deleted_for_everyone: false
            });

            await updateChat(chat_id, {
                last_message: text.slice(0, 80),
                last_message_at: new Date()
            });

            return ok(res, result);
        }

        if (action === 'sendPhoto') {
            if (req.method !== 'POST') return err(res, 'POST required', 405);
            const body = req.body || {};
            if (!body.chat_id || !body.photo_url) return err(res, 'chat_id and photo_url required');

            const result = await addMessage(body.chat_id, {
                text: body.caption || null,
                content: body.caption || null,
                media_url: body.photo_url,
                media_type: 'image',
                sender_id: bot.id,
                sender_name: bot.name,
                is_bot: true,
                created_at: new Date(),
                reactions: {},
                views: 0,
                is_read: false,
                is_edited: false,
                deleted_for_everyone: false
            });

            await updateChat(body.chat_id, {
                last_message: '📷 Photo',
                last_message_at: new Date()
            });

            return ok(res, result);
        }

        if (action === 'setWebhook') {
            if (req.method !== 'POST') return err(res, 'POST required', 405);
            const url = (req.body || {}).url;
            if (!url || !/^https:\/\//.test(url)) return err(res, 'HTTPS URL required');

            const patchUrl = "https://firestore.googleapis.com/v1/projects/" + PROJECT +
                "/databases/(default)/documents/bots/" + bot.id + "?updateMask.fieldPaths=webhook_url&updateMask.fieldPaths=webhook_set_at";
            await fetch(patchUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fields: toFields({
                        webhook_url: url,
                        webhook_set_at: new Date()
                    })
                })
            });
            return ok(res, true);
        }

        if (action === 'deleteWebhook') {
            const patchUrl = "https://firestore.googleapis.com/v1/projects/" + PROJECT +
                "/databases/(default)/documents/bots/" + bot.id + "?updateMask.fieldPaths=webhook_url&updateMask.fieldPaths=webhook_set_at";
            await fetch(patchUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: {} })
            });
            return ok(res, true);
        }

        return err(res, 'Unknown action: ' + action, 404);
    } catch (e) {
        console.error('Bot API error:', e);
        return err(res, e.message || 'Internal error', 500);
    }
};
