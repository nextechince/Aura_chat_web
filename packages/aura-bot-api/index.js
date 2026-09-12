/**
 * aura-bot-api
 * Official AURA Bot API client for Node.js
 * @version 0.1.0
 * @license MIT
 */

'use strict';

const EventEmitter = require('events');

const VERSION = '0.1.0';
const DEFAULT_BASE = 'https://your-app.vercel.app/api/bot';

// ─── Fetch resolver (Node 18+ native, else node-fetch) ───
const fetchImpl = (() => {
  if (typeof globalThis.fetch === 'function') return globalThis.fetch;
  try { return require('node-fetch'); } catch (_) {}
  throw new Error(
    'aura-bot-api: Node 18+ required, or run `npm install node-fetch`'
  );
})();

class AuraBotError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'AuraBotError';
    this.code = code || 'UNKNOWN';
    this.status = status || 0;
  }
}

class AuraBot extends EventEmitter {
  /**
   * Create a new AURA bot client.
   * @param {string} token - Bot token from @BotCreator
   * @param {object} [options]
   * @param {string} [options.baseURL] - Custom API base URL
   * @param {number} [options.pollInterval=1000] - Polling interval (ms)
   * @param {boolean} [options.debug=false] - Log every API call
   */
  constructor(token, options = {}) {
    super();

    if (!token || typeof token !== 'string') {
      throw new AuraBotError('Bot token required', 'INVALID_TOKEN');
    }

    this.token = token;
    this.baseURL = (options.baseURL || DEFAULT_BASE).replace(/\/+$/, '');
    this.pollInterval = Math.max(500, options.pollInterval || 1000);
    this.debug = options.debug === true;
    this.offset = 0;
    this._polling = false;
    this._pollTimer = null;
    this.version = VERSION;
  }

  // ═══════════════════════════════════════════════════════════
  // LOW-LEVEL
  // ═══════════════════════════════════════════════════════════
  _url(action) {
    return `${this.baseURL}/${this.token}/${action}`;
  }

  _log(...args) {
    if (this.debug) console.log('[aura-bot-api]', ...args);
  }

  async _call(action, params = {}, isPost = false) {
    const url = this._url(action);
    let finalUrl = url;
    const init = {
      method: isPost ? 'POST' : 'GET',
      headers: { 'User-Agent': `aura-bot-api/${VERSION}` }
    };

    if (isPost) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(params);
    } else {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
      ).toString();
      if (qs) finalUrl = `${url}?${qs}`;
    }

    this._log(isPost ? 'POST' : 'GET', finalUrl, params);

    let res;
    try {
      res = await fetchImpl(finalUrl, init);
    } catch (e) {
      throw new AuraBotError(`Network error: ${e.message}`, 'NETWORK', 0);
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new AuraBotError(`Invalid JSON (HTTP ${res.status})`, 'BAD_JSON', res.status);
    }

    if (!data.ok) {
      throw new AuraBotError(
        data.error || `HTTP ${res.status}`,
        res.status === 401 ? 'INVALID_TOKEN' : 'API_ERROR',
        res.status
      );
    }

    return data.result;
  }

  // ═══════════════════════════════════════════════════════════
  // API METHODS
  // ═══════════════════════════════════════════════════════════

  /** Get this bot's profile. */
  getMe() {
    return this._call('getMe');
  }

  /** Send a text message. */
  sendMessage(chatId, text, options = {}) {
    if (!chatId) throw new AuraBotError('chatId required', 'MISSING_PARAM');
    if (text === undefined || text === null) {
      throw new AuraBotError('text required', 'MISSING_PARAM');
    }
    return this._call('sendMessage', {
      chat_id: chatId,
      text: String(text),
      parse_mode: options.parseMode || 'Markdown'
    }, true);
  }

  /** Send a photo by URL. */
  sendPhoto(chatId, photoUrl, options = {}) {
    if (!chatId || !photoUrl) {
      throw new AuraBotError('chatId and photoUrl required', 'MISSING_PARAM');
    }
    return this._call('sendPhoto', {
      chat_id: chatId,
      photo_url: photoUrl,
      caption: options.caption || ''
    }, true);
  }

  /** Register a webhook URL. */
  setWebhook(url) {
    if (!url || !/^https:\/\//.test(url)) {
      throw new AuraBotError('HTTPS url required', 'INVALID_URL');
    }
    return this._call('setWebhook', { url }, true);
  }

  /** Remove webhook (return to polling). */
  deleteWebhook() {
    return this._call('deleteWebhook', {}, true);
  }

  /** Manually fetch updates (rarely needed). */
  getUpdates(offset) {
    return this._call('getUpdates', {
      offset: offset !== undefined ? offset : this.offset
    });
  }

  // ═══════════════════════════════════════════════════════════
  // POLLING
  // ═══════════════════════════════════════════════════════════

  /** Begin polling. Emits 'message' and 'update'. */
  start(options = {}) {
    if (this._polling) return this;
    if (options.pollInterval) this.pollInterval = Math.max(500, options.pollInterval);
    this._polling = true;
    this._poll();
    return this;
  }

  /** Stop polling. */
  stop() {
    this._polling = false;
    if (this._pollTimer) clearTimeout(this._pollTimer);
    return this;
  }

  async _poll() {
    while (this._polling) {
      try {
        const updates = await this.getUpdates(this.offset);
        for (const u of updates) {
          if (u.message && typeof u.message.date === 'number') {
            this.offset = Math.max(this.offset, u.message.date);
          }
          try {
            this.emit('update', u);
            if (u.message) this.emit('message', u.message);
          } catch (handlerErr) {
            this.emit('error', handlerErr);
          }
        }
      } catch (e) {
        this.emit('error', e);
      }
      if (this._polling) {
        await new Promise(r => { this._pollTimer = setTimeout(r, this.pollInterval); });
      }
    }
  }
}

module.exports = AuraBot;
module.exports.AuraBot = AuraBot;
module.exports.AuraBotError = AuraBotError;
module.exports.default = AuraBot;
module.exports.VERSION = VERSION;
