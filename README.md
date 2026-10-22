# Solarchik CLOCK IN: Anna App

The Solarchik rooftop-runner game packaged as an **Anna Marketplace App**, with **Sol**, an AI pocket friend you can text or talk to.

- Game source: [Solar-DePIN-Hub/Solarchik](https://github.com/Solar-DePIN-Hub/Solarchik) (branch `native-full`, Vite native build)
- Live web demo: https://solarchikai.grok.me/ · Video: https://www.youtube.com/watch?v=uHePyuWP-Zk

## How it works

This is a bundle-only Anna App (`schema: 2`, no executas). The game already reaches its host through a `window.SolarchikNative` bridge, the same one its Android app uses. `bundle/anna-bridge.js` implements that bridge on top of the Anna App runtime:

| Game bridge | Anna host API |
|---|---|
| `ask(payload, id)`: Sol's chat and in-run radio lines | `anna.llm.complete` |
| `hear(audio, mime, id)`: push-to-talk | `anna.audio.transcribe` |
| `speak(text, locale)`: Sol's voice | `anna.audio.speak`, falling back to device TTS |

The bundle contains no API keys or servers of its own, and every external request is blocked by Anna's CSP. Fonts are vendored locally. Asset paths are rewritten to be relative so they load under `/anna-apps/<slug>/<version>/`.

## Develop

```bash
npm i -g @anna-ai/cli          # needs uv
anna-app validate --strict
anna-app dev --mock-llm fixtures/llm-mock.jsonl   # http://localhost:5180
```

Rebuild the game bundle from source: `scripts/build-bundle.sh /path/to/Solarchik`.

## Publish

```bash
anna-app login --host https://anna.partners
anna-app apps publish          # push + cut 0.1.0
anna-app apps submit-review
```

Listing copy is in `app.json`, and the screenshots and logo are in `listing/`.

License: MIT. © Solar DePIN Hub
