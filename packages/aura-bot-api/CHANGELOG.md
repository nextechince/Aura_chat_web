# Changelog

All notable changes to `aura-bot-api` are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [0.1.0] — 2025-01-15

### Added
- Initial public release
- `AuraBot` client with EventEmitter interface
- Methods: `getMe`, `sendMessage`, `sendPhoto`, `setWebhook`, `deleteWebhook`, `getUpdates`
- Long-polling via `start()` / `stop()`
- TypeScript definitions (`index.d.ts`)
- Custom `AuraBotError` class with error codes
- Debug mode
- Compatible with Node.js 14+ (native fetch on 18+)

### Notes
- Pre-1.0 release — API may change before 1.0.0

## [Unreleased]

### Planned for 0.2.0
- `editMessageText()`
- `deleteMessage()`
- `pinMessage()`

### Planned for 0.3.0
- `sendVideo()`
- `sendAudio()`
- `sendDocument()`

### Planned for 0.4.0
- Built-in webhook server helper
- Retry with exponential backoff
- Full TypeScript rewrite
